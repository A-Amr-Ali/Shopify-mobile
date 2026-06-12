// POST /apps/loyalty/quiz — save quiz answers, award 250 pts (one-time),
// build tips, mirror profile + points to metafields. App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { saveQuiz, completionPct } from "../lib/profile.server.js";
import { awardQuiz } from "../lib/earn-actions.server.js";
import { generateTips } from "../lib/tips.server.js";
import { mirrorCustomerByShop, mirrorProfileByShop } from "../lib/mirror.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { supabase } from "../db.server.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const answers = await request.json().catch(() => ({}));
  const profile = await saveQuiz(customerId, answers);
  const award = await awardQuiz(customerId); // idempotent: 0 on repeat
  const { tips } = await generateTips(customerId, profile);

  const shop = params.get("shop");
  await mirrorProfileByShop(shop, customerId, profile, tips);
  await mirrorCustomerByShop(shop, customerId);

  const { data: c } = await supabase.from("customers").select("email, points_balance").eq("shopify_customer_id", customerId).maybeSingle();
  if (award.applied) await trackEvent("Loyalty Points Earned", c?.email, { points: 250, reason: "quiz", balance: award.balanceAfter });
  // Lets a Klaviyo flow email the personalized tips to the customer.
  await trackEvent("Loyalty Tips Ready", c?.email, {
    tips, profile: { skin_type: profile.skin_type, undertone: profile.undertone, lip_finish_pref: profile.lip_finish_pref },
  });

  return json({
    ok: true,
    awarded: award.applied ? 250 : 0,
    balance: award.balanceAfter ?? c?.points_balance ?? 0,
    completion_pct: completionPct(profile),
    tips,
  });
};
