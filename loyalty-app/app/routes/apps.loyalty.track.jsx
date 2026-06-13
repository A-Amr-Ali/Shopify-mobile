// POST /apps/loyalty/track — records a product view for the AI Sales Agent.
// Called by the storefront tracker (app-embed). Because it goes through the App
// Proxy, Shopify signs the request and appends logged_in_customer_id, so we only
// ever attribute a view to a verified, logged-in customer (guests are ignored).
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { recordEvent } from "../lib/agent/insights.server.js";
import { supabase } from "../db.server.js";

export const action = async ({ request }) => {
  const url = new URL(request.url);
  const { ok, customerId } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ ok: true, ignored: "guest" }); // not logged in

  let body = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const handle = String(body.handle || "").slice(0, 200);
  if (!handle) return json({ ok: true, ignored: "no_handle" });

  // Light throttle: skip if the same product was logged for this customer in the
  // last 10 minutes (avoids spamming rows on refresh/scroll re-fires).
  const tenMinAgo = new Date(Date.now() - 10 * 60e3).toISOString();
  const { data: recent } = await supabase
    .from("customer_events").select("id")
    .eq("customer_id", customerId).eq("type", "view").eq("product_handle", handle)
    .gte("created_at", tenMinAgo).limit(1);
  if (recent && recent.length) return json({ ok: true, deduped: true });

  await recordEvent({
    customerId,
    type: "view",
    productHandle: handle,
    productTitle: String(body.title || "").slice(0, 300) || null,
  });
  return json({ ok: true });
};

// App Proxy issues a GET on navigation in some themes; accept it as a no-op.
export const loader = () => json({ ok: true });
