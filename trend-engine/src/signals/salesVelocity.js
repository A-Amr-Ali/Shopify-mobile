// Sales-velocity signal — your store's own live momentum (the most reliable
// "what's trending with MY customers" signal). Needs read_orders scope.
import { fetchSalesVelocity } from "../shopify.js";

// Returns Map<productGid, score 0..1> normalised across products.
export async function salesVelocityScores(days) {
  const units = await fetchSalesVelocity(days);
  const max = Math.max(0, ...units.values());
  const scores = new Map();
  if (max <= 0) return scores;
  for (const [gid, u] of units) scores.set(gid, u / max);
  return scores;
}
