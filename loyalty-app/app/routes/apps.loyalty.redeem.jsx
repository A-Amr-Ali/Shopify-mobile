// POST /apps/loyalty/redeem — debit the ledger and mint a single-use EGP code.
// App Proxy + HMAC; customer id from the signed param only.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { unauthenticated } from "../shopify.server.js";
import { supabase } from "../db.server.js";
import { createLedger } from "../lib/ledger.server.js";
import { createSupabaseStore } from "../lib/store.supabase.js";
import { redemptionByCost } from "../lib/points.server.js";
import { mintDiscountCode } from "../lib/discounts.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";

const ledger = createLedger(createSupabaseStore());

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const pointsCost = Number(body.pointsCost);
  const reward = redemptionByCost(pointsCost);
  if (!reward) return json({ error: "invalid_reward" }, { status: 400 });

  // Reserve a redemption row first so the ledger debit is keyed to a stable id.
  const { data: redemption, error: rErr } = await supabase
    .from("redemptions")
    .insert({ customer_id: customerId, points_spent: reward.pointsCost, status: "pending" })
    .select("id")
    .single();
  if (rErr) return json({ error: "redemption_create_failed" }, { status: 500 });

  // Debit points (atomic, negative-guarded). Insufficient balance → 409.
  let debit;
  try {
    debit = await ledger.redeem({ customerId, pointsCost: reward.pointsCost, redemptionId: redemption.id });
  } catch (err) {
    await supabase.from("redemptions").update({ status: "failed" }).eq("id", redemption.id);
    if (String(err.message).includes("insufficient_points")) {
      return json({ error: "insufficient_points" }, { status: 409 });
    }
    return json({ error: "debit_failed" }, { status: 500 });
  }

  // Mint the discount code. If this fails, compensate the debit (credit back).
  try {
    const { admin } = await unauthenticated.admin(params.get("shop"));
    const { code, nodeId } = await mintDiscountCode(admin, {
      amountEgp: reward.egpValue,
      customerId,
    });
    await supabase.from("redemptions")
      .update({ status: "issued", discount_code: code, ledger_id: debit.id })
      .eq("id", redemption.id);

    await trackEvent("Loyalty Reward Redeemed", null, {
      code, points_spent: reward.pointsCost, egp_value: reward.egpValue, balance: debit.balanceAfter,
    });

    return json({
      ok: true, code, egp_value: reward.egpValue,
      points_spent: reward.pointsCost, balance: debit.balanceAfter, discount_node: nodeId,
    });
  } catch (err) {
    // Compensating credit — never strand the customer's points.
    await ledger.record({
      customerId, delta: reward.pointsCost, reason: "adjustment",
      referenceType: "redemption_refund", referenceId: String(redemption.id),
      idempotencyKey: `redemption:${redemption.id}:refund`,
    });
    await supabase.from("redemptions").update({ status: "failed" }).eq("id", redemption.id);
    console.error(`Mint failed, points refunded: ${err.message}`);
    return json({ error: "mint_failed" }, { status: 502 });
  }
};
