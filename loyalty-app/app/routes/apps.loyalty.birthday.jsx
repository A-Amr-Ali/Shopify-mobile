// POST /apps/loyalty/birthday — save just the customer's birthday (for the
// birthday-gift program). App Proxy + HMAC; customer id comes only from the
// signed logged_in_customer_id. Accepts { birthday: "YYYY-MM-DD" }.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { supabase } from "../db.server.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const url = new URL(request.url);
  const { ok, customerId } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const bd = String(body.birthday || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd)) return json({ error: "bad_date" }, { status: 400 });

  // Ensure a customer row exists, then set the birthday.
  await supabase.from("customers").upsert(
    { shopify_customer_id: customerId }, { onConflict: "shopify_customer_id", ignoreDuplicates: true });
  const { error } = await supabase.from("customers").update({ birthday: bd }).eq("shopify_customer_id", customerId);
  if (error) return json({ error: error.message }, { status: 500 });

  return json({ ok: true, birthday: bd });
};
