// POST /staff/lookup — staff console: find a customer by email and return their
// loyalty summary. Protected by the STAFF_KEY password (sent in the body).
import { json } from "@remix-run/node";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { REDEMPTION_TIERS, STAFF_KEY, SHOP_DOMAIN } from "../config/loyalty.js";

const ok = (k) => STAFF_KEY && k === STAFF_KEY;

async function customerByEmail(admin, email) {
  const res = await admin.graphql(
    `query($q: String!){ customers(first: 1, query: $q){ edges { node { id firstName lastName email } } } }`,
    { variables: { q: `email:${email}` } }
  );
  return (await res.json())?.data?.customers?.edges?.[0]?.node || null;
}

export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!ok(body.key)) return json({ error: "unauthorized" }, { status: 401 });
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "bad_email" }, { status: 400 });

  let cust;
  try {
    const admin = await getAdmin(SHOP_DOMAIN);
    cust = await customerByEmail(admin, email);
  } catch (err) {
    return json({ error: "lookup_failed", detail: String(err.message) }, { status: 502 });
  }
  if (!cust) return json({ found: false });

  await supabase.from("customers").upsert(
    { shopify_customer_id: cust.id, email: cust.email },
    { onConflict: "shopify_customer_id", ignoreDuplicates: true }
  );
  const { data } = await supabase
    .from("customers").select("points_balance, tier, lifetime_spend_egp")
    .eq("shopify_customer_id", cust.id).maybeSingle();
  const { data: gifts } = await supabase
    .from("rewards_catalog").select("id, title, points_cost")
    .eq("type", "product").eq("active", true).order("points_cost");

  return json({
    found: true,
    customerId: cust.id,
    name: [cust.firstName, cust.lastName].filter(Boolean).join(" ") || cust.email,
    email: cust.email,
    points: data?.points_balance ?? 0,
    tier: data?.tier ?? "insider",
    lifetime: data?.lifetime_spend_egp ?? 0,
    rewards: REDEMPTION_TIERS,
    gifts: (gifts ?? []).map((g) => ({ id: g.id, title: g.title, pointsCost: g.points_cost })),
  });
};
