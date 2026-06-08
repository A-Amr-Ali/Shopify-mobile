// SEO audit (read-only). Reports the on-page SEO health of every product so we
// know exactly what to fix: missing/short/long meta, thin descriptions, missing
// alt text, duplicate titles. Writes nothing.
import { assertConfig } from "./config.js";
import { fetchProductsSeo } from "./shopify.js";

assertConfig();
console.log(`\n🔍 Sofie — Product SEO Audit\n`);

const items = await fetchProductsSeo();
const total = items.length;
const active = items.filter((p) => p.status === "ACTIVE" && p.published);

const pct = (n) => `${n} (${((n / total) * 100).toFixed(1)}%)`;

const noSeoTitle = items.filter((p) => !p.seoTitle).length;
const noSeoDesc = items.filter((p) => !p.seoDesc).length;
const shortMeta = items.filter((p) => p.seoDesc && p.seoDesc.length < 70).length;
const longMeta = items.filter((p) => p.seoDesc && p.seoDesc.length > 160).length;
const noAlt = items.filter((p) => !p.alt).length;
const thinDesc = items.filter((p) => p.descLen < 200).length;
const emptyDesc = items.filter((p) => p.descLen === 0).length;

// Duplicate SEO titles (or product titles when seoTitle empty)
const titleMap = new Map();
for (const p of items) {
  const t = (p.seoTitle || p.title || "").toLowerCase().trim();
  titleMap.set(t, (titleMap.get(t) || 0) + 1);
}
const dupTitles = [...titleMap.values()].filter((c) => c > 1).reduce((a, c) => a + c, 0);

console.log(`Total products: ${total}   ·   Active & published: ${active.length}\n`);
console.log(`Missing meta TITLE:          ${pct(noSeoTitle)}`);
console.log(`Missing meta DESCRIPTION:    ${pct(noSeoDesc)}`);
console.log(`Meta description too SHORT (<70):  ${pct(shortMeta)}`);
console.log(`Meta description too LONG (>160):  ${pct(longMeta)}`);
console.log(`Missing image ALT text:      ${pct(noAlt)}`);
console.log(`THIN description (<200 chars): ${pct(thinDesc)}   (of which EMPTY: ${pct(emptyDesc)})`);
console.log(`Duplicate meta/product titles: ${pct(dupTitles)}\n`);

console.log(`Sample products needing work:`);
items.filter((p) => !p.seoDesc || p.descLen < 200).slice(0, 12).forEach((p) =>
  console.log(`   - ${p.title}  ·  ${p.vendor}  ·  metaDesc:${p.seoDesc ? "Y" : "—"} descLen:${p.descLen} alt:${p.alt ? "Y" : "—"}`));
console.log("");
