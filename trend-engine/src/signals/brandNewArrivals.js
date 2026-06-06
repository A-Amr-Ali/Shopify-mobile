// Reads each brand's NEWEST products from their public Shopify product feed
// (/products.json). Best-effort: many brand sites block automated requests or
// run on non-Shopify platforms — those are skipped with a warning, never faked.
import { BRAND_SOURCES } from "../brandSources.js";

const UA =
  "Mozilla/5.0 (compatible; SofieNewInBot/1.0; +https://www.sofiestore.net)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBrandFeed(domain, { pages, limit }) {
  const items = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://${domain}/products.json?limit=250&page=${page}`;
    let data;
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) throw new Error("not JSON (bot-blocked or not Shopify)");
      data = await res.json();
    } catch (err) {
      throw new Error(`feed unreadable: ${err.message}`);
    }
    const products = data.products || [];
    for (const p of products) {
      items.push({
        title: p.title,
        handle: p.handle,
        vendor: p.vendor,
        createdAt: p.created_at || p.published_at,
        url: `https://${domain}/products/${p.handle}`,
      });
    }
    if (products.length < 250) break; // no more pages
    await sleep(600); // be polite
  }
  // Newest first, then cap.
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return items.slice(0, limit);
}

// Returns { arrivals: [{brand, title, handle, vendor, createdAt, url}], readBrands, skipped }
export async function brandNewArrivals({ pages = 3, limit = 40 } = {}) {
  const arrivals = [];
  const readBrands = [];
  const skipped = [];

  for (const src of BRAND_SOURCES) {
    if (src.platform !== "shopify") {
      skipped.push(`${src.name} (unsupported platform)`);
      continue;
    }
    try {
      const list = await fetchBrandFeed(src.domain, { pages, limit });
      list.forEach((p) => arrivals.push({ brand: src.name, ...p }));
      readBrands.push(`${src.name}:${list.length}`);
    } catch (err) {
      skipped.push(`${src.name} (${err.message})`);
    }
    await sleep(500);
  }
  return { arrivals, readBrands, skipped };
}
