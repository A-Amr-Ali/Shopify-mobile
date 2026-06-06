// Non-beauty exclusions so "New In" stays makeup/beauty only.
// Your store also sells home appliances etc.; we exclude those by vendor
// (exact, normalised) and by product-type keywords (substring). Edit freely.

export const EXCLUDE_VENDORS = new Set([
  "samsung", "lg", "bosch", "tcl", "tornado", "toshiba", "sharp", "zanussi",
  "kiriazi", "beko", "daikin", "carrier", "unionaire", "white whale",
  "white point", "general electric", "electrolux", "hoover", "ariston",
  "indesit", "midea", "gree", "haier", "panasonic", "sony", "kenwood",
  "moulinex", "black decker", "delonghi", "nespresso", "dolce gusto",
  "kenwood", "national", "fresh electric", "elaraby", "elba", "candy",
]);

// If a product's type contains any of these, treat it as non-beauty.
export const EXCLUDE_TYPE_KEYWORDS = [
  "refriger", "freezer", "fridge", "washing", "washer", "dryer", "television",
  "tv", "air condition", "air-condition", "ac ", "microwave", "oven", "cooker",
  "heater", "water heater", "vacuum", "dishwasher", "blender", "mixer",
  "kettle", "iron", "fan", "deep freezer", "chest freezer", "dispenser",
  "kitchen", "appliance", "electronics", "mobile", "laptop", "tablet",
  "headphone", "speaker", "sofa", "mattress", "bed", "furniture", "curtain",
  "carpet", "cookware", "pan", "pot",
];

const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

export function isBeauty(product) {
  if (EXCLUDE_VENDORS.has(norm(product.vendor))) return false;
  const t = norm(product.productType);
  if (t && EXCLUDE_TYPE_KEYWORDS.some((k) => t.includes(k))) return false;
  return true;
}
