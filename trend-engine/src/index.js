// Sofie Trend Engine — orchestrator.
// Blends Google Trends (Egypt) + manual TikTok/IG feed + live sales velocity,
// matches to your catalog, and reconciles the `trending` / `bestseller` tags.
// Your homepage's automated collections (tag = trending / bestseller) then
// update themselves. Safe by default: run with DRY_RUN=true to preview.
import { config, assertConfig } from "./config.js";
import { fetchAllProducts, fetchProductsInCollections, tagsAdd, tagsRemove } from "./shopify.js";
import { buildKeywordUniverse } from "./keywords.js";
import { googleTrendsScores, googleDailyTrendTerms } from "./signals/googleTrends.js";
import { manualScores } from "./signals/manual.js";
import { salesVelocityScores } from "./signals/salesVelocity.js";
import { scoreProducts, rankBestSellers } from "./match.js";

const hasTag = (p, tag) => (p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase());

async function reconcileTag(products, desiredIds, tag, { dryRun, removeStale = true }) {
  const desired = new Set(desiredIds);
  let added = 0, removed = 0;
  for (const p of products) {
    const want = desired.has(p.id);
    const has = hasTag(p, tag);
    if (want && !has) {
      console.log(`  + ${tag.padEnd(10)} → ${p.title}`);
      if (!dryRun) await tagsAdd(p.id, [tag]);
      added++;
    } else if (!want && has && removeStale) {
      console.log(`  - ${tag.padEnd(10)} ✕ ${p.title}`);
      if (!dryRun) await tagsRemove(p.id, [tag]);
      removed++;
    }
  }
  console.log(`  → ${tag}: +${added} / -${removed}${removeStale ? "" : "  (add-only; signal weak, kept existing)"}${dryRun ? "  (dry-run, no writes)" : ""}`);
}

async function main() {
  assertConfig();
  console.log(`\n🌷 Sofie Trend Engine  ·  store=${config.store}  geo=${config.geo || "worldwide"}  ${config.dryRun ? "[DRY RUN]" : ""}`);

  // 1) Catalog — scoped to beauty collections when configured.
  const products = config.collections.length
    ? await fetchProductsInCollections(config.collections)
    : await fetchAllProducts();
  console.log(
    `📦 Loaded ${products.length} products` +
      (config.collections.length ? ` from collections: ${config.collections.join(", ")}` : " (whole catalog)")
  );
  // Only tag products that can actually appear on the storefront.
  const sellable = products.filter((p) => p.publishedAt && p.status === "ACTIVE");
  console.log(`   sellable (active + published): ${sellable.length}`);
  const vendors = [...new Set(sellable.map((p) => p.vendor).filter(Boolean))];
  const keywords = buildKeywordUniverse(vendors, { minLen: config.minKeywordLen });

  // 2) Signals (each one is resilient; failures degrade gracefully)
  console.log(`📈 Gathering signals…`);
  const [googleScores, manual, salesScores, dailyTerms] = await Promise.all([
    config.weights.google > 0 ? googleTrendsScores(keywords, { geo: config.geo }) : new Map(),
    config.weights.manual > 0 ? manualScores() : new Map(),
    config.weights.sales > 0 ? salesVelocityScores(config.salesLookbackDays) : new Map(),
    googleDailyTrendTerms({ geo: config.geo }),
  ]);
  console.log(`   google:${googleScores.size}  manual:${manual.size}  sales:${salesScores.size}  daily:${dailyTerms.length}`);

  // Safeguard: if every signal is empty (e.g. Google Trends API was down),
  // do NOT wipe existing tags — keep what's there until a good run.
  const signalsPresent = googleScores.size > 0 || manual.size > 0 || salesScores.size > 0;
  if (!signalsPresent) {
    console.log(`\n⚠️  No signals available this run — keeping existing tags untouched.`);
  }

  // 3) Rank — then diversify so no single brand floods Trending.
  const rankedTrending = scoreProducts(sellable, {
    googleScores, manualScores: manual, salesScores, dailyTerms,
    weights: config.weights, minKeywordLen: config.minKeywordLen,
  });
  const maxPerVendor = config.maxPerVendor;
  const vendorCount = {};
  const trending = [];
  for (const r of rankedTrending) {
    const v = (r.product.vendor || "?").toLowerCase();
    if ((vendorCount[v] || 0) >= maxPerVendor) continue;
    vendorCount[v] = (vendorCount[v] || 0) + 1;
    trending.push(r);
    if (trending.length >= config.maxTrending) break;
  }

  const bestsellers = rankBestSellers(sellable, salesScores).slice(0, config.maxBestsellers);

  console.log(`\n🔥 Trending (${trending.length}):`);
  trending.forEach((r, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${r.product.title}  ·  ${r.score.toFixed(3)}  ${JSON.stringify(r.reasons)}`));

  console.log(`\n⭐ Best sellers (${bestsellers.length}):`);
  bestsellers.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. ${r.product.title}  ·  ${r.score.toFixed(3)}`));

  // 4) Reconcile tags (never remove when signals were empty)
  console.log(`\n🏷️  Reconciling tags…`);
  await reconcileTag(products, trending.map((r) => r.product.id), config.trendTag, { dryRun: config.dryRun, removeStale: signalsPresent });
  if (config.weights.sales > 0 && bestsellers.length) {
    await reconcileTag(products, bestsellers.map((r) => r.product.id), config.bestsellerTag, config);
  } else {
    console.log(`  (best-seller tagging skipped — rely on Shopify "Best selling" sort, or enable read_orders)`);
  }

  console.log(`\n✅ Done.\n`);
}

main().catch((err) => {
  console.error(`\n❌ Trend engine failed: ${err.message}\n`);
  process.exit(1);
});
