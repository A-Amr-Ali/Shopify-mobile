// POST /apps/loyalty/ask — interactive beauty advisor. Uses the customer's
// profile + their question → Claude answer + add-to-cart product picks.
// App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { askAdvisor } from "../lib/advisor.server.js";
import { searchByKeywords } from "../lib/recommend.server.js";

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ error: "not_logged_in" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, 400);
  if (!question) return json({ error: "no_question" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("customer_id", customerId).maybeSingle();

  const result = await askAdvisor(profile, question);
  if (!result) return json({ error: "advisor_unavailable" }, { status: 503 });

  let products = [];
  if (result.productSearches.length) {
    try {
      const admin = await getAdmin(params.get("shop"));
      products = await searchByKeywords(admin, result.productSearches, 4);
    } catch (err) {
      console.warn(`advisor product search: ${err.message}`);
    }
  }
  return json({ ok: true, answer: result.answer, products });
};
