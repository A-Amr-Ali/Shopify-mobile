// POST /staff/redeem — staff console: redeem a customer's points in-store. Since
// the POS isn't on Shopify, this debits the points and returns the value for the
// staff to apply manually (plus a reference for records). STAFF_KEY guarded.
import { json } from "@remix-run/node";
import { supabase } from "../db.server.js";
import { createLedger } from "../lib/ledger.server.js";
import { createSupabaseStore } from "../lib/store.supabase.js";
import { redemptionByCost } from "../lib/points.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { STAFF_KEY } from "../config/loyalty.js";

const ledger = createLedger(createSupabaseStore());

export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!STAFF_KEY) return json({ error: "staff_key_not_set" }, { status: 503 });
  if (String(body.key ?? "").trim() !== STAFF_KEY.trim()) return json({ error: "unauthorized" }, { status: 401 });
  const customerId = body.customerId;
  if (!customerId) return json({ error: "bad_input" }, { status: 400 });

  let reward; // { pointsCost, label, egpValue, rewardId? }
  if (body.giftId != null) {
    const { data: g } = await supabase
      .from("rewards_catalog").select("id, title, points_cost, active, type")
      .eq("id", body.giftId).maybeSingle();
    if (!g || !g.active || g.type !== "product") return json({ error: "invalid_reward" }, { status: 400 });
    reward = { pointsCost: g.points_cost, label: `${g.title} (free gift)`, egpValue: null, rewardId: g.id };
  } else {
    const t = redemptionByCost(Number(body.pointsCost));
    if (!t) return json({ error: "invalid_reward" }, { status: 400 });
    reward = { pointsCost: t.pointsCost, label: `${t.egpValue} EGP off`, egpValue: t.egpValue };
  }

  const { data: redemption, error: rErr } = await supabase
    .from("redemptions")
    .insert({ customer_id: customerId, reward_id: reward.rewardId ?? null, points_spent: reward.pointsCost, status: "pending" })
    .select("id").single();
  if (rErr) return json({ error: "create_failed" }, { status: 500 });

  let debit;
  try {
    debit = await ledger.redeem({ customerId, pointsCost: reward.pointsCost, redemptionId: redemption.id });
  } catch (err) {
    await supabase.from("redemptions").update({ status: "failed" }).eq("id", redemption.id);
    if (String(err.message).includes("insufficient_points")) return json({ error: "insufficient_points" }, { status: 409 });
    return json({ error: "debit_failed" }, { status: 500 });
  }

  const reference = "SOFIE-REDEEM-" + redemption.id;
  await supabase.from("redemptions")
    .update({ status: "issued", discount_code: reference, ledger_id: debit.id })
    .eq("id", redemption.id);

  const { data: c } = await supabase.from("customers").select("email").eq("shopify_customer_id", customerId).maybeSingle();
  await trackEvent("Loyalty Reward Redeemed", c?.email, {
    reference, in_store: true, points_spent: reward.pointsCost, value: reward.label, balance: debit.balanceAfter,
  });

  return json({
    ok: true,
    reference,
    apply: reward.label,        // tell the staff what to give
    egp_value: reward.egpValue,
    points_spent: reward.pointsCost,
    balance: debit.balanceAfter,
  });
};
