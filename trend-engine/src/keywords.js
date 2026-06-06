// Beauty keyword universe used for Google Trends queries and product matching.
// Brands are auto-augmented at runtime with your real store vendors.

export const BRAND_KEYWORDS = [
  "Rare Beauty",
  "Huda Beauty",
  "Charlotte Tilbury",
  "NARS",
  "Makeup by Mario",
  "Hourglass",
  "Laura Mercier",
  "Glossier",
  "Saie",
  "Summer Fridays",
  "Patrick Ta",
  "REFY",
  "Armani Beauty",
];

// Product-type / viral-format keywords that spike on TikTok & Instagram.
export const PRODUCT_KEYWORDS = [
  "liquid blush",
  "lip oil",
  "lip liner",
  "setting spray",
  "loose powder",
  "cream blush",
  "lip gloss",
  "concealer",
  "bronzer drops",
  "highlighter",
  "brow gel",
  "mascara",
];

// A stable, always-popular anchor term so Google Trends scores are comparable
// across separate batched requests (Trends normalises 0–100 *within* a request).
export const ANCHOR_KEYWORD = "makeup";

// Generic words that would match too many products — never used as keywords.
export const STOPWORDS = new Set([
  "beauty", "makeup", "cosmetics", "the", "and", "set", "kit", "mini",
  "new", "gift", "home", "samsung", "lg", "bosch", "tcl", "tornado",
  // ambiguous generic English words that are also brand names (inflate on Google Trends)
  "fresh",
]);

export function buildKeywordUniverse(storeVendors = [], { minLen = 4 } = {}) {
  const set = new Map(); // lowercased -> original
  const add = (k) => {
    const orig = (k || "").trim();
    const key = orig.toLowerCase();
    // Reject too-short or generic tokens that cause false matches (e.g. "g").
    if (key.length < minLen) return;
    if (STOPWORDS.has(key)) return;
    if (!set.has(key)) set.set(key, orig);
  };
  BRAND_KEYWORDS.forEach(add);
  PRODUCT_KEYWORDS.forEach(add);
  storeVendors.forEach(add);
  return [...set.values()];
}
