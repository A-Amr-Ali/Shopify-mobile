// SEO optimizer — fills missing meta TITLE + meta DESCRIPTION on products,
// keyword-optimised and localised for Egypt. Fill-gaps only: never overwrites
// an existing meta value or your product descriptions. Safe by default
// (DRY_RUN=true previews without writing). Optional MAX_WRITES cap per run.
import { config, assertConfig } from "./config.js";
import { fetchProductsSeo, setProductSeo } from "./shopify.js";

const STORE_NAME = "Sofie's Makeup Store";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function clip(s, n) {
  s = (s || "").replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  const t = s.slice(0, n);
  const i = t.lastIndexOf(" ");
  return (i > Math.floor(n * 0.6) ? t.slice(0, i) : t).trim();
}

function firstWord(s) { return (s || "").trim().split(/\s+/)[0].toLowerCase(); }

export function seoTitle(p) {
  const brand = (p.vendor || "").trim();
  // Avoid repeating the brand if it's already in the title.
  const base = brand && !p.title.toLowerCase().includes(firstWord(brand)) ? `${p.title} ${brand}` : p.title;
  let t = `${base} | ${STORE_NAME} Egypt`;
  if (t.length > 60) t = `${base} | Egypt`;
  if (t.length > 60) t = clip(base, 60);
  return t;
}

export function seoDesc(p) {
  const brand = (p.vendor || "").trim();
  const d = `Shop authentic ${brand ? brand + " " : ""}${p.title} in Egypt at ${STORE_NAME}. 100% original, fast nationwide delivery.`;
  return clip(d, 155);
}

async function main() {
  assertConfig();
  console.log(`\n🚀 Sofie SEO Optimizer  ${config.dryRun ? "[DRY RUN]" : "[LIVE]"}\n`);

  const items = await fetchProductsSeo();
  // Target: active + published products missing a meta title OR meta description.
  const targets = items.filter((p) => p.status === "ACTIVE" && p.published && (!p.seoTitle || !p.seoDesc));
  const cap = config.maxWrites > 0 ? config.maxWrites : targets.length;
  console.log(`Active+published needing meta: ${targets.length}  ·  processing this run: ${Math.min(cap, targets.length)}\n`);

  console.log(`Sample of what will be written:`);
  targets.slice(0, 12).forEach((p) => {
    console.log(`\n• ${p.title}  (${p.vendor})`);
    console.log(`   title: ${seoTitle(p)}`);
    console.log(`   desc : ${seoDesc(p)}`);
  });
  console.log("");

  let done = 0, failed = 0;
  for (const p of targets.slice(0, cap)) {
    const seo = {};
    if (!p.seoTitle) seo.title = seoTitle(p);
    if (!p.seoDesc) seo.description = seoDesc(p);
    if (!seo.title && !seo.description) continue;
    if (config.dryRun) { done++; continue; }
    try {
      await setProductSeo(p.id, seo);
      done++;
      if (done % 100 === 0) console.log(`   …wrote ${done}`);
      await sleep(180); // be gentle with rate limits
    } catch (err) {
      failed++;
      if (/throttled/i.test(err.message)) await sleep(2000);
      else console.warn(`   ✕ ${p.title}: ${err.message}`);
    }
  }

  console.log(`\n✅ ${config.dryRun ? "Would update" : "Updated"} ${done} products` + (failed ? ` · ${failed} failed` : "") + `${config.dryRun ? "  (dry-run, no writes)" : ""}\n`);
}

main().catch((err) => { console.error(`\n❌ SEO optimizer failed: ${err.message}\n`); process.exit(1); });
