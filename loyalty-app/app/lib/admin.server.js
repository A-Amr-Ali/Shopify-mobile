// Admin API client via the client-credentials grant — the same proven method
// the trend engine uses. App Proxy + cron + webhook contexts don't reliably have
// a stored offline session (the modern managed-install flow doesn't persist one),
// so instead of `unauthenticated.admin(shop)` we mint a short-lived Admin token
// directly from the app's client_id + client_secret and call the GraphQL API.
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

let cache = { token: null, shop: null, exp: 0 };

async function mintToken(shop) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      // Prefer a dedicated Shopify-admin custom app (confirmed to support the
      // client-credentials grant); fall back to the main app's credentials.
      client_id: process.env.SHOPIFY_ADMIN_CLIENT_ID || process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_ADMIN_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`token exchange HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.access_token) throw new Error(`token exchange returned no access_token: ${JSON.stringify(json)}`);
  return json.access_token;
}

/**
 * Returns an object shaped like shopify-app-remix's admin client
 * (`admin.graphql(query, { variables })` → Response-with-.json()), so it's a
 * drop-in replacement for `(await unauthenticated.admin(shop)).admin`.
 */
export async function getAdmin(shop) {
  const target = shop || process.env.SHOP_DOMAIN;
  if (!target) throw new Error("getAdmin: no shop domain (set SHOP_DOMAIN)");

  // Preferred fallback: a static Admin API token (shpat_…) from a Shopify-admin
  // custom app — always works. Otherwise mint one via client-credentials.
  let token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!token) {
    if (!(cache.token && cache.shop === target && cache.exp > Date.now())) {
      cache = { token: await mintToken(target), shop: target, exp: Date.now() + 50 * 60 * 1000 };
    }
    token = cache.token;
  }
  const endpoint = `https://${target}/admin/api/${API_VERSION}/graphql.json`;

  return {
    graphql: async (query, opts = {}) => {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables: opts.variables || {} }),
      });
      // Mimic the Response interface the callers expect (.json()).
      return { ok: r.ok, status: r.status, json: () => r.json() };
    },
  };
}
