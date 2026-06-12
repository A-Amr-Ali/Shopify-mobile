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
    products(first: 4, query: $q) {
      edges { node {
        id title handle
        featuredImage { url }
        variants(first: 1) { edges { node { id price availableForSale } } }
      } }
    }
  }`;

const BEST_SELLERS = `
  query Best {
    products(first: 8, sortKey: UPDATED_AT, reverse: true) {
      edges { node {
        id title handle
        featuredImage { url }
        variants(first: 1) { edges { node { id price availableForSale } } }
      } }
    }
  }`;

function toCard(node) {
  const v = node.variants?.edges?.[0]?.node;
  if (!v || v.availableForSale === false) return null;
  return {
    title: node.title,
    handle: node.handle,
    image: node.featuredImage?.url || null,
    price: v.price,
    variantId: String(v.id).replace(/\D/g, ""), // numeric for /cart/add.js
  };
}

/** Search the catalog for each keyword; return up to `limit` unique in-stock cards. */
export async function searchByKeywords(admin, keywords, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const kw of keywords) {
    if (out.length >= limit) break;
    try {
      const res = await admin.graphql(QUERY, { variables: { q: kw } });
      const body = await res.json();
      if (body?.errors) console.warn(`recommendations "${kw}" GraphQL: ${JSON.stringify(body.errors)}`);
      for (const e of body?.data?.products?.edges || []) {
        if (seen.has(e.node.id)) continue;
        const card = toCard(e.node);
        if (!card) continue;
        seen.add(e.node.id);
        out.push({ ...card, reason: kw });
        if (out.length >= limit) break;
      }
    } catch (err) {
      console.warn(`recommendations "${kw}": ${err.message}`);
    }
  }
  return out;
}

/** Top best-sellers — the fallback when a profile yields no keyword matches. */
export async function bestSellers(admin, limit = 8) {
  try {
    const res = await admin.graphql(BEST_SELLERS);
    const body = await res.json();
    if (body?.errors) console.warn(`best-sellers GraphQL: ${JSON.stringify(body.errors)}`);
    const out = [];
    for (const e of body?.data?.products?.edges || []) {
      const card = toCard(e.node);
      if (card) out.push(card);
      if (out.length >= limit) break;
    }
    return out;
  } catch (err) {
    console.warn(`best-sellers: ${err.message}`);
    return [];
  }
}

/**
 * Products matched to a profile, with a best-seller fallback so the row is never
 * empty for a logged-in customer.
 */
export async function fetchRecommendations(admin, profile, limit = 8) {
  const keywords = buildKeywords(profile);
  let out = keywords.length ? await searchByKeywords(admin, keywords, limit) : [];
  if (out.length < 3) {
    const fill = await bestSellers(admin, limit);
    const seen = new Set(out.map((p) => p.variantId));
    for (const p of fill) { if (!seen.has(p.variantId)) { out.push(p); seen.add(p.variantId); } if (out.length >= limit) break; }
  }
  return out;
}
