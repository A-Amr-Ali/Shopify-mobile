// Turn a customer's beauty profile (from the quiz) into real product
// recommendations they can add to cart. buildKeywords is pure + unit-tested;
// fetchRecommendations runs the catalog search via the Admin API.

// skin concern -> a catalog search term.
const CONCERN_TERMS = {
  acne: "blemish",
  "dark spots": "brightening",
  "large pores": "pore",
  redness: "calming",
  "fine lines": "anti-aging",
  dryness: "hydrating",
  dullness: "glow",
};

const SKIN_TERMS = {
  dry: ["hydrating", "moisturizer"],
  oily: ["oil-free", "mattifying"],
  combo: ["balancing"],
  normal: ["radiance"],
  sensitive: ["soothing"],
};

/** Pure: profile -> ordered list of catalog search keywords (deduped). */
export function buildKeywords(profile) {
  if (!profile) return [];
  const kws = [];
  const push = (k) => { if (k && !kws.includes(k)) kws.push(k); };

  (SKIN_TERMS[profile.skin_type] || []).forEach(push);
  if (profile.lip_finish_pref) push(`${profile.lip_finish_pref} lip`);
  if (profile.undertone) push(`${profile.undertone} foundation`);
  for (const c of profile.skin_concerns || []) {
    const t = CONCERN_TERMS[String(c).toLowerCase()];
    if (t) push(t);
  }
  // Favourite brands the customer already uses → more of what they love.
  for (const p of profile.current_products || []) {
    if (p?.brand) push(p.brand);
  }
  return kws.slice(0, 6);
}

const QUERY = `
  query Reco($q: String!) {
    products(first: 4, query: $q, sortKey: BEST_SELLING) {
      edges { node {
        id title handle
        featuredImage { url(transform: { maxWidth: 400 }) }
        variants(first: 1) { edges { node { id price availableForSale } } }
      } }
    }
  }`;

/**
 * Search the catalog for each keyword and return up to `limit` unique, in-stock
 * products shaped for the storefront (numeric variant id for /cart/add.js).
 */
export async function fetchRecommendations(admin, profile, limit = 8) {
  const keywords = buildKeywords(profile);
  const seen = new Set();
  const out = [];
  for (const kw of keywords) {
    if (out.length >= limit) break;
    try {
      const res = await admin.graphql(QUERY, { variables: { q: kw } });
      const body = await res.json();
      for (const e of body?.data?.products?.edges || []) {
        const n = e.node;
        if (seen.has(n.id)) continue;
        const v = n.variants?.edges?.[0]?.node;
        if (!v || v.availableForSale === false) continue;
        seen.add(n.id);
        out.push({
          title: n.title,
          handle: n.handle,
          image: n.featuredImage?.url || null,
          price: v.price,
          variantId: String(v.id).replace(/\D/g, ""), // numeric for /cart/add.js
          reason: kw,
        });
        if (out.length >= limit) break;
      }
    } catch (err) {
      console.warn(`recommendations "${kw}": ${err.message}`);
    }
  }
  return out;
}
