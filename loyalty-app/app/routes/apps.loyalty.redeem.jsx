// POST /apps/loyalty/redeem — debit the ledger and issue the reward.
// Supports two reward kinds:
//   { pointsCost }  → a fixed-amount EGP discount code (the standard tiers)
//   { giftId }      → a free-product gift from rewards_catalog (100%-off code)
// App Proxy + HMAC; customer id from the signed param only.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { createLedger } from "../lib/ledger.server.js";
import { createSupabaseStore } from "../lib/store.supabase.js";
import { redemptionByCost } from "../lib/points.server.js";
import { mintDiscountCode, mintProductGiftCode } from "../lib/discounts.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";

const ledger = createLedger(createSupabaseStore());

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // Resolve the reward into a normalized shape.
  let reward; // { kind, pointsCost, egpValue?, productGid?, rewardId?, title? }
  if (body.giftId != null) {
    const { data: g } = await supabase
      .from("rewards_catalog").select("id, title, points_cost, sku, type, active")
      .eq("id", body.giftId).maybeSingle();
    if (!g || !g.active || g.type !== "product" || !g.sku) {
      return json({ error: "invalid_reward" }, { status: 400 });
    }
    reward = { kind: "gift", pointsCost: g.points_cost, productGid: g.sku, rewardId: g.id, title: g.title };
  } else {
    const tier = redemptionByCost(Number(body.pointsCost));
    if (!tier) return json({ error: "invalid_reward" }, { status: 400 });
    reward = { kind: "discount", pointsCost: tier.pointsCost, egpValue: tier.egpValue };
  }

  // Reserve a redemption row so the ledger debit is keyed to a stable id.
  const { data: redemption, error: rErr } = await supabase
    .from("redemptions")
    .insert({ customer_id: customerId, reward_id: reward.rewardId ?? null, points_spent: reward.pointsCost, status: "pending" })
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

  // Issue the reward. If this fails, compensate the debit (credit back).
  try {
    const admin = await getAdmin(params.get("shop"));
    let minted;
    if (reward.kind === "gift") {
      minted = await mintProductGiftCode(admin, { productGid: reward.productGid, customerId });
    } else {
      minted = await mintDiscountCode(admin, { amountEgp: reward.egpValue, customerId });
    }
    await supabase.from("redemptions")
      .update({ status: "issued", discount_code: minted.code, ledger_id: debit.id })
      .eq("id", redemption.id);

    await trackEvent("Loyalty Reward Redeemed", null, {
      code: minted.code, kind: reward.kind, points_spent: reward.pointsCost,
      egp_value: reward.egpValue ?? null, gift: reward.title ?? null, balance: debit.balanceAfter,
    });

    return json({
      ok: true,
      kind: reward.kind,
      code: minted.code,
      egp_value: reward.egpValue ?? null,
      gift: reward.title ?? null,
      points_spent: reward.pointsCost,
      balance: debit.balanceAfter,
    });
  } catch (err) {
    await ledger.record({
      customerId, delta: reward.pointsCost, reason: "adjustment",
      referenceType: "redemption_refund", referenceId: String(redemption.id),
      idempotencyKey: `redemption:${redemption.id}:refund`,
    });
    await supabase.from("redemptions").update({ status: "failed" }).eq("id", redemption.id);
    console.error(`Redeem mint failed, points refunded: ${err.message}`);
    return json({ error: "mint_failed" }, { status: 502 });
  }
};
