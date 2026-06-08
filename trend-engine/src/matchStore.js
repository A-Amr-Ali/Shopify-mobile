// Shared matcher: build an index of store products and match a brand arrival
// (from a brand's live feed) to a product you actually stock. Used by both the
// New-In and Trend engines so brand launches you carry can be tagged.
const normTitle = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normVendor = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function buildStoreIndex(products) {
  const byTitle = new Map();
  const byVendor = new Map();
  for (const p of products) {
    const t = normTitle(p.title);
    if (t && !byTitle.has(t)) byTitle.set(t, p);
    const v = normVendor(p.vendor);
    if (v) (byVendor.get(v) || byVendor.set(v, []).get(v)).push(p);
  }
  return { byTitle, byVendor };
}

export function matchArrival(arrival, idx) {
  const at = normTitle(arrival.title);
  if (!at) return null;
  if (idx.byTitle.has(at)) return idx.byTitle.get(at);
  const candidates = idx.byVendor.get(normVendor(arrival.brand)) || idx.byVendor.get(normVendor(arrival.vendor)) || [];
  for (const p of candidates) {
    const pt = normTitle(p.title);
    if (!pt) continue;
    if (pt.includes(at) || at.includes(pt)) return p;
  }
  return null;
}
