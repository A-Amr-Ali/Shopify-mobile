// POST /apps/loyalty/ask — interactive beauty advisor. Uses the customer's
// profile + their question → Claude answer + add-to-cart product picks.
// App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { askAdvisor } from "../lib/advisor.server.js";
import { searchByKeywords, bestSellers, buildKeywords } from "../lib/recommend.server.js";

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

  // Always attach real, in-stock products with Add-to-bag — the advisor's own
  // suggestions first, then the profile keywords, then best-sellers as a floor.
  let products = [];
  try {
    const admin = await getAdmin(params.get("shop"));
    const terms = (result.productSearches && result.productSearches.length)
      ? result.productSearches
      : buildKeywords(profile);
    if (terms.length) products = await searchByKeywords(admin, terms, 4);
    if (products.length < 2) {
      const fill = await bestSellers(admin, 4);
      const seen = new Set(products.map((p) => p.variantId));
      for (const p of fill) { if (!seen.has(p.variantId)) { products.push(p); seen.add(p.variantId); } if (products.length >= 4) break; }
    }
  } catch (err) {
    console.warn(`advisor product search: ${err.message}`);
  }

  return json({ ok: true, answer: result.answer, products });
};
