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
import { fetchAllProducts, fetchProductsInCollections, tagsAdd, tagsRemove } from "./shopify.js";
import { brandNewArrivals } from "./signals/brandNewArrivals.js";
import { isBeauty } from "./nonBeauty.js";

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

async function reconcile(products, desiredIds, tag, { dryRun, removeStale = true }) {
  const desired = new Set(desiredIds);
  let added = 0, removed = 0;
  for (const p of products) {
    const want = desired.has(p.id);
    const has = hasTag(p, tag);
    if (want && !has) { console.log(`  + ${tag} → ${p.title}`); if (!dryRun) await tagsAdd(p.id, [tag]); added++; }
    else if (!want && has && removeStale) { console.log(`  - ${tag} ✕ ${p.title}`); if (!dryRun) await tagsRemove(p.id, [tag]); removed++; }
  }
  console.log(`  → ${tag}: +${added} / -${removed}${removeStale ? "" : " (add-only; feeds incomplete)"}${dryRun ? "  (dry-run, no writes)" : ""}`);
}

async function main() {
  assertConfig();
  console.log(`\n🆕 Sofie New-In brand watch  ·  store=${config.store}  ${config.dryRun ? "[DRY RUN]" : ""}`);

  // 1) Whole catalog — we filter to beauty ourselves (robust to your collection setup).
  const products = await fetchAllProducts();
  console.log(`📦 Loaded ${products.length} products (whole catalog)`);
  const idx = buildIndex(products);

  // 2) NEW IN = BEAUTY products uploaded in the last N days, in stock, newest first.
  const cutoff = Date.now() - config.storeNewDays * 864e5;
  const fresh = products
    .filter((p) =>
      p.createdAt && new Date(p.createdAt).getTime() >= cutoff &&
      !(typeof p.totalInventory === "number" && p.totalInventory <= 0) &&
      isBeauty(p))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const top = fresh.slice(0, config.maxNewIn);

  // Diagnostic: which brands are showing up as "new" (so we can verify it's clean).
  const byVendor = {};
  for (const p of fresh) byVendor[p.vendor || "?"] = (byVendor[p.vendor || "?"] || 0) + 1;
  const vendorBreakdown = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([v, n]) => `${v}:${n}`).join(", ");

  console.log(`\n🆕 New In — beauty uploaded in last ${config.storeNewDays} days (${top.length} shown of ${fresh.length} total):`);
  top.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.title}  ·  ${p.vendor}  ·  ${String(p.createdAt).slice(0, 10)}`));
  console.log(`   fresh vendors: ${vendorBreakdown || "(none found)"}`);

  // 3) Brand buying-alerts: brand launches (last N days) you DON'T carry yet.
  console.log(`\n🌐 Checking brand sites for launches you don't stock (last ${config.brandNewDays} days)…`);
  let notCarried = [];
  try {
    const { arrivals, skipped } = await brandNewArrivals({
      pages: config.brandFeedPages, limit: config.brandFeedLimit, maxAgeDays: config.brandNewDays,
    });
    if (skipped.length) console.log(`   skipped: ${skipped.join(" | ")}`);
    notCarried = arrivals.filter((a) => !matchArrival(a, idx));
  } catch (err) {
    console.warn(`   brand check skipped: ${err.message}`);
  }
  if (notCarried.length) {
    console.log(`\n🛒 Buying alerts — brand launches you don't stock yet (top 15):`);
    notCarried.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)).slice(0, 15)
      .forEach((a) => console.log(`   • ${a.brand}: ${a.title}  ${a.url}`));
  }

  // 4) Write tags — store data is reliable, so full reconcile (add new, drop old).
  console.log(`\n🏷️  Reconciling '${config.newInTag}' tags…`);
  await reconcile(products, top.map((p) => p.id), config.newInTag, { dryRun: config.dryRun, removeStale: true });

  console.log(`\n✅ Done.\n`);
}

main().catch((err) => { console.error(`\n❌ New-In watch failed: ${err.message}\n`); process.exit(1); });
