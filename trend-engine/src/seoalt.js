// Image ALT-text optimizer — fills missing alt text on each product's main
// image (descriptive, keyword-aware, EG-localised). Fill-gaps only (skips
// images that already have alt). Safe DRY_RUN preview + MAX_WRITES cap.
import { config, assertConfig } from "./config.js";
import { fetchProductsAlt, setMediaAlt } from "./shopify.js";

const STORE = "Sofie's Makeup Store";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fw = (s) => (s || "").trim().split(/\s+/)[0].toLowerCase();

function clip(s, n) {
  s = (s || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  const t = s.slice(0, n); const i = t.lastIndexOf(" ");
  return (i > n * 0.6 ? t.slice(0, i) : t).trim();
}

export function altText(p) {
  const brand = (p.vendor || "").trim();
  const base = brand && !p.title.toLowerCase().includes(fw(brand)) ? `${p.title} — ${brand}` : p.title;
  return clip(`${base}, authentic at ${STORE} Egypt`, 125);
}

async function main() {
  assertConfig();
  console.log(`\n🖼️  Sofie Image Alt Optimizer  ${config.dryRun ? "[DRY RUN]" : "[LIVE]"}\n`);
  const items = await fetchProductsAlt();
  const targets = items.filter((p) => p.status === "ACTIVE" && p.published && p.mediaId && !p.alt);
  const cap = config.maxWrites > 0 ? config.maxWrites : targets.length;
  console.log(`Active+published images missing alt: ${targets.length}  ·  processing: ${Math.min(cap, targets.length)}\n`);

  targets.slice(0, 10).forEach((p) => console.log(`• ${p.title}\n   alt: ${altText(p)}`));
  console.log("");

  let done = 0, failed = 0;
  for (const p of targets.slice(0, cap)) {
    if (config.dryRun) { done++; continue; }
    try {
      await setMediaAlt(p.id, p.mediaId, altText(p));
      done++;
      if (done % 100 === 0) console.log(`   …wrote ${done}`);
      await sleep(180);
    } catch (err) {
      failed++;
      if (/throttled/i.test(err.message)) await sleep(2000);
      else console.warn(`   ✕ ${p.title}: ${err.message}`);
    }
  }
  console.log(`\n✅ ${config.dryRun ? "Would update" : "Updated"} ${done} images` + (failed ? ` · ${failed} failed` : "") + `${config.dryRun ? "  (dry-run)" : ""}\n`);
}

main().catch((err) => { console.error(`\n❌ Alt optimizer failed: ${err.message}\n`); process.exit(1); });
