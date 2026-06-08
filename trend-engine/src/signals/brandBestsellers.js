// Brand best-sellers: pulls each brand's best-selling products from their
// official store (tries their "best sellers" collection feed), with a curated
// fallback list of known hero products so it works even if the feed isn't
// reachable. Used to feature rhode / One/Size best-sellers in Trending + New In.
const UA = "Mozilla/5.0 (compatible; SofieBestsellerBot/1.0; +https://www.sofiestore.net)";

export const BEST_SELLER_SOURCES = [
  {
    brand: "Rhode",
    domain: "rhodeskin.com",
    collections: ["best-sellers", "bestsellers", "shop-best-sellers", "best-sellers-1"],
    fallback: [
      "peptide lip treatment", "peptide lip tint", "glazing milk", "glazing fluid",
      "barrier restore cream", "pineapple refresh", "pocket blush", "glazing mist",
      "peptide glazing fluid", "lip case",
    ],
  },
  {
    brand: "One/Size",
    domain: "onesizebeauty.com",
    collections: ["best-sellers", "bestsellers", "best-sellers-1", "shop-all"],
    fallback: [
      "on til dawn", "secure the blur", "turn up the base", "ultimate setting powder",
      "cheek clapper", "lip snatcher", "first impressions", "go off",
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCollection(domain, handle) {
  const url = `https://${domain}/collections/${handle}/products.json?limit=50`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) throw new Error("not JSON");
  const data = await res.json();
  return (data.products || []).map((p) => ({ title: p.title, vendor: p.vendor }));
}

// Returns [{ brand, title, vendor, source }]
export async function brandBestsellers() {
  const out = [];
  for (const src of BEST_SELLER_SOURCES) {
    let got = [];
    for (const handle of src.collections) {
      try {
        const list = await fetchCollection(src.domain, handle);
        if (list.length) { got = list; break; }
      } catch { /* try next handle */ }
      await sleep(300);
    }
    if (got.length) {
      got.forEach((p) => out.push({ brand: src.brand, title: p.title, vendor: p.vendor, source: "feed" }));
      console.log(`   bestsellers ${src.brand}: ${got.length} from live feed`);
    } else {
      src.fallback.forEach((t) => out.push({ brand: src.brand, title: t, vendor: src.brand, source: "fallback" }));
      console.log(`   bestsellers ${src.brand}: ${src.fallback.length} from curated fallback`);
    }
    await sleep(400);
  }
  return out;
}
