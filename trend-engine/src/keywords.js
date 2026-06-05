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

export function buildKeywordUniverse(storeVendors = []) {
  const set = new Map(); // lowercased -> original
  const add = (k) => {
    const key = k.trim().toLowerCase();
    if (key && !set.has(key)) set.set(key, k.trim());
  };
  BRAND_KEYWORDS.forEach(add);
  PRODUCT_KEYWORDS.forEach(add);
  storeVendors.forEach(add);
  return [...set.values()];
}
