// Pure earn-action helpers (no I/O) — safe to import in tests without a DB driver.
import { EARN_ACTIONS } from "../config/loyalty.js";

/** Is this review within the monthly cap? (count = reviews already this month) */
export function withinMonthlyCap(countThisMonth, cap = EARN_ACTIONS.review.monthlyCap) {
  return countThisMonth < cap;
}
