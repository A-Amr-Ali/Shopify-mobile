// Thin/empty description enricher — adds a unique, keyword-rich authenticity
// block to products whose description is empty or very thin. APPENDS to any
// existing copy (never overwrites it), and skips products already enriched.
// Only touches products under DESC_MIN chars (default 200). DRY_RUN + MAX_WRITES.
import { config, assertConfig } from "./config.js";
import { fetchProductsDesc, setProductDescription } from "./shopify.js";

const STORE = "Sofie's Makeup Store";
const MARKER = "sofie-seo-block";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v, d) => (v == null || v === "" ? d : Number(v));
const DESC_MIN = num(process.env.DESC_MIN, 200);

function block(p) {
  const brand = (p.vendor || "").trim();
  const lead = brand ? `${p.title} by ${brand}` : p.title;
  return `\n<div class="${MARKER}">
<p><strong>${lead}</strong> — 100% authentic at ${STORE}, Egypt's destination for luxury beauty.</p>
<ul>
<li>100% authentic — sourced from official brands &amp; authorized distributors</li>
<li>Curated by 10+ years of beauty expertise</li>
<li>Fast, careful delivery across every governorate in Egypt</li>
<li>Shop in person at Marassi M-Porium &amp; Akti by Zahra</li>
</ul>
<p>Shop ${brand ? brand + " " : ""}in Egypt with confidence at ${STORE}.</p>
</div>`;
}

async function main() {
  assertConfig();
  console.log(`\n✍️  Sofie Description Enricher  ${config.dryRun ? "[DRY RUN]" : "[LIVE]"}  (min ${DESC_MIN} chars)\n`);
  const items = await fetchProductsDesc();
  const targets = items.filter((p) =>
    p.status === "ACTIVE" && p.published && p.len < DESC_MIN && !p.html.includes(MARKER));
  const cap = config.maxWrites > 0 ? config.maxWrites : targets.length;
  console.log(`Active+published thin descriptions: ${targets.length}  ·  processing: ${Math.min(cap, targets.length)}\n`);

  targets.slice(0, 6).forEach((p) => console.log(`• ${p.title} (${p.vendor})  current ${p.len} chars`));
  console.log("");

  let done = 0, failed = 0;
  for (const p of targets.slice(0, cap)) {
    const html = (p.html || "").trim() + block(p);
    if (config.dryRun) { done++; continue; }
    try {
      await setProductDescription(p.id, html);
      done++;
      if (done % 50 === 0) console.log(`   …wrote ${done}`);
      await sleep(200);
    } catch (err) {
      failed++;
      if (/throttled/i.test(err.message)) await sleep(2000);
      else console.warn(`   ✕ ${p.title}: ${err.message}`);
    }
  }
  console.log(`\n✅ ${config.dryRun ? "Would enrich" : "Enriched"} ${done} descriptions` + (failed ? ` · ${failed} failed` : "") + `${config.dryRun ? "  (dry-run)" : ""}\n`);
}

main().catch((err) => { console.error(`\n❌ Description enricher failed: ${err.message}\n`); process.exit(1); });
