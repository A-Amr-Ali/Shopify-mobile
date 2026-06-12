// Single source of truth for every tunable loyalty rule.
// Money is whole EGP. Points are integers. Change here, not in business logic.

export const EARN_DIVISOR = Number(process.env.EARN_DIVISOR ?? 10); // 1 pt / 10 EGP

// Tiers: rolling 12-month spend thresholds (EGP) + earn multiplier.
// Order matters: highest threshold first when resolving a tier.
export const TIERS = [
  { key: "icon", label: "Icon", minSpendEgp: 120_000, multiplier: 1.5 },
  { key: "vip", label: "VIP", minSpendEgp: 40_000, multiplier: 1.25 },
  { key: "insider", label: "Insider", minSpendEgp: 0, multiplier: 1.0 },
];

export const DEFAULT_TIER = "insider";

// Status hold: once earned, a tier is held for the qualifying period plus the
// next 12 months. The cron uses this when it recomputes tiers.
export const TIER_HOLD_MONTHS = 12;

// Redemption catalog (mirrors rewards_catalog seed). Non-linear: more points
// redeemed at once unlock a better EGP rate. Target reward rate ~= 5%.
export const REDEMPTION_TIERS = [
  { pointsCost: 100, egpValue: 50 },
  { pointsCost: 500, egpValue: 250 },
  { pointsCost: 1000, egpValue: 550 },
  { pointsCost: 2000, egpValue: 1200 },
];

// Non-purchase earning actions.
export const EARN_ACTIONS = {
  review: { points: 100, monthlyCap: 4 }, // Judge.me verified buyer
  quiz: { points: 250, oncePerCustomer: true },
  signup: { points: 100, oncePerCustomer: true },
  referral: { points: 500 }, // to referrer when friend's first order is paid
  social: { points: 50, oncePerPlatform: true }, // IG / TikTok
  currentProducts: { points: 50, oncePerCustomer: true },
};

// What counts toward "eligible spend" for earning. Shipping, taxes, and gift
// cards never earn points.
export const EARN_EXCLUDES = {
  shipping: true,
  taxes: true,
  giftCards: true,
};

// Discount-code prefix for minted redemption codes.
export const REDEEM_CODE_PREFIX = "SOFIE-PTS-";

// Customer metafields we mirror summary fields into (namespace `custom`).
export const METAFIELDS = {
  namespace: "custom",
  points: { key: "loyalty_points", type: "number_integer" },
  tier: { key: "loyalty_tier", type: "single_line_text_field" },
  spend: { key: "lifetime_spend_egp", type: "number_integer" },
  profile: { key: "beauty_profile", type: "json" }, // compact profile for theme
  tips: { key: "beauty_tips", type: "json" }, // personalized tips for theme
};

// Product metafields the inference engine reads (namespace `custom`).
export const PRODUCT_METAFIELDS = {
  namespace: "custom",
  shade: "shade",
  finish: "finish",
  category: "category",
  undertone: "undertone",
};

// Referral: friend's welcome discount (minted when a referral is created).
export const REFERRAL = {
  referrerPoints: EARN_ACTIONS.referral.points, // 500
  welcomeEgp: Number(process.env.REFERRAL_WELCOME_EGP ?? 200),
  welcomeCodePrefix: "SOFIE-WELCOME-",
};

// Birthday gift entitlements per tier (the code value Klaviyo emails out).
export const BIRTHDAY = {
  insider: { egp: 0, note: "Deluxe mini with purchase in your birthday month" },
  vip: { egp: 300, note: "Choice gift + 2x points this month" },
  icon: { egp: 750, note: "Premium full-size gift + 2x points + 1:1 consultation" },
  codePrefix: "SOFIE-BDAY-",
};

// Profile fields that count toward "complete" (for the completion nudge).
export const PROFILE_COMPLETION_FIELDS = [
  "skin_type", "undertone", "skin_concerns", "foundation_shade", "lip_finish_pref",
];

// Cron auth: jobs require this shared secret in the `x-cron-key` header.
export const CRON_KEY = process.env.CRON_KEY || "";

// Staff console password (the /staff in-store lookup + redeem tool).
export const STAFF_KEY = process.env.STAFF_KEY || "";

// The shop domain (e.g. sofiestore.myshopify.com) — used by crons + the Judge.me
// webhook to obtain an offline admin client. Required for Phase 3 background jobs.
export const SHOP_DOMAIN = process.env.SHOP_DOMAIN || "";

// Judge.me webhook shared secret (set the same value in Judge.me's webhook config).
export const JUDGEME_SECRET = process.env.JUDGEME_WEBHOOK_SECRET || "";

// Trailing window for rolling-spend tier recompute.
export const ROLLING_WINDOW_DAYS = 365;

// Claude (Anthropic) tips — optional. Rules-based tips always run; Claude turns
// them into on-brand prose when enabled. Defaults to the most capable model;
// override with ANTHROPIC_MODEL (e.g. claude-haiku-4-5) to trade quality for cost.
export const TIPS = {
  useClaude: /^(1|true|yes)$/i.test(String(process.env.TIPS_USE_CLAUDE ?? "")),
  model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
  maxTokens: Number(process.env.TIPS_MAX_TOKENS ?? 700),
};

// Advisor: let Claude search the web live for current reviews/trends (costs a
// bit more per answer). Toggle off with ADVISOR_WEB_SEARCH=false.
export const ADVISOR = {
  webSearch: /^(1|true|yes)$/i.test(String(process.env.ADVISOR_WEB_SEARCH ?? "true")),
  maxSearches: Number(process.env.ADVISOR_MAX_SEARCHES ?? 3),
};
