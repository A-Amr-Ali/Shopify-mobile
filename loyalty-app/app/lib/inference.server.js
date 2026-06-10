// Infer a beauty profile from order history. HYBRID: prefer product metafields
// (custom.shade / finish / category / undertone); fall back to parsing the
// product title + variant when metafields are absent. Pure parsers are unit-
// tested; the Admin-API reader composes them.
import { PRODUCT_METAFIELDS } from "../config/loyalty.js";

const FINISHES = ["matte", "satin", "dewy", "luminous", "natural", "shimmer", "metallic", "velvet", "glossy", "radiant"];
const WARM_HINTS = ["warm", "golden", "honey", "caramel", "peach", "tan", "olive"];
const COOL_HINTS = ["cool", "rose", "pink", "porcelain", "ivory", "fair cool"];

const lc = (s) => String(s || "").toLowerCase();

/** Pull a finish keyword from any text (title/variant/metafield). */
export function parseFinish(text) {
  const t = lc(text);
  return FINISHES.find((f) => t.includes(f)) || null;
}

/** Guess undertone from a shade name. */
export function parseUndertone(text) {
  const t = lc(text);
  if (WARM_HINTS.some((h) => t.includes(h))) return "warm";
  if (COOL_HINTS.some((h) => t.includes(h))) return "cool";
  if (t.includes("neutral")) return "neutral";
  return null;
}

/** Read a product's custom metafields into {shade, finish, category, undertone}. */
export function metafieldsToSignals(metafieldEdges = []) {
  const out = {};
  for (const e of metafieldEdges) {
    const n = e.node ?? e;
    if (n.key === PRODUCT_METAFIELDS.shade) out.shade = n.value;
    else if (n.key === PRODUCT_METAFIELDS.finish) out.finish = n.value;
    else if (n.key === PRODUCT_METAFIELDS.category) out.category = n.value;
    else if (n.key === PRODUCT_METAFIELDS.undertone) out.undertone = n.value;
  }
  return out;
}

/** Combine metafield signals with title/variant parsing (metafields win). */
export function signalsForLineItem({ title, variantTitle, vendor, metafields, category }) {
  const mf = metafieldsToSignals(metafields);
  const text = `${title || ""} ${variantTitle || ""}`;
  const shade = mf.shade || variantTitle || null;
  return {
    brand: vendor || null,
    product: title || null,
    shade,
    finish: mf.finish || parseFinish(text),
    category: mf.category || category || null,
    undertone: mf.undertone || parseUndertone(shade || text),
  };
}

/** Reduce many line-item signals into a partial profile. */
export function buildInferredProfile(signalList) {
  const current_products = [];
  const finishes = {};
  const undertones = {};
  let foundation_shade = null, foundation_brand = null;

  for (const s of signalList) {
    if (s.brand && s.product) {
      current_products.push({ brand: s.brand, product: s.product, shade: s.shade ?? null });
    }
    if (s.finish) finishes[s.finish] = (finishes[s.finish] || 0) + 1;
    if (s.undertone) undertones[s.undertone] = (undertones[s.undertone] || 0) + 1;
    const cat = lc(s.category);
    const prod = lc(s.product);
    if (!foundation_shade && (cat.includes("foundation") || prod.includes("foundation")) && s.shade) {
      foundation_shade = s.shade; foundation_brand = s.brand;
    }
  }

  const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const profile = { current_products };
  if (foundation_shade) { profile.foundation_shade = foundation_shade; profile.foundation_brand = foundation_brand; }
  const lipFinish = top(finishes);
  if (lipFinish) profile.lip_finish_pref = lipFinish;
  const undertone = top(undertones);
  if (undertone) profile.undertone = undertone;
  return profile;
}

const ORDERS_QUERY = `
  query CustomerOrders($id: ID!) {
    customer(id: $id) {
      orders(first: 30, sortKey: CREATED_AT, reverse: true) {
        edges { node { lineItems(first: 25) { edges { node {
          title
          variantTitle
          vendor
          product {
            productType
            metafields(first: 10, namespace: "${PRODUCT_METAFIELDS.namespace}") {
              edges { node { key value } }
            }
          }
        } } } } }
      }
    }
  }`;

/** Read order history via Admin API and return a partial inferred profile. */
export async function inferProfileFromOrders(admin, customerId) {
  const res = await admin.graphql(ORDERS_QUERY, { variables: { id: customerId } });
  const body = await res.json();
  const orders = body?.data?.customer?.orders?.edges ?? [];
  const signals = [];
  for (const o of orders) {
    for (const li of o.node.lineItems.edges) {
      const n = li.node;
      signals.push(signalsForLineItem({
        title: n.title,
        variantTitle: n.variantTitle,
        vendor: n.vendor,
        metafields: n.product?.metafields?.edges ?? [],
        category: n.product?.productType,
      }));
    }
  }
  return buildInferredProfile(signals);
}
