import { STORE, GOALS } from './config.mjs';
import { normalizeFeed, routineSteps } from './engine.mjs';
export const OPTIONS_QUERY = `query JourneyOptions($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id title price inventoryQuantity product { handle title vendor status onlineStoreUrl featuredImage { url } } } } }`;
const feeds = new Map();
const readyCache = new Map();
let tokenCache = null;
export const STOCK_QUERY = `query GrowthStock($ids: [ID!]!) { nodes(ids: $ids) { ... on ProductVariant { id title price inventoryQuantity product { handle status onlineStoreUrl nowVariants: metafield(namespace: "custom", key: "sofie_hours_variants") { jsonValue } } } } }`;
export const COLLECTION_QUERY = `query GrowthCollection($handle: String!, $after: String) { collectionByIdentifier(identifier: { handle: $handle }) { products(first: 40, after: $after, sortKey: BEST_SELLING) { nodes { handle title vendor productType tags description(truncateAt: 700) status onlineStoreUrl featuredImage { url } nowVariants: metafield(namespace: "custom", key: "sofie_hours_variants") { jsonValue } variants(first: 12) { nodes { id title price inventoryQuantity } pageInfo { hasNextPage endCursor } } } pageInfo { hasNextPage endCursor } } } }`;

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
  const data = await r.json(); if (data.errors?.length) { const details=data.errors.map(e=>String(e.message).slice(0,240)).join('; ');console.warn('Shopify query error:',details);const error=new Error('admin_query_rejected');error.details=details;throw error; }
  return data.data;
}

async function feed(handle, step, fresh = false) {
  const hit = feeds.get(handle);
  if (!fresh && hit && Date.now() - hit.at < 180000) return normalizeFeed(hit.rows, step);
  // Prefer the authenticated data path: some hosting networks cannot read the
  // storefront's public collection JSON even though the page works in-browser.
  let rows = [];
  try {
    let after = null;
    for (let page = 0; page < 3; page++) {
      const products = (await adminQuery(COLLECTION_QUERY, { handle, after })).collectionByIdentifier?.products;
      if (!products) break;
      for (const p of products.nodes) {
        if (p.status !== 'ACTIVE' || !p.onlineStoreUrl) continue;
        const ready = Array.isArray(p.nowVariants?.jsonValue) ? p.nowVariants.jsonValue : [];
        rows.push({ h:p.handle,t:p.title,v:p.vendor,y:p.productType,g:p.tags.join(','),d:p.description,i:p.featuredImage?.url || '',
          n:ready.length ? 1 : 0,s:p.variants.nodes.map(v=>({id:v.id.replace(/^.*\//,''),t:v.title,p:Math.round(Number(v.price)*100),a:v.inventoryQuantity>0?1:0})) });
      }
      if (!products.pageInfo.hasNextPage) break;
      after = products.pageInfo.endCursor;
    }
  } catch (error) {
    console.warn('native catalog:', error.message);
    const r = await fetch(`${STORE}/collections/${handle}?view=sfm&sort_by=best-selling`, { signal: AbortSignal.timeout(12000), headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('catalog_http_' + r.status);
    rows = JSON.parse(await r.text());
    if (!Array.isArray(rows)) throw new Error('catalog_format');
  }
  feeds.set(handle, { rows, at: Date.now() });
  return normalizeFeed(rows, step);
}

// Check the exact variant's current reported Shopify quantity and publication.
// The store's existing SOFIE NOW variant list is the express-eligibility source.
// This does not infer warehouse inventory from a product-wide marketing badge.
export async function verifyStock(cards) {
  if (!cards.length) return { cards: [], verification: 'no_candidates' };
  try {
    const ids = [...new Set(cards.map(c => 'gid://shopify/ProductVariant/' + c.variantId))];
    const nodes = [];
    for (let i = 0; i < ids.length; i += 40) nodes.push(...(await adminQuery(STOCK_QUERY, { ids: ids.slice(i, i + 40) })).nodes);
    const byId = new Map(nodes.filter(Boolean).map(v => [v.id.replace(/^.*\//, ''), v]));
    return { cards: cards.flatMap(card => {
      const v = byId.get(card.variantId);
      if (!v || v.product?.status !== 'ACTIVE' || !v.product?.onlineStoreUrl || !(v.inventoryQuantity > 0)) return [];
      const list = v.product.nowVariants?.jsonValue;
      const hasList = Array.isArray(list) && list.length > 0;
      const explicit = hasList && list.includes(v.id);
      return [{ ...card, price: Number(v.price), stockChecked: true, now: hasList ? explicit : card.productNowSignal, nowVerified:hasList }];
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

export async function checkOptions(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 10 || ids.some(id => !/^\d{1,20}$/.test(String(id)))) throw new Error('invalid_options');
  const wanted = [...new Set(ids.map(String))];
  const data = await adminQuery(OPTIONS_QUERY, { ids: wanted.map(id => 'gid://shopify/ProductVariant/' + id) });
  const nodes = data.nodes.filter(Boolean);
  const ready = new Map();
  await Promise.all([...new Set(nodes.filter(v => v.product?.status === 'ACTIVE' && v.product?.onlineStoreUrl && v.inventoryQuantity > 0).map(v => v.product.handle))].map(async handle => {
    try { ready.set(handle, await readyOptions(handle)); } catch { ready.set(handle, null); }
  }));
  const byId = new Map(nodes.map(v => [v.id.split('/').pop(), v]));
  return { checkedAt: new Date().toISOString(), items: wanted.map(variantId => {
    const v = byId.get(variantId);
    if (!v || v.product?.status !== 'ACTIVE' || !v.product?.onlineStoreUrl) return { variantId, available: false, now: false };
    return { variantId, handle:v.product.handle, title:v.product.title, brand:v.product.vendor, variantTitle:v.title,
      price:Number(v.price), available:v.inventoryQuantity > 0, now:v.inventoryQuantity > 0 ? (ready.get(v.product.handle) instanceof Set ? ready.get(v.product.handle).has(variantId) : null) : false,
      image:v.product.featuredImage?.url || '', url:STORE + '/products/' + v.product.handle + '?variant=' + variantId };
  }) };
}

export function markExactNow(cards, readyByHandle) {
  return cards.map(c => ({ ...c, now: c.now && (c.nowVerified === true || readyByHandle.get(c.handle)?.has(c.variantId) === true) }));
}

export function boundCandidates(cards, limit = 160) {
  const steps = [...new Set(cards.map(c => c.step))];
  const perStep = Math.floor(limit / Math.max(steps.length, 1));
  return steps.flatMap(step => cards.filter(c => c.step === step && c.price > 0).slice(0, perStep));
}

export async function loadCatalog(goal, { fresh = false, today = false, budget = null, faceAreas = [], concerns = [] } = {}) {
  const sets = await Promise.allSettled(routineSteps({ goal, faceAreas, concerns }).map(([step, handle]) => feed(handle, step, fresh)));
  const cards = sets.flatMap(s => s.status === 'fulfilled' ? s.value : []);
  if (!cards.length && sets.some(s => s.status === 'rejected')) throw new Error('catalog_unavailable');
  // Bound API cost without showing only one shade of every product.
  const limited = boundCandidates(cards);
  const checked = await verifyStock(limited);
  if (today) {
    const handles = [...new Set(checked.cards.filter(c => c.now && !c.nowVerified && (budget === null || c.price <= budget)).map(c => c.handle))].slice(0, 20);
    const readyByHandle = new Map();
    await Promise.all(handles.map(async h => { try { readyByHandle.set(h, await readyOptions(h)); } catch { readyByHandle.set(h, new Set()); } }));
    checked.cards = markExactNow(checked.cards, readyByHandle);
  } else checked.cards = checked.cards.map(c => ({ ...c, now: false }));
  return checked;
}
