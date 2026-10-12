import { STORE, GOALS } from './config.mjs';
import { normalizeFeed } from './engine.mjs';
const feeds = new Map();
const readyCache = new Map();
let tokenCache = null;
export const STOCK_QUERY = `query GrowthStock($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id title price inventoryQuantity inventoryItem { tracked inventoryLevels(first: 20) { nodes { location { id name } quantities(names: ["available"]) { name quantity } } pageInfo { hasNextPage endCursor } } } product { handle status onlineStoreUrl } } } }`;

async function getToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  const shop = process.env.SHOP_DOMAIN;
  const id = process.env.SHOPIFY_ADMIN_CLIENT_ID;
  const secret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  if (!shop || !id || !secret) throw new Error('admin_unconfigured');
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(shop)) throw new Error('invalid_shop_domain');
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, { method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }) });
  if (!r.ok) throw new Error('admin_auth_' + r.status);
  const data = await r.json(); if (!data.access_token) throw new Error('admin_missing_token');
  tokenCache = { token: data.access_token, expires: Date.now() + Math.min(Number(data.expires_in || 3600) - 120, 3000) * 1000 };
  return tokenCache.token;
}

export async function adminQuery(query, variables = {}) {
  const token = await getToken();
  const r = await fetch(`https://${process.env.SHOP_DOMAIN}/admin/api/2026-10/graphql.json`, {
    method: 'POST', signal: AbortSignal.timeout(12000), headers: { 'content-type': 'application/json', 'x-shopify-access-token': token },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) throw new Error('admin_http_' + r.status);
  const data = await r.json(); if (data.errors?.length) throw new Error('admin_query_rejected');
  return data.data;
}

async function feed(handle, step, fresh = false) {
  const hit = feeds.get(handle);
  if (!fresh && hit && Date.now() - hit.at < 180000) return normalizeFeed(hit.rows, step);
  const r = await fetch(`${STORE}/collections/${handle}?view=sfm&sort_by=best-selling`, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('catalog_http_' + r.status);
  const rows = JSON.parse(await r.text());
  if (!Array.isArray(rows)) throw new Error('catalog_format');
  feeds.set(handle, { rows, at: Date.now() });
  return normalizeFeed(rows, step);
}

// Both public sale availability and tracked positive physical stock are required
// when the Admin inventory check is available. The public feed is never used to
// infer SOFIE NOW for every shade of a product.
export async function verifyStock(cards) {
  if (!cards.length) return { cards: [], verification: 'no_candidates' };
  try {
    const ids = [...new Set(cards.map(c => 'gid://shopify/ProductVariant/' + c.variantId))];
    const nodes = [];
    for (let i = 0; i < ids.length; i += 40) nodes.push(...(await adminQuery(STOCK_QUERY, { ids: ids.slice(i, i + 40) })).nodes);
    const byId = new Map(nodes.filter(Boolean).map(v => [v.id.replace(/^.*\//, ''), v]));
    const localId = process.env.LOCAL_LOCATION_ID || '';
    return { cards: cards.flatMap(card => {
      const v = byId.get(card.variantId);
      if (!v || v.product?.status !== 'ACTIVE' || !v.product?.onlineStoreUrl || !v.inventoryItem?.tracked || !(v.inventoryQuantity > 0)) return [];
      const local = !v.inventoryItem.inventoryLevels.pageInfo.hasNextPage && v.inventoryItem.inventoryLevels.nodes
        .some(l => l.location.id === localId && l.quantities.some(q => q.name === 'available' && q.quantity > 0));
      return [{ ...card, price: Number(v.price), stockChecked: true, now: local && card.productNowSignal }];
    }), verification: 'shopify_inventory' };
  } catch (error) {
    // Fail closed for physical-stock or fast-delivery assertions.
    console.warn('stock verification unavailable:', error.message);
    return { cards: cards.map(c => ({ ...c, now: false, stockChecked: false })), verification: 'online_availability_only' };
  }
}

async function readyOptions(handle) {
  const hit = readyCache.get(handle);
  if (hit && Date.now() - hit.at < 60000) return hit.ids;
  const r = await fetch(STORE + '/products/' + handle, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('now_http_' + r.status);
  const html = await r.text();
  const match = html.match(/<script[^>]*data-nowp-data[^>]*>([\s\S]*?)<\/script>/i);
  const ids = new Set(match ? (JSON.parse(match[1]).ready || []).map(String) : []);
  readyCache.set(handle, { ids, at: Date.now() });
  return ids;
}

export function markExactNow(cards, readyByHandle) {
  return cards.map(c => ({ ...c, now: c.now && readyByHandle.get(c.handle)?.has(c.variantId) === true }));
}

export async function loadCatalog(goal, { fresh = false, today = false, budget = 100000 } = {}) {
  const sets = await Promise.allSettled(GOALS[goal].steps.map(([step, handle]) => feed(handle, step, fresh)));
  const cards = sets.flatMap(s => s.status === 'fulfilled' ? s.value : []);
  if (!cards.length && sets.some(s => s.status === 'rejected')) throw new Error('catalog_unavailable');
  // Bound API cost without showing only one shade of every product.
  const limited = cards.filter(c => c.price > 0).slice(0, 160);
  const checked = await verifyStock(limited);
  if (today) {
    const handles = [...new Set(checked.cards.filter(c => c.now && c.price <= budget).map(c => c.handle))].slice(0, 20);
    const readyByHandle = new Map();
    await Promise.all(handles.map(async h => { try { readyByHandle.set(h, await readyOptions(h)); } catch { readyByHandle.set(h, new Set()); } }));
    checked.cards = markExactNow(checked.cards, readyByHandle);
  } else checked.cards = checked.cards.map(c => ({ ...c, now: false }));
  return checked;
}
