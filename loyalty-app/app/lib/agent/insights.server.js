// Behavioural insights for the AI Sales Agent.
//   recordEvent()   — append a view/checkout/purchase signal (idempotent by token)
//   buildSnapshot() — assemble one customer's compact behaviour profile
//   activeCustomers() — who has done something worth following up on
// Everything is keyed by the Shopify customer id; no raw PII is stored here.
import { supabase } from "../../db.server.js";

const gid = (id) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/Customer/${id}`);

/**
 * Append a behavioural event. `token` makes checkout/purchase rows idempotent
 * (a unique index drops duplicate webhook/pixel replays). Views pass no token.
 */
export async function recordEvent({ customerId, type, productHandle = null, productTitle = null, data = {}, token = null }) {
  if (!customerId || !type) return;
  const row = {
    customer_id: gid(customerId),
    type,
    product_handle: productHandle,
    product_title: productTitle,
    data,
    token,
  };
  const { error } = await supabase.from("customer_events").insert(row);
  // 23505 = unique violation on (type, token): a duplicate signal, safely ignored.
  if (error && error.code !== "23505") console.warn(`recordEvent ${type}: ${error.message}`);
}

/**
 * A compact, model-ready picture of one customer's behaviour and taste.
 * Pulls the customer row, their beauty profile, and recent events.
 */
export async function buildSnapshot(customerId, { eventDays = 30 } = {}) {
  const id = gid(customerId);
  const since = new Date(Date.now() - eventDays * 864e5).toISOString();

  const [{ data: customer }, { data: profile }, { data: events }] = await Promise.all([
    supabase.from("customers")
      .select("shopify_customer_id, email, first_name, locale, tier, lifetime_spend_egp, points_balance")
      .eq("shopify_customer_id", id).maybeSingle(),
    supabase.from("profiles")
      .select("skin_type, undertone, foundation_shade, lip_finish_pref, skin_concerns, current_products")
      .eq("customer_id", id).maybeSingle(),
    supabase.from("customer_events")
      .select("type, product_handle, product_title, data, token, created_at")
      .eq("customer_id", id).gte("created_at", since)
      .order("created_at", { ascending: false }).limit(50),
  ]);

  const evs = events ?? [];
  const views = evs.filter((e) => e.type === "view");
  const checkouts = evs.filter((e) => e.type === "checkout");
  const purchases = evs.filter((e) => e.type === "purchase");

  return {
    customerId: id,
    email: customer?.email ?? null,
    firstName: customer?.first_name ?? null,
    tier: customer?.tier ?? "insider",
    lifetimeSpendEgp: customer?.lifetime_spend_egp ?? 0,
    locale: customer?.locale ?? null,
    profile: profile ?? null,
    viewed: dedupeProducts(views).slice(0, 8),
    lastCheckout: checkouts[0]
      ? { token: checkouts[0].token, items: checkouts[0].data?.items ?? [], valueEgp: checkouts[0].data?.value_egp ?? null, at: checkouts[0].created_at }
      : null,
    lastPurchase: purchases[0]
      ? { token: purchases[0].token, items: purchases[0].data?.items ?? [], at: purchases[0].created_at }
      : null,
    purchaseCount: purchases.length,
    raw: { views, checkouts, purchases },
  };
}

function dedupeProducts(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = r.product_handle || r.product_title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ handle: r.product_handle, title: r.product_title, at: r.created_at });
  }
  return out;
}

/**
 * Customer ids with any event in the window — the candidate pool the cron scores.
 * Cheap on a single-store dataset; revisit with a materialised view if it grows.
 */
export async function activeCustomers({ days = 14, limit = 500 } = {}) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const { data, error } = await supabase
    .from("customer_events")
    .select("customer_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit * 4); // over-fetch; we dedupe below
  if (error) { console.warn(`activeCustomers: ${error.message}`); return []; }
  const ids = [];
  const seen = new Set();
  for (const r of data ?? []) {
    if (seen.has(r.customer_id)) continue;
    seen.add(r.customer_id);
    ids.push(r.customer_id);
    if (ids.length >= limit) break;
  }
  return ids;
}
