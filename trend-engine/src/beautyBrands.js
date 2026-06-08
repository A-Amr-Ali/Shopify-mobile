// Allowlist of beauty/makeup brands you carry. "New In" only ever shows
// products whose vendor is on this list — so home, tableware, appliances and
// anything unrecognised can never appear. Add/remove freely (lowercase).
export const BEAUTY_BRANDS = new Set([
  // Prestige makeup
  "rare beauty", "huda beauty", "charlotte tilbury", "nars", "makeup by mario",
  "hourglass", "saie", "laura mercier", "glossier", "armani", "armani beauty",
  "giorgio armani", "summer fridays", "patrick ta", "refy", "rhode", "kosas",
  "merit", "natasha denona", "fenty beauty", "fenty skin", "anastasia beverly hills",
  "one/size", "one size", "onesize", "one/size beauty", "pixi", "beautyblender",
  "benefit", "benefit cosmetics", "too faced", "tarte", "milk makeup", "ilia",
  "tower 28", "westman atelier", "rms beauty", "nudestix", "jones road",
  "victoria beckham beauty", "urban decay", "smashbox", "bobbi brown", "mac",
  "nyx", "morphe", "makeup revolution", "it cosmetics", "grande cosmetics",
  "dior", "ysl", "yves saint laurent", "givenchy", "guerlain", "chanel",
  "lancome", "estee lauder", "clinique", "elizabeth arden",
  // Skin / hair / body / fragrance
  "sol de janeiro", "beija flor", "glow recipe", "supergoop", "supergoop!",
  "briogeo", "gisou", "dae", "cosrx", "drunk elephant", "the ordinary",
  "olaplex", "k18", "kayali", "ouai", "color wow", "living proof", "moroccanoil",
  "kerastase", "fresh", "tatcha", "sunday riley", "paula's choice",
  "first aid beauty", "byoma", "the inkey list", "laneige", "innisfree",
  // K-beauty (you stock a lot — COSRX etc.)
  "beauty of joseon", "anua", "medicube", "numbuzin", "skin1004", "isntree",
  "round lab", "torriden", "mixsoon", "haruharu", "axis-y", "some by mi",
  "etude", "klairs", "pyunkang yul", "dr jart", "mediheal", "abib", "one thing",
]);

const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
export const isAllowedBrand = (vendor) => BEAUTY_BRANDS.has(norm(vendor));
