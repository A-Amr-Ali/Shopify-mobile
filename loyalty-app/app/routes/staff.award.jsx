// POST /staff/award — staff console: award points for an in-store purchase
// (your POS isn't on Shopify, so staff enter the amount spent). STAFF_KEY guarded.
import { json } from "@remix-run/node";
import { supabase } from "../db.server.js";
import { createLedger } from "../lib/ledger.server.js";
import { createSupabaseStore } from "../lib/store.supabase.js";
import { earnedPoints } from "../lib/points.server.js";
import { multiplierFor, recomputeHeldTier } from "../lib/tier.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { mirrorCustomer } from "../lib/metafields.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { STAFF_KEY, SHOP_DOMAIN } from "../config/loyalty.js";

const ledger = createLedger(createSupabaseStore());

export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!STAFF_KEY || body.key !== STAFF_KEY) return json({ error: "unauthorized" }, { status: 401 });
  const customerId = body.customerId;
  const amountEgp = Math.round(Number(body.amountEgp));
  if (!customerId || !(amountEgp > 0)) return json({ error: "bad_input" }, { status: 400 });

  const { data: c } = await supabase
    .from("customers").select("tier, lifetime_spend_egp, rolling_spend_egp, tier_locked_until, email")
    .eq("shopify_customer_id", customerId).maybeSingle();

  const mult = multiplierFor(c?.tier ?? "insider");
  const pts = earnedPoints(amountEgp, mult);
  if (pts <= 0) return json({ error: "zero_points" }, { status: 400 });

  const res = await ledger.record({
    customerId, delta: pts, reason: "purchase",
    referenceType: "pos_manual", referenceId: `pos:${Date.now()}`,
    idempotencyKey: `staff:award:${customerId}:${Date.now()}`,
  });

  const lifetime = (c?.lifetime_spend_egp ?? 0) + amountEgp;
  const rolling = (c?.rolling_spend_egp ?? 0) + amountEgp;
  const { tier, lockedUntil } = recomputeHeldTier(c?.tier ?? "insider", c?.tier_locked_until ?? null, rolling);
  await supabase.from("customers").update({
    lifetime_spend_egp: lifetime, rolling_spend_egp: rolling, tier, tier_locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  }).eq("shopify_customer_id", customerId);

  try {
    const admin = await getAdmin(SHOP_DOMAIN);
    await mirrorCustomer(admin, customerId, { points: res.balanceAfter, tier, spend: lifetime });
  } catch (e) { console.warn(`staff award mirror: ${e.message}`); }

  await trackEvent("Loyalty Points Earned", c?.email, { points: pts, reason: "in-store", balance: res.balanceAfter, tier });
  return json({ ok: true, awarded: pts, balance: res.balanceAfter, tier });
};
