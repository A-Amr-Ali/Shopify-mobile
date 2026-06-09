// Central config, read from environment with sane defaults.
const bool = (v, d = false) => (v == null ? d : /^(1|true|yes)$/i.test(String(v)));
const num = (v, d) => (v == null || v === "" ? d : Number(v));

export const config = {
  store: process.env.SHOPIFY_STORE,
  token: process.env.SHOPIFY_ADMIN_TOKEN,
  // Client-credentials method (newer custom apps): the engine exchanges these
  // for a short-lived Admin API token automatically on each run.
  clientId: process.env.SHOPIFY_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
  apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",

  geo: process.env.TREND_GEO ?? "EG",
  trendTag: process.env.TREND_TAG || "trending",
  bestsellerTag: process.env.BESTSELLER_TAG || "bestseller",

  // Scope to beauty: only products inside these collection handles are
  // considered (keeps home appliances etc. out of the beauty trending section).
  // Comma-separated handles. Empty = scan the whole catalog.
  collections: (process.env.TREND_COLLECTIONS || "")
    .split(",").map((s) => s.trim()).filter(Boolean),
  // Ignore keywords shorter than this (prevents junk like "g" matching everything).
  minKeywordLen: num(process.env.MIN_KEYWORD_LEN, 4),

  maxTrending: num(process.env.MAX_TRENDING, 12),
  maxBestsellers: num(process.env.MAX_BESTSELLERS, 12),
  // Max products per brand in Trending (variety — stops one brand flooding).
  maxPerVendor: num(process.env.MAX_PER_VENDOR, 3),

  weights: {
    google: num(process.env.WEIGHT_GOOGLE, 0.5),
    sales: num(process.env.WEIGHT_SALES, 0.4),
    manual: num(process.env.WEIGHT_MANUAL, 0.6),
  },

  salesLookbackDays: num(process.env.SALES_LOOKBACK_DAYS, 14),
  dryRun: bool(process.env.DRY_RUN, false),
  // SEO optimizer: max products to write per run (0 = all).
  maxWrites: num(process.env.MAX_WRITES, 0),

  // ── "New In" brand-watch ──
  newInTag: process.env.NEW_IN_TAG || "new-in",
  maxNewIn: num(process.env.MAX_NEW_IN, 24),
  // How many of each brand's newest products to consider.
  brandFeedLimit: num(process.env.BRAND_FEED_LIMIT, 40),
  // How many pages of a brand's public feed to scan (250 products/page).
  brandFeedPages: num(process.env.BRAND_FEED_PAGES, 3),
  // Readable brands: only count launches from the last N days.
  brandNewDays: num(process.env.BRAND_NEW_DAYS, 10),
  // Non-readable brands: fall back to products uploaded to YOUR store in last N days.
  storeNewDays: num(process.env.STORE_NEW_DAYS, 30),
};

export function assertConfig() {
  if (!config.store) {
    throw new Error("Missing SHOPIFY_STORE. Copy .env.example to .env (see README).");
  }
  const hasToken = !!config.token;
  const hasClientCreds = !!(config.clientId && config.clientSecret);
  if (!hasToken && !hasClientCreds) {
    throw new Error(
      "Provide either SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (client-credentials method)."
    );
  }
}
