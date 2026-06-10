// POST /apps/loyalty/social — award 50 pts for following on IG/TikTok
// (once per platform). App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { awardSocial } from "../lib/earn-actions.server.js";
import { mirrorCustomerByShop } from "../lib/mirror.server.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  let out;
  try {
    out = await awardSocial(customerId, body.platform);
  } catch (err) {
    return json({ error: String(err.message) }, { status: 400 });
  }
  if (out.applied) await mirrorCustomerByShop(params.get("shop"), customerId);

  return json({ ok: true, awarded: out.applied ? 50 : 0, balance: out.balanceAfter ?? null, already: !!out.capped });
};
