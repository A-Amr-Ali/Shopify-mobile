// Brand audit — shows which official brand stores we can read LIVE right now,
// and the newest products from each. Read-only; no Shopify token needed.
import { brandNewArrivals } from "./signals/brandNewArrivals.js";
import { BRAND_SOURCES } from "./brandSources.js";

console.log(`\n🔎 Sofie — Live Official-Store Audit\n`);
console.log(`Configured brand sources: ${BRAND_SOURCES.length}\n`);

const { arrivals, readBrands, skipped } = await brandNewArrivals({ pages: 2, limit: 200, maxAgeDays: 0 });

// Group newest arrivals by brand.
const byBrand = new Map();
for (const a of arrivals) {
  if (!byBrand.has(a.brand)) byBrand.set(a.brand, []);
  byBrand.get(a.brand).push(a);
}

console.log(`✅ LIVE official stores we CAN read (${byBrand.size}):\n`);
for (const [brand, list] of byBrand) {
  list.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
  console.log(`• ${brand} — ${list.length} products read. Newest:`);
  list.slice(0, 5).forEach((p) =>
    console.log(`     - ${p.title}  (${String(p.createdAt).slice(0, 10)})  ${p.url}`));
  console.log("");
}

console.log(`\n⛔ NOT readable (blocked or non-Shopify platform):\n   ${skipped.join("\n   ") || "none"}\n`);
console.log(`Summary: readable=[${readBrands.join(", ") || "none"}]\n`);
