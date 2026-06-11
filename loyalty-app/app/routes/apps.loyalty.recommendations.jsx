// GET /apps/loyalty/recommendations — products matched to the customer's beauty
// profile (from the quiz), shaped for add-to-cart. App Proxy + HMAC.
import { json } from "@remix-run/node";
import { verifyAppProxy } from "../lib/hmac.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { fetchRecommendations } from "../lib/recommend.server.js";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url);
  if (!ok) return json({ error: "bad_signature" }, { status: 401 });
  if (!customerId) return json({ products: [] });

  const { data: profile } = await supabase
    .from("profiles").select("*").eq("customer_id", customerId).maybeSingle();
  if (!profile) return json({ products: [] }); // no quiz yet → nothing to match

  try {
    const admin = await getAdmin(params.get("shop"));
    const products = await fetchRecommendations(admin, profile);
    return json({ products });
  } catch (err) {
    console.warn(`recommendations failed: ${err.message}`);
    return json({ products: [], error: "reco_failed" });
  }
};
