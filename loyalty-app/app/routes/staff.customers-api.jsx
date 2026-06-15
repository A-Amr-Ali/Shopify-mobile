// POST /staff/customers-api — paginated, searchable customer directory for the
// staff console. Returns each customer's email, order count, loyalty points,
// tier, lifetime spend and birthday. Protected by STAFF_KEY (sent in the body).
import { json } from "@remix-run/node";
import { supabase } from "../db.server.js";
import { STAFF_KEY } from "../config/loyalty.js";

const PAGE_SIZE = 50;

export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!STAFF_KEY) return json({ error: "staff_key_not_set" }, { status: 503 });
  if (String(body.key ?? "").trim() !== STAFF_KEY.trim()) return json({ error: "unauthorized" }, { status: 401 });

  const page = Math.max(0, Number(body.page) || 0);
  const q = String(body.q || "").trim();
  const from = page * PAGE_SIZE;

  let query = supabase
    .from("customers")
    .select("shopify_customer_id, email, first_name, tier, points_balance, lifetime_spend_egp, birthday, created_at", { count: "exact" });

  if (q) {
    const safe = q.replace(/[%,]/g, " ");
    query = query.or(`email.ilike.%${safe}%,first_name.ilike.%${safe}%`);
  }

  // Sort: highest points first by default; "recent" = newest accounts.
  if (body.sort === "recent") query = query.order("created_at", { ascending: false });
  else if (body.sort === "spend") query = query.order("lifetime_spend_egp", { ascending: false });
  else query = query.order("points_balance", { ascending: false });

  const { data: rows, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) return json({ error: error.message }, { status: 500 });

  // Order counts for just this page's customers (one batched query).
  const ids = (rows ?? []).map((r) => r.shopify_customer_id);
  const orders = {};
  if (ids.length) {
    const { data: led } = await supabase
      .from("points_ledger").select("customer_id").eq("reason", "purchase").in("customer_id", ids);
    for (const r of led ?? []) orders[r.customer_id] = (orders[r.customer_id] || 0) + 1;
  }

  const customers = (rows ?? []).map((r) => ({
    id: r.shopify_customer_id,
    name: r.first_name || "",
    email: r.email || "",
    orders: orders[r.shopify_customer_id] || 0,
    points: r.points_balance ?? 0,
    tier: r.tier || "insider",
    spend: r.lifetime_spend_egp ?? 0,
    birthday: r.birthday || null,
    joined: r.created_at || null,
  }));

  return json({
    ok: true,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    pages: Math.ceil((count ?? 0) / PAGE_SIZE),
    customers,
  });
};
