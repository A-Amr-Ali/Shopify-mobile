// Minimal Shopify Admin GraphQL client (no SDK, native fetch on Node 18+).
import { config } from "./config.js";

const endpoint = () =>
  `https://${config.store}/admin/api/${config.apiVersion}/graphql.json`;

// Resolve an Admin API access token. If a static token is provided we use it;
// otherwise we exchange client_id + client_secret via the client-credentials
// grant (Shopify returns a short-lived shpat_ token, refreshed each run).
let resolvedToken = config.token || null;
async function ensureToken() {
  if (resolvedToken) return resolvedToken;
  const res = await fetch(`https://${config.store}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token exchange returned no access_token: ${JSON.stringify(json)}`);
  resolvedToken = json.access_token;
  return resolvedToken;
}

async function gql(query, variables = {}) {
  const token = await ensureToken();
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Shopify HTTP ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

// Fetch every product (id, title, vendor, productType, tags) with pagination.
export async function fetchAllProducts() {
  const out = [];
  let cursor = null;
  const q = `
    query Products($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            vendor
            productType
            tags
            totalInventory
            createdAt
          }
        }
      }
    }`;
  do {
    const data = await gql(q, { cursor });
    for (const e of data.products.edges) out.push(e.node);
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return out;
}

// Fetch products that belong to the given collection handles (deduped).
// Used to scope the engine to beauty collections so non-beauty products
// (home appliances, etc.) can never be tagged as beauty "trending".
export async function fetchProductsInCollections(handles) {
  const byId = new Map();
  const findQ = `query($q: String!) { collections(first: 1, query: $q) { edges { node { id title } } } }`;
  const prodQ = `
    query($id: ID!, $cursor: String) {
      collection(id: $id) {
        products(first: 250, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges { node { id title vendor productType tags totalInventory } }
        }
      }
    }`;
  for (const handle of handles) {
    const found = await gql(findQ, { q: `handle:${handle}` });
    const node = found.collections.edges[0]?.node;
    if (!node) { console.warn(`⚠️  Collection not found, skipping: ${handle}`); continue; }
    let cursor = null;
    do {
      const data = await gql(prodQ, { id: node.id, cursor });
      const conn = data.collection?.products;
      if (!conn) break;
      for (const e of conn.edges) byId.set(e.node.id, e.node);
      cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (cursor);
  }
  return [...byId.values()];
}

export async function tagsAdd(id, tags) {
  if (!tags.length) return;
  const m = `
    mutation($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
    }`;
  const data = await gql(m, { id, tags });
  const errs = data.tagsAdd.userErrors;
  if (errs.length) throw new Error(`tagsAdd: ${JSON.stringify(errs)}`);
}

export async function tagsRemove(id, tags) {
  if (!tags.length) return;
  const m = `
    mutation($id: ID!, $tags: [String!]!) {
      tagsRemove(id: $id, tags: $tags) { userErrors { field message } }
    }`;
  const data = await gql(m, { id, tags });
  const errs = data.tagsRemove.userErrors;
  if (errs.length) throw new Error(`tagsRemove: ${JSON.stringify(errs)}`);
}

// Optional: units sold per product over the last N days (needs read_orders scope).
// Returns Map<productGid, units>. Silently returns empty map if not permitted.
export async function fetchSalesVelocity(days) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const units = new Map();
  let cursor = null;
  const q = `
    query Orders($cursor: String, $query: String!) {
      orders(first: 100, after: $cursor, query: $query) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            lineItems(first: 50) {
              edges { node { quantity product { id } } }
            }
          }
        }
      }
    }`;
  try {
    do {
      const data = await gql(q, { cursor, query: `created_at:>=${since}` });
      for (const e of data.orders.edges) {
        for (const li of e.node.lineItems.edges) {
          const pid = li.node.product?.id;
          if (!pid) continue;
          units.set(pid, (units.get(pid) || 0) + li.node.quantity);
        }
      }
      cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
    } while (cursor);
  } catch (err) {
    console.warn(`⚠️  Sales velocity skipped (need read_orders scope?): ${err.message}`);
    return new Map();
  }
  return units;
}
