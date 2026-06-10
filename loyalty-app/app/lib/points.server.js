// Pure points math. No I/O — fully unit-testable.
import { EARN_DIVISOR, REDEMPTION_TIERS } from "../config/loyalty.js";

/**
 * Points earned on a purchase.
 * Rule: floor(eligibleEgp / EARN_DIVISOR) * multiplier, floored to an int.
 * @param {number} eligibleEgp  spend that earns (excl. shipping/tax/gift cards)
 * @param {number} multiplier   tier multiplier (1.0 / 1.25 / 1.5)
 */
export function earnedPoints(eligibleEgp, multiplier = 1, divisor = EARN_DIVISOR) {
  if (!Number.isFinite(eligibleEgp) || eligibleEgp <= 0) return 0;
  const base = Math.floor(eligibleEgp / divisor);
  return Math.floor(base * multiplier);
}

/**
 * Points to reverse when part (or all) of an order is refunded.
 * Prorates against the original earn so we never claw back more than awarded.
 * @returns negative integer (a delta) or 0
 */
export function reversalPoints(originalPoints, originalEligibleEgp, refundedEligibleEgp) {
  if (!originalPoints || originalEligibleEgp <= 0 || refundedEligibleEgp <= 0) return 0;
  const ratio = Math.min(1, refundedEligibleEgp / originalEligibleEgp);
  const reverse = Math.round(originalPoints * ratio);
  return -Math.min(originalPoints, reverse);
}

/** Look up a redemption tier by its exact points cost. */
export function redemptionByCost(pointsCost) {
  return REDEMPTION_TIERS.find((r) => r.pointsCost === pointsCost) || null;
}

/**
 * Eligible spend for a Shopify order, in whole EGP.
 * Uses current_subtotal_price (after discounts, before shipping/tax) and
 * subtracts any gift-card line items.
 */
export function eligibleEgpFromOrder(order) {
  const subtotal = toEgp(order.current_subtotal_price ?? order.subtotal_price ?? "0");
  let giftCards = 0;
  for (const li of order.line_items ?? []) {
    if (li.gift_card) giftCards += toEgp(li.price) * (li.quantity ?? 1);
  }
  return Math.max(0, Math.round(subtotal - giftCards));
}

// Shopify REST money strings are major units (e.g. "7500.00" EGP). Round to whole EGP.
export function toEgp(money) {
  const n = typeof money === "number" ? money : parseFloat(money);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
