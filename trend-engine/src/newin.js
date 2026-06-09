// Sofie "New In" brand-watch.
// Reads each brand's newest launches from their public feed, matches them to
// products you ALREADY stock, and tags those `new-in`. Brand launches you do
// NOT carry are listed as buying alerts. Refreshes daily. Safe by default
// (DRY_RUN=true previews without writing).
//
// HONEST LIMITS: only brands on a readable (Shopify) platform can be watched;
// others (Charlotte Tilbury, NARS, …) are skipped. Sites may block us at any
// time — when that happens the brand is skipped, never faked.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config, assertConfig } from "./config.js";
import { fetchAllProducts, fetchProductsInCollections, tagsAdd, tagsRemove } from "./shopify.js";
import { brandNewArrivals } from "./signals/brandNewArrivals.js";
import { isAllowedBrand } from "./beautyBrands.js";
import { buildStoreIndex, matchArrival } from "./matchStore.js";
import { brandBestsellers } from "./signals/brandBestsellers.js";

const hasTag = (p, tag) => (p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase());
const buildIndex = buildStoreIndex;

// Rewrite the repo's BUYING-ALERTS.md so the file is always current. Grouped by
// brand, newest first. Called every run; the workflow commits it back if changed.
async function writeBuyingAlerts(notCarried, { readBrands, skipped }) {
  const here = dirname(fileURLToPath(import.meta.url));        // trend-engine/src
  const out = resolve(here, "../../BUYING-ALERTS.md");          // repo root
  const today = new Date().toISOString().slice(0, 10);

  // Group launches by brand, newest first within each group.
  const byBrand = new Map();
  for (const a of notCarried) {
    if (!byBrand.has(a.brand)) byBrand.set(a.brand, []);
    byBrand.get(a.brand).push(a);
  }
  const sortedBrands = [...byBrand.entries()].sort((x, y) => {
    const ny = Math.max(...y[1].map((a) => +new Date(a.createdAt) || 0));
    const nx = Math.max(...x[1].map((a) => +new Date(a.createdAt) || 0));
    return ny - nx;
  });

  const lines = [];
  lines.push("# 🛒 Sofie's — Buying Alerts");
  lines.push("");
  lines.push("**Brand launches on official stores that you DON'T stock yet.**");
  lines.push(`Auto-generated ${today} · refreshes automatically every day via the New-In engine.`);
  lines.push("");
  lines.push("> These are new products the brands just launched (read live from their official");
  lines.push("> sites) that aren't in your catalog. Review and decide what to order.");
  lines.push("");
  lines.push("---");

  if (!sortedBrands.length) {
    lines.push("");
    lines.push("_No new un-stocked launches detected in the latest run._");
  } else {
    for (const [brand, items] of sortedBrands) {
      lines.push("");
      lines.push(`## ✨ ${brand}`);
      const seen = new Set();
      for (const a of items.sort((p, q) => new Date(q.createdAt) - new Date(p.createdAt))) {
        if (seen.has(a.url)) continue;
        seen.add(a.url);
        lines.push(`- **${a.title}** — ${a.url}`);
      }
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("### Notes");
  if (readBrands && readBrands.length) {
    lines.push(`- Brands we read live this run: ${readBrands.join(", ")}.`);
  }
  if (skipped && skipped.length) {
    lines.push(`- Brands we couldn't read (not on a public platform): ${skipped.join(", ")}.`);
  }
  lines.push('- The full, always-current list is also in **GitHub → Actions → "Sofie New-In Brand Watch" → latest run → "Run new-in watch" step → 🛒 Buying alerts**.');
  lines.push("");

  await writeFile(out, lines.join("\n"), "utf8");
  console.log(`\n📝 Wrote ${out} (${sortedBrands.length} brand${sortedBrands.length === 1 ? "" : "s"}).`);
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

  // 2) SOURCE A — LIVE official stores: brand launches (last N days) you STOCK.
  console.log(`\n🌐 Reading live official stores (launches in last ${config.brandNewDays} days)…`);
  const matchedBrand = new Map(); // id -> { p, when, source }
  let notCarried = [];
  let liveOk = false;
  let readBrands = [], skipped = [];
  try {
    const res = await brandNewArrivals({
      pages: config.brandFeedPages, limit: config.brandFeedLimit, maxAgeDays: config.brandNewDays,
    });
    const arrivals = res.arrivals;
    readBrands = res.readBrands;
    skipped = res.skipped;
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

  // 2b) Brand BEST-SELLERS (rhode / One/Size …) you stock → always feature.
  try {
    const best = await brandBestsellers();
    for (const b of best) {
      const p = matchArrival(b, idx);
      const ok = p && p.publishedAt && p.status === "ACTIVE" && !(typeof p.totalInventory === "number" && p.totalInventory <= 0);
      if (ok && !matchedBrand.has(p.id)) {
        matchedBrand.set(p.id, { p, when: p.createdAt || new Date().toISOString(), source: `BEST ${b.brand}` });
      }
    }
  } catch (err) {
    console.warn(`   brand best-seller check skipped: ${err.message}`);
  }

  // 3) SOURCE B — your recently-uploaded beauty-brand products (allowlist), in stock.
  const cutoff = Date.now() - config.storeNewDays * 864e5;
  const freshStore = products.filter((p) =>
    p.createdAt && new Date(p.createdAt).getTime() >= cutoff &&
    p.publishedAt && p.status === "ACTIVE" &&
    !(typeof p.totalInventory === "number" && p.totalInventory <= 0) &&
    isAllowedBrand(p.vendor));

  // 4) Combine → New In. Brand picks (launches + best-sellers) ALWAYS first,
  // then recent uploads by date. Best-sellers have old upload dates, so they
  // must not be date-sorted against fresh uploads (or they'd sink off the list).
  const brandArr = [...matchedBrand.values()].sort((x, y) => new Date(y.when) - new Date(x.when));
  const used = new Set(brandArr.map((m) => m.p.id));
  const freshArr = freshStore
    .filter((p) => !used.has(p.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((p) => ({ p, when: p.createdAt, source: `uploaded ${config.storeNewDays}d` }));
  const top = [...brandArr, ...freshArr].slice(0, config.maxNewIn);

  console.log(`\n🆕 New In (${top.length}) — live brand matches: ${matchedBrand.size}, recent uploads: ${freshStore.length}`);
  top.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.p.title}  ·  ${m.p.vendor}  ·  ${m.source}  ·  ${String(m.when).slice(0, 10)}`));

  if (notCarried.length) {
    console.log(`\n🛒 Buying alerts — live brand launches you don't stock yet (top 15):`);
    notCarried.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)).slice(0, 15)
      .forEach((a) => console.log(`   • ${a.brand}: ${a.title}  ${a.url}`));
  }

  // Rewrite BUYING-ALERTS.md so the repo file is always current (workflow commits it).
  // Only refresh when we actually read brands live, so a transient fetch outage
  // never blanks the file.
  if (liveOk) {
    try {
      await writeBuyingAlerts(notCarried, { readBrands, skipped });
    } catch (err) {
      console.warn(`   buying-alerts file write skipped: ${err.message}`);
    }
  } else {
    console.log(`\n📝 Skipped BUYING-ALERTS.md refresh (no brands read live this run).`);
  }

  // 5) Write tags. Always safe to add; only drop stale when we have store-side data.
  console.log(`\n🏷️  Reconciling '${config.newInTag}' tags…`);
  await reconcile(products, top.map((m) => m.p.id), config.newInTag, { dryRun: config.dryRun, removeStale: true });

  console.log(`\n✅ Done.\n`);
}

main().catch((err) => { console.error(`\n❌ New-In watch failed: ${err.message}\n`); process.exit(1); });
