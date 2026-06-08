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
import { isAllowedBrand } from "./beautyBrands.js";
import { buildStoreIndex, matchArrival } from "./matchStore.js";

const hasTag = (p, tag) => (p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase());
const buildIndex = buildStoreIndex;

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

  // 2) SOURCE A — LIVE official stores: brand launches (last N days) you STOCK.
  console.log(`\n🌐 Reading live official stores (launches in last ${config.brandNewDays} days)…`);
  const matchedBrand = new Map(); // id -> { p, when, source }
  let notCarried = [];
  let liveOk = false;
  try {
    const { arrivals, readBrands, skipped } = await brandNewArrivals({
      pages: config.brandFeedPages, limit: config.brandFeedLimit, maxAgeDays: config.brandNewDays,
    });
    liveOk = readBrands.length > 0;
    if (readBrands.length) console.log(`   live: ${readBrands.join(", ")}`);
    if (skipped.length) console.log(`   skipped: ${skipped.join(" | ")}`);
    for (const a of arrivals) {
      const p = matchArrival(a, idx);
      const live = p && p.publishedAt && p.status === "ACTIVE" && !(typeof p.totalInventory === "number" && p.totalInventory <= 0);
      if (live) {
        if (!matchedBrand.has(p.id)) matchedBrand.set(p.id, { p, when: p.createdAt || a.createdAt, source: `LIVE ${a.brand}` });
      } else if (!p) {
        notCarried.push(a);
      }
    }
  } catch (err) {
    console.warn(`   live brand read skipped: ${err.message}`);
  }

  // 3) SOURCE B — your recently-uploaded beauty-brand products (allowlist), in stock.
  const cutoff = Date.now() - config.storeNewDays * 864e5;
  const freshStore = products.filter((p) =>
    p.createdAt && new Date(p.createdAt).getTime() >= cutoff &&
    p.publishedAt && p.status === "ACTIVE" &&
    !(typeof p.totalInventory === "number" && p.totalInventory <= 0) &&
    isAllowedBrand(p.vendor));

  // 4) Combine BOTH sources → New In (live brand matches first, then recent uploads).
  const picks = new Map();
  for (const [id, m] of matchedBrand) picks.set(id, m);
  for (const p of freshStore) {
    if (!picks.has(p.id)) picks.set(p.id, { p, when: p.createdAt, source: `uploaded ${config.storeNewDays}d` });
  }
  const top = [...picks.values()].sort((x, y) => new Date(y.when) - new Date(x.when)).slice(0, config.maxNewIn);

  console.log(`\n🆕 New In (${top.length}) — live brand matches: ${matchedBrand.size}, recent uploads: ${freshStore.length}`);
  top.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.p.title}  ·  ${m.p.vendor}  ·  ${m.source}  ·  ${String(m.when).slice(0, 10)}`));

  if (notCarried.length) {
    console.log(`\n🛒 Buying alerts — live brand launches you don't stock yet (top 15):`);
    notCarried.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)).slice(0, 15)
      .forEach((a) => console.log(`   • ${a.brand}: ${a.title}  ${a.url}`));
  }

  // 5) Write tags. Always safe to add; only drop stale when we have store-side data.
  console.log(`\n🏷️  Reconciling '${config.newInTag}' tags…`);
  await reconcile(products, top.map((m) => m.p.id), config.newInTag, { dryRun: config.dryRun, removeStale: true });

  console.log(`\n✅ Done.\n`);
}

main().catch((err) => { console.error(`\n❌ New-In watch failed: ${err.message}\n`); process.exit(1); });
