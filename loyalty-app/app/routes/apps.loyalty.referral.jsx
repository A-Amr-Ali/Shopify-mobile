// POST /apps/loyalty/referral — create a referral and mint the friend's welcome
// code. The referrer earns 500 pts later, when the friend's first order is paid
// (handled in webhooks.jsx). App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { mintOpenCode } from "../lib/discounts.server.js";
import { REFERRAL } from "../config/loyalty.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const email = String(body.referred_email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "invalid_email" }, { status: 400 });

  // Don't let someone refer an email that already has a pending/rewarded referral.
  const { data: existing } = await supabase
    .from("referrals").select("id").eq("referred_email", email).neq("status", "expired").maybeSingle();
  if (existing) return json({ error: "already_referred" }, { status: 409 });

  const { data: ref, error } = await supabase
    .from("referrals")
    .insert({ referrer_id: customerId, referred_email: email, status: "pending" })
    .select("id").single();
  if (error) return json({ error: "referral_create_failed" }, { status: 500 });

  let welcome = null;
  try {
    const admin = await getAdmin(params.get("shop"));
    welcome = await mintOpenCode(admin, {
      amountEgp: REFERRAL.welcomeEgp, prefix: REFERRAL.welcomeCodePrefix,
    });
  } catch (err) {
    console.warn(`welcome code mint failed: ${err.message}`);
  }

  return json({
    ok: true,
    referral_id: ref.id,
    welcome_code: welcome?.code ?? null,
    welcome_egp: REFERRAL.welcomeEgp,
    referrer_reward: REFERRAL.referrerPoints,
  });
};
