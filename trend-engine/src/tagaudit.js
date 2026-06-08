// Tag audit — verifies the engine's tags actually landed on products, and
// whether those products are PUBLISHED to the Online Store (so collections show
// them). This tells us exactly what's "missed" when a section looks empty.
import { assertConfig } from "./config.js";
import { productsByTag } from "./shopify.js";

assertConfig();
console.log(`\n🔖 Sofie — Tag Audit\n`);

for (const tag of ["trending", "new-in", "bestseller"]) {
  const items = await productsByTag(tag);
  const published = items.filter((p) => p.publishedAt);
  const active = items.filter((p) => p.status === "ACTIVE");
  console.log(`\nTag "${tag}": ${items.length} products  ·  ACTIVE: ${active.length}  ·  published to Online Store: ${published.length}`);
  items.slice(0, 12).forEach((p) =>
    console.log(`   - ${p.title}  [${p.status}]  ${p.publishedAt ? "published" : "NOT PUBLISHED"}  (${p.vendor})`));
  if (!items.length) console.log(`   ⚠️  No products carry the "${tag}" tag right now.`);
}
console.log("");
