// Sofie "New In" brand-watch.
// Reads each brand's newest launches from their public feed, matches them to
// products you ALREADY stock, and tags those `new-in`. Brand launches you do
// NOT carry are listed as buying alerts. Refreshes daily. Safe by default
// (DRY_RUN=true previews without writing).
//
// HONEST LIMITS: only brands on a readable (Shopify) platform can be watched;
// others (Charlotte Tilbury, NARS, …) are skipped. Sites may block us at any
// time — when that happens the brand is skipped, never faked.
import { config, assertConfig } from "./config.js";
import { fetchAllProducts, tagsAdd, tagsRemove } from "./shopify.js";
import { brandNewArrivals } from "./signals/brandNewArrivals.js";

const normTitle = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normVendor = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hasTag = (p, tag) => (p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase());

function buildIndex(products) {
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

// Find the store product that matches a brand arrival (exact title, else a
// vendor-scoped contains match to catch minor naming differences).
function matchArrival(arrival, idx) {
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

async function reconcile(products, desiredIds, tag, { dryRun }) {
  const desired = new Set(desiredIds);
  let added = 0, removed = 0;
  for (const p of products) {
    const want = desired.has(p.id);
    const has = hasTag(p, tag);
    if (want && !has) { console.log(`  + ${tag} → ${p.title}`); if (!dryRun) await tagsAdd(p.id, [tag]); added++; }
    else if (!want && has) { console.log(`  - ${tag} ✕ ${p.title}`); if (!dryRun) await tagsRemove(p.id, [tag]); removed++; }
  }
  console.log(`  → ${tag}: +${added} / -${removed}${dryRun ? "  (dry-run, no writes)" : ""}`);
}

async function main() {
  assertConfig();
  console.log(`\n🆕 Sofie New-In brand watch  ·  store=${config.store}  ${config.dryRun ? "[DRY RUN]" : ""}`);

  // 1) Your catalog
  const products = await fetchAllProducts();
  console.log(`📦 Loaded ${products.length} store products`);
  const idx = buildIndex(products);

  // 2) Brand newest launches
  console.log(`🌐 Reading brand sites…`);
  const { arrivals, readBrands, skipped } = await brandNewArrivals({
    pages: config.brandFeedPages, limit: config.brandFeedLimit,
  });
  console.log(`   read: ${readBrands.join(", ") || "none"}`);
  if (skipped.length) console.log(`   skipped: ${skipped.join(" | ")}`);

  // Safeguard: if NO brand feed was readable, do nothing (don't wipe tags).
  if (readBrands.length === 0) {
    console.log(`\n⚠️  No brand feeds were readable this run — leaving existing '${config.newInTag}' tags untouched.\n`);
    return;
  }

  // 3) Match brand arrivals → products you stock
  const matched = [];
  const notCarried = [];
  const seen = new Set();
  for (const a of arrivals) {
    const p = matchArrival(a, idx);
    if (p) {
      if (!seen.has(p.id)) { seen.add(p.id); matched.push({ p, a }); }
    } else {
      notCarried.push(a);
    }
  }
  // Newest first, cap.
  matched.sort((x, y) => new Date(y.a.createdAt) - new Date(x.a.createdAt));
  const top = matched.slice(0, config.maxNewIn);

  console.log(`\n🆕 New In — in your store (${top.length}):`);
  top.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.p.title}  ·  ${m.a.brand}  ·  launched ${String(m.a.createdAt).slice(0, 10)}`));

  console.log(`\n🛒 Brand launches you DON'T carry yet (buying alerts, top 15):`);
  notCarried
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
    .slice(0, 15)
    .forEach((a) => console.log(`   • ${a.brand}: ${a.title}  ${a.url}`));

  // 4) Write tags
  console.log(`\n🏷️  Reconciling '${config.newInTag}' tags…`);
  await reconcile(products, top.map((m) => m.p.id), config.newInTag, config);

  console.log(`\n✅ Done.\n`);
}

main().catch((err) => { console.error(`\n❌ New-In watch failed: ${err.message}\n`); process.exit(1); });
