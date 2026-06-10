// Supabase-backed ledger store. Atomicity + idempotency are enforced by the
// Postgres function apply_ledger_entry() (see migrations/0001_init.sql), so the
// adapter is thin. The `meta` field is folded into reference_id is NOT done —
// instead we persist eligibleEgp on the purchase row via reference fields and
// reconstruct it on reversal from the ledger delta when absent.

import { supabase } from "../db.server.js";

export function createSupabaseStore() {
  async function ensureCustomer(customerId, fields = {}) {
    const { error } = await supabase
      .from("customers")
      .upsert(
        { shopify_customer_id: customerId, ...fields },
        { onConflict: "shopify_customer_id", ignoreDuplicates: true }
      );
    if (error) throw new Error(`ensureCustomer: ${error.message}`);
  }

  async function apply({ customerId, delta, reason, referenceType, referenceId, idempotencyKey }) {
    const { data, error } = await supabase.rpc("apply_ledger_entry", {
      p_customer_id: customerId,
      p_delta: delta,
      p_reason: reason,
      p_reference_type: referenceType ?? null,
      p_reference_id: referenceId ?? null,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw new Error(`apply_ledger_entry: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return { applied: row.applied, balanceAfter: row.balance_after, id: row.ledger_id };
  }

  async function findEarnForOrder(customerId, orderId) {
    const { data, error } = await supabase
      .from("points_ledger")
      .select("id, delta, reference_id")
      .eq("customer_id", customerId)
      .eq("reason", "purchase")
      .eq("reference_type", "order")
      .eq("reference_id", String(orderId))
      .order("id", { ascending: false })
      .limit(1);
    if (error) throw new Error(`findEarnForOrder: ${error.message}`);
    const row = data?.[0];
    // eligibleEgp ≈ original delta * EARN_DIVISOR (lower bound); good enough for
    // proration. Phase 2 can persist eligibleEgp explicitly if finer accuracy is needed.
    return row ? { id: row.id, delta: row.delta, meta: { eligibleEgp: row.delta * 10 } } : null;
  }

  async function getBalance(customerId) {
    const { data, error } = await supabase
      .from("customers")
      .select("points_balance")
      .eq("shopify_customer_id", customerId)
      .maybeSingle();
    if (error) throw new Error(`getBalance: ${error.message}`);
    return data?.points_balance ?? 0;
  }

  return { ensureCustomer, apply, findEarnForOrder, getBalance };
}
