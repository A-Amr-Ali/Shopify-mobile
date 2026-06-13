// GET /account-api/me?token=<session token> — loyalty summary for the Customer
// Account UI extension (runs inside Shopify's hosted account portal). The token
// is the extension's session token (verified, not trusted from the client).
// Token is passed in the query (not a header) so the cross-origin GET stays a
// "simple request" and needs no CORS preflight; we still send ACAO for the read.
import { json } from "@remix-run/node";
import { verifyCustomerToken } from "../lib/session-token.server.js";
import { supabase } from "../db.server.js";
import { tierProgress } from "../lib/tier.server.js";

const CORS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const v = verifyCustomerToken(url.searchParams.get("token"));
  if (!v) return json({ error: "unauthorized" }, { status: 401, headers: CORS });

  const { data: c } = await supabase
    .from("customers")
    .select("points_balance, tier, lifetime_spend_egp, rolling_spend_egp")
    .eq("shopify_customer_id", v.customerId)
    .maybeSingle();

  const prog = tierProgress(c?.rolling_spend_egp ?? 0);
  return json({
    balance: c?.points_balance ?? 0,
    tier: c?.tier ?? "insider",
    lifetime_spend_egp: c?.lifetime_spend_egp ?? 0,
    next: prog.next?.key ?? null,
    to_next_egp: prog.toNextEgp,
    pct: prog.pct,
  }, { headers: CORS });
};
