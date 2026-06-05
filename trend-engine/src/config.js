// Central config, read from environment with sane defaults.
const bool = (v, d = false) => (v == null ? d : /^(1|true|yes)$/i.test(String(v)));
const num = (v, d) => (v == null || v === "" ? d : Number(v));

export const config = {
  store: process.env.SHOPIFY_STORE,
  token: process.env.SHOPIFY_ADMIN_TOKEN,
  apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",

  geo: process.env.TREND_GEO ?? "EG",
  trendTag: process.env.TREND_TAG || "trending",
  bestsellerTag: process.env.BESTSELLER_TAG || "bestseller",

  maxTrending: num(process.env.MAX_TRENDING, 12),
  maxBestsellers: num(process.env.MAX_BESTSELLERS, 12),

  weights: {
    google: num(process.env.WEIGHT_GOOGLE, 0.5),
    sales: num(process.env.WEIGHT_SALES, 0.4),
    manual: num(process.env.WEIGHT_MANUAL, 0.6),
  },

  salesLookbackDays: num(process.env.SALES_LOOKBACK_DAYS, 14),
  dryRun: bool(process.env.DRY_RUN, false),
};

export function assertConfig() {
  const missing = [];
  if (!config.store) missing.push("SHOPIFY_STORE");
  if (!config.token) missing.push("SHOPIFY_ADMIN_TOKEN");
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(", ")}. Copy .env.example to .env (see README).`);
  }
}
