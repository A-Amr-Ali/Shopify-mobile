// POST /apps/loyalty/profile — manual "products I use" entry; award 50 pts
// (one-time), refresh tips, mirror. App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { addCurrentProducts, completionPct } from "../lib/profile.server.js";
import { awardCurrentProducts } from "../lib/earn-actions.server.js";
import { generateTips } from "../lib/tips.server.js";
import { mirrorCustomerByShop, mirrorProfileByShop } from "../lib/mirror.server.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.products) ? body.products : [];
  if (!items.length) return json({ error: "no_products" }, { status: 400 });

  const profile = await addCurrentProducts(customerId, items);
  const award = await awardCurrentProducts(customerId); // idempotent
  const { tips } = await generateTips(customerId, profile);

  const shop = params.get("shop");
  await mirrorProfileByShop(shop, customerId, profile, tips);
  await mirrorCustomerByShop(shop, customerId);

  return json({
    ok: true,
    awarded: award.applied ? 50 : 0,
    balance: award.balanceAfter ?? 0,
    completion_pct: completionPct(profile),
    current_products: profile.current_products,
    tips,
  });
};
