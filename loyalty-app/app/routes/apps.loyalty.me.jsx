// GET /apps/loyalty/me — balance, tier, progress, profile (App Proxy, HMAC).
// The customer id is taken ONLY from the signed logged_in_customer_id, never
// from client input. App Proxy strips cookies, so the signature is the auth.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { supabase } from "../db.server.js";
import { tierProgress } from "../lib/tier.server.js";
import { REDEMPTION_TIERS } from "../config/loyalty.js";

export const loader = async ({ request }) => {
  const { ok, customerId } = verifyAppProxy(new URL(request.url));
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 200 });

  const { data: customer } = await supabase
    .from("customers")
    .select("points_balance, tier, lifetime_spend_egp, rolling_spend_egp")
    .eq("shopify_customer_id", customerId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("skin_type, undertone, foundation_shade, foundation_brand, lip_shades, lip_finish_pref, skin_concerns, current_products, completion_pct, tips, updated_at")
    .eq("customer_id", customerId)
    .maybeSingle();

  // Free-product gifts the merchant configured in rewards_catalog.
  const { data: gifts } = await supabase
    .from("rewards_catalog")
    .select("id, title, points_cost")
    .eq("type", "product").eq("active", true)
    .order("points_cost");

  const rolling = customer?.rolling_spend_egp ?? 0;
  const progress = tierProgress(rolling);

  return json({
    balance: customer?.points_balance ?? 0,
    tier: customer?.tier ?? "insider",
    lifetime_spend_egp: customer?.lifetime_spend_egp ?? 0,
    progress: {
      current: progress.current.key,
      next: progress.next?.key ?? null,
      to_next_egp: progress.toNextEgp,
      pct: progress.pct,
    },
    rewards: REDEMPTION_TIERS,
    gifts: (gifts ?? []).map((g) => ({ id: g.id, title: g.title, pointsCost: g.points_cost })),
    profile: profile ?? null,
    completion_pct: profile?.completion_pct ?? 0,
    tips: profile?.tips ?? [],
  });
};
