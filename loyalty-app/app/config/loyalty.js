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
};
