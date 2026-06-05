// Matches trend signals to your actual catalog and produces a ranked list.
// Key idea: a global/Google/TikTok trend only counts if you STOCK a matching,
// in-stock product. We match on title + vendor + product type + tags.

const norm = (s) => (s || "").toLowerCase();

function productText(p) {
  return [p.title, p.vendor, p.productType, ...(p.tags || [])].map(norm).join(" | ");
}

// Best matching keyword score for a product from a keyword->score map.
function keywordScoreFor(text, keywordScores) {
  let best = 0;
  let hit = null;
  for (const [kw, score] of keywordScores) {
    if (score > 0 && text.includes(kw)) {
      if (score > best) { best = score; hit = kw; }
    }
  }
  return { best, hit };
}

export function scoreProducts(products, { googleScores, manualScores, salesScores, dailyTerms, weights }) {
  const daily = new Set((dailyTerms || []).map(norm));
  const ranked = [];

  for (const p of products) {
    // Never promote sold-out items. totalInventory null = untracked = allow.
    if (typeof p.totalInventory === "number" && p.totalInventory <= 0) continue;

    const text = productText(p);
    const g = keywordScoreFor(text, googleScores);
    const m = keywordScoreFor(text, manualScores);
    const sales = salesScores.get(p.id) || 0;

    // Daily trending-search bonus if any hot term shows up in the product text.
    let dailyBonus = 0;
    for (const term of daily) {
      if (term.length >= 4 && text.includes(term)) { dailyBonus = 0.15; break; }
    }

    const score =
      weights.google * g.best +
      weights.manual * m.best +
      weights.sales * sales +
      dailyBonus;

    if (score <= 0) continue;

    ranked.push({
      product: p,
      score,
      reasons: {
        google: g.best ? `${g.hit} (${g.best.toFixed(2)})` : null,
        manual: m.best ? `${m.hit} (${m.best.toFixed(2)})` : null,
        sales: sales ? sales.toFixed(2) : null,
        daily: dailyBonus ? "daily-trend" : null,
      },
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

// Pure best-sellers ranking from sales velocity only (most honest "best seller").
export function rankBestSellers(products, salesScores) {
  return products
    .filter((p) => !(typeof p.totalInventory === "number" && p.totalInventory <= 0))
    .map((p) => ({ product: p, score: salesScores.get(p.id) || 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
