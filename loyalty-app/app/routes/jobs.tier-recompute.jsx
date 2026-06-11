// POST /jobs/tier-recompute — daily cron. Re-derives each customer's rolling
// 12-month spend from the ledger (purchase + refund rows in the trailing window),
// recomputes the held tier, and mirrors. Auth: x-cron-key header == CRON_KEY.
import { json } from "@remix-run/node";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { recomputeHeldTier } from "../lib/tier.server.js";
import { mirrorCustomer } from "../lib/metafields.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { CRON_KEY, SHOP_DOMAIN, ROLLING_WINDOW_DAYS, EARN_DIVISOR } from "../config/loyalty.js";

export const action = async ({ request }) => {
  if (request.headers.get("x-cron-key") !== CRON_KEY || !CRON_KEY) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const since = new Date(Date.now() - ROLLING_WINDOW_DAYS * 864e5).toISOString();
  let admin = null;
  try { admin = await getAdmin(SHOP_DOMAIN); } catch { /* mirror best-effort */ }

  const { data: customers, error } = await supabase
    .from("customers").select("shopify_customer_id, tier, tier_locked_until, email");
  if (error) return json({ error: error.message }, { status: 500 });

  let updated = 0, upgraded = 0;
  for (const c of customers ?? []) {
    // Rolling spend ≈ sum of (purchase + refund_reversal) deltas in window × EARN_DIVISOR.
    // (delta is points; multiplying back by the divisor approximates eligible EGP.)
    const { data: rows } = await supabase
      .from("points_ledger").select("delta, reason")
      .eq("customer_id", c.shopify_customer_id)
      .in("reason", ["purchase", "refund_reversal"])
      .gte("created_at", since);
    const points = (rows ?? []).reduce((s, r) => s + r.delta, 0);
    const rolling = Math.max(0, points * EARN_DIVISOR);

    const { tier, lockedUntil } = recomputeHeldTier(c.tier, c.tier_locked_until, rolling);
    await supabase.from("customers").update({
      rolling_spend_egp: rolling, tier, tier_locked_until: lockedUntil, updated_at: new Date().toISOString(),
    }).eq("shopify_customer_id", c.shopify_customer_id);
    updated++;

    if (tier !== c.tier) {
      upgraded++;
      const { data: cust } = await supabase
        .from("customers").select("points_balance, lifetime_spend_egp")
        .eq("shopify_customer_id", c.shopify_customer_id).maybeSingle();
      if (admin) await mirrorCustomer(admin, c.shopify_customer_id, {
        points: cust?.points_balance ?? 0, tier, spend: cust?.lifetime_spend_egp ?? 0,
      });
      await trackEvent(tier === "insider" ? "Loyalty Tier Changed" : "Loyalty Tier Upgraded", c.email, { tier });
    }
  }
  return json({ ok: true, processed: updated, tier_changes: upgraded });
};
