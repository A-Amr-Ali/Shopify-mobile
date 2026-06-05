// Google Trends signal.
// NOTE: there is no official Google Trends API. We use the community
// `google-trends-api` package, which can occasionally break when Google changes
// their internal endpoints. This module is fully isolated: if it fails, the
// engine falls back to the other signals and keeps working.
import googleTrends from "google-trends-api";
import { ANCHOR_KEYWORD } from "../keywords.js";

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

// Returns Map<keywordLower, score 0..1> based on the last 7 days of interest,
// normalised against a shared anchor keyword so batches are comparable.
export async function googleTrendsScores(keywords, { geo = "EG" } = {}) {
  const startTime = new Date(Date.now() - 7 * 864e5);
  const scores = new Map();

  // 4 real terms + 1 anchor per request (Trends allows max 5 comparisons).
  for (const batch of chunk(keywords, 4)) {
    const terms = [ANCHOR_KEYWORD, ...batch];
    let payload;
    try {
      const raw = await googleTrends.interestOverTime({ keyword: terms, startTime, geo });
      payload = JSON.parse(raw);
    } catch (err) {
      console.warn(`⚠️  Google Trends batch failed (${batch.join(", ")}): ${err.message}`);
      continue;
    }
    const timeline = payload?.default?.timelineData || [];
    if (!timeline.length) continue;

    // value[i] aligns with terms[i]; index 0 is the anchor.
    const means = terms.map((_, i) => mean(timeline.map((t) => Number(t.value?.[i] ?? 0))));
    const anchorMean = means[0] || 1;

    batch.forEach((kw, i) => {
      const rel = means[i + 1] / anchorMean; // relative to anchor
      scores.set(kw.toLowerCase(), rel);
    });

    // Be polite to the endpoint.
    await new Promise((r) => setTimeout(r, 800));
  }

  return normalise(scores);
}

// Optional bonus: today's trending searches in the geo (broad, not beauty-only).
export async function googleDailyTrendTerms({ geo = "EG" } = {}) {
  try {
    const raw = await googleTrends.dailyTrends({ geo });
    const data = JSON.parse(raw);
    const days = data?.default?.trendingSearchesDays || [];
    return days.flatMap((d) => d.trendingSearches.map((s) => s.title?.query?.toLowerCase()).filter(Boolean));
  } catch (err) {
    console.warn(`⚠️  Google daily trends failed: ${err.message}`);
    return [];
  }
}

function normalise(map) {
  const max = Math.max(0, ...map.values());
  if (max <= 0) return map;
  for (const [k, v] of map) map.set(k, v / max);
  return map;
}
