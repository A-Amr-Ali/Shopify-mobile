// Minimal Shopify Admin GraphQL client (no SDK, native fetch on Node 18+).
import { config } from "./config.js";

const endpoint = () =>
  `https://${config.store}/admin/api/${config.apiVersion}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": config.token,
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
