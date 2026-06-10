// Append-only points ledger. The ledger NEVER updates a row; corrections are
// new compensating rows. Atomicity + idempotency live in the store adapter.
//
// A store must implement:
//   ensureCustomer(customerId, fields?)        -> void
//   apply(entry)  // {customerId, delta, reason, referenceType, referenceId, idempotencyKey}
//                 -> { applied: bool, balanceAfter: int, id }
//   findEarnForOrder(customerId, orderId)       -> { id, delta, meta } | null
//   getBalance(customerId)                      -> int
//
// Production uses the Supabase adapter (Postgres apply_ledger_entry()); tests
// use the in-memory adapter. Both share these semantics.

import { earnedPoints, reversalPoints, eligibleEgpFromOrder, redemptionByCost } from "./points.server.js";

export function createLedger(store) {
  return {
    /** Raw append. Idempotent on idempotencyKey. */
    async record({ customerId, delta, reason, referenceType, referenceId, idempotencyKey }) {
      if (!idempotencyKey) throw new Error("idempotencyKey is required");
      await store.ensureCustomer(customerId);
      return store.apply({ customerId, delta, reason, referenceType, referenceId, idempotencyKey });
    },

    /** Award points for a paid order (COD-safe; once-only per order). */
    async earnFromOrder({ customerId, order, multiplier }) {
      const eligible = eligibleEgpFromOrder(order);
      const points = earnedPoints(eligible, multiplier);
      if (points <= 0) return { applied: false, balanceAfter: await store.getBalance(customerId), id: null, points: 0 };
      const res = await store.apply({
        customerId,
        delta: points,
        reason: "purchase",
        referenceType: "order",
        referenceId: String(order.id),
        idempotencyKey: `order:${order.id}:paid`,
        meta: { eligibleEgp: eligible, points, multiplier },
      });
      return { ...res, points, eligibleEgp: eligible };
    },

    /** Reverse points for a refund (prorated against the original earn). */
    async reverseForRefund({ customerId, orderId, refundedEgp, refundId }) {
      const original = await store.findEarnForOrder(customerId, orderId);
      if (!original) return { applied: false, balanceAfter: await store.getBalance(customerId), id: null, points: 0 };
      const origPoints = original.delta;
      const origEligible = original.meta?.eligibleEgp ?? origPoints * 10;
      const delta = reversalPoints(origPoints, origEligible, refundedEgp);
      if (delta === 0) return { applied: false, balanceAfter: await store.getBalance(customerId), id: null, points: 0 };
      const res = await store.apply({
        customerId,
        delta,
        reason: "refund_reversal",
        referenceType: "refund",
        referenceId: String(refundId ?? orderId),
        idempotencyKey: `refund:${refundId ?? orderId}`,
      });
      return { ...res, points: delta };
    },

    /** Reverse the full earn when an order is cancelled. */
    async reverseForCancel({ customerId, orderId }) {
      const original = await store.findEarnForOrder(customerId, orderId);
      if (!original) return { applied: false, balanceAfter: await store.getBalance(customerId), id: null, points: 0 };
      const delta = -original.delta;
      if (delta === 0) return { applied: false, balanceAfter: await store.getBalance(customerId), id: null, points: 0 };
      const res = await store.apply({
        customerId,
        delta,
        reason: "refund_reversal",
        referenceType: "order_cancel",
        referenceId: String(orderId),
        idempotencyKey: `cancel:${orderId}`,
      });
      return { ...res, points: delta };
    },

    /** Debit points for a redemption. Throws if the cost is not a valid tier. */
    async redeem({ customerId, pointsCost, redemptionId }) {
      const reward = redemptionByCost(pointsCost);
      if (!reward) throw new Error(`invalid redemption tier: ${pointsCost}`);
      const res = await store.apply({
        customerId,
        delta: -reward.pointsCost,
        reason: "redemption",
        referenceType: "redemption",
        referenceId: String(redemptionId),
        idempotencyKey: `redemption:${redemptionId}`,
      });
      return { ...res, reward };
    },

    getBalance: (customerId) => store.getBalance(customerId),
  };
}
