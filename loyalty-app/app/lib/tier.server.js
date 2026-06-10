// Tier resolution from rolling 12-month spend. Pure functions + a recompute
// helper used by the tier-recompute cron.
import { TIERS, DEFAULT_TIER, TIER_HOLD_MONTHS } from "../config/loyalty.js";

/** Resolve a tier object from rolling spend (EGP). */
export function tierForSpend(rollingSpendEgp) {
  const spend = Number(rollingSpendEgp) || 0;
  for (const t of TIERS) {
    if (spend >= t.minSpendEgp) return t;
  }
  return TIERS.find((t) => t.key === DEFAULT_TIER);
}

export function multiplierFor(tierKey) {
  return TIERS.find((t) => t.key === tierKey)?.multiplier ?? 1.0;
}

/** Progress toward the next tier (for the dashboard progress bar). */
export function tierProgress(rollingSpendEgp) {
  const spend = Number(rollingSpendEgp) || 0;
  const current = tierForSpend(spend);
  // TIERS is high→low; the "next" tier is the lowest one above current spend.
  const above = [...TIERS].reverse().find((t) => t.minSpendEgp > spend);
  if (!above) return { current, next: null, toNextEgp: 0, pct: 100 };
  const floor = current.minSpendEgp;
  const pct = Math.min(100, Math.round(((spend - floor) / (above.minSpendEgp - floor)) * 100));
  return { current, next: above, toNextEgp: above.minSpendEgp - spend, pct };
}

/**
 * Decide the held tier on recompute. A customer never drops below a tier they
 * earned until the hold period lapses.
 * @param {string} currentTier      the customer's stored tier
 * @param {string|Date|null} lockedUntil  stored tier_locked_until
 * @param {number} rollingSpendEgp  trailing-12-month spend
 * @param {Date} now
 * @returns {{tier:string, lockedUntil:string}}
 */
export function recomputeHeldTier(currentTier, lockedUntil, rollingSpendEgp, now = new Date()) {
  const earned = tierForSpend(rollingSpendEgp);
  const rank = (k) => TIERS.length - TIERS.findIndex((t) => t.key === k);
  const held = lockedUntil && new Date(lockedUntil) > now ? currentTier : null;

  // Take the higher of (freshly earned) and (still-held) tier.
  let tier = earned.key;
  if (held && rank(held) > rank(earned.key)) tier = held;

  // If we (re)qualify at or above current, extend the hold.
  const extend = new Date(now);
  extend.setMonth(extend.getMonth() + TIER_HOLD_MONTHS);
  const keepLock = held && tier === held ? new Date(lockedUntil) : extend;

  return { tier, lockedUntil: keepLock.toISOString().slice(0, 10) };
}
