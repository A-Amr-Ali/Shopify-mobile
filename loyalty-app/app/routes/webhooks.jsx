// Single webhook entrypoint. shopify-app-remix verifies the HMAC and gives us
// {topic, shop, payload, admin}. Each handler is idempotent (keyed by order /
// refund id in the ledger). COD-aware: we earn on orders/paid (which fires when
// a COD order becomes paid at delivery), and reverse on refund/cancel.
import { authenticate } from "../shopify.server.js";
import { supabase } from "../db.server.js";
import { createLedger } from "../lib/ledger.server.js";
import { createSupabaseStore } from "../lib/store.supabase.js";
import { eligibleEgpFromOrder, toEgp } from "../lib/points.server.js";
import { tierForSpend, multiplierFor, recomputeHeldTier } from "../lib/tier.server.js";
import { mirrorCustomer } from "../lib/metafields.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";

const ledger = createLedger(createSupabaseStore());
const gid = (id) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/Customer/${id}`);

export const action = async ({ request }) => {
  const { topic, payload, admin } = await authenticate.webhook(request);

  try {
    switch (topic) {
      case "ORDERS_PAID":
        await onOrderPaid(payload, admin);
        break;
      case "REFUNDS_CREATE":
        await onRefundCreate(payload, admin);
        break;
      case "ORDERS_CANCELLED":
        await onOrderCancelled(payload, admin);
        break;
      default:
        console.warn(`Unhandled webhook topic: ${topic}`);
    }
  } catch (err) {
    // Log and 200 — Shopify retries on 5xx, but a poisoned payload would loop
    // forever. Idempotency means a manual replay is safe. Surface in logs.
    console.error(`Webhook ${topic} error: ${err.stack || err.message}`);
  }
  return new Response(null, { status: 200 });
};

async function loadCustomer(customerId) {
  const { data } = await supabase
    .from("customers")
    .select("tier, lifetime_spend_egp, rolling_spend_egp, tier_locked_until, email")
    .eq("shopify_customer_id", customerId)
    .maybeSingle();
  return data;
}

async function onOrderPaid(order, admin) {
  if (!order?.customer?.id) return; // guest checkout — no loyalty account
  const customerId = gid(order.customer.id);
  const email = order.customer.email || order.email;

  await supabase.from("customers").upsert(
    { shopify_customer_id: customerId, email },
    { onConflict: "shopify_customer_id", ignoreDuplicates: true }
  );

  const existing = await loadCustomer(customerId);
  const multiplier = multiplierFor(existing?.tier ?? "insider");

  const res = await ledger.earnFromOrder({ customerId, order, multiplier });
  if (!res.applied) return; // already processed (idempotent) or 0 points

  // Update spend, recompute held tier, mirror to metafields.
  const eligible = res.eligibleEgp ?? eligibleEgpFromOrder(order);
  const lifetime = (existing?.lifetime_spend_egp ?? 0) + eligible;
  const rolling = (existing?.rolling_spend_egp ?? 0) + eligible; // cron trims the trailing window
  const { tier, lockedUntil } = recomputeHeldTier(
    existing?.tier ?? "insider", existing?.tier_locked_until ?? null, rolling
  );

  await supabase.from("customers").update({
    lifetime_spend_egp: lifetime,
    rolling_spend_egp: rolling,
    tier,
    tier_locked_until: lockedUntil,
    updated_at: new Date().toISOString(),
  }).eq("shopify_customer_id", customerId);

  if (admin) {
    await mirrorCustomer(admin, customerId, { points: res.balanceAfter, tier, spend: lifetime });
  }

  await trackEvent("Loyalty Points Earned", email, {
    points: res.points, balance: res.balanceAfter, tier, order_id: order.id,
    eligible_egp: eligible, source: order.source_name || "web",
  });
  if (tier !== (existing?.tier ?? "insider")) {
    await trackEvent("Loyalty Tier Upgraded", email, { tier, lifetime_spend_egp: lifetime });
  }
}

async function onRefundCreate(refund, admin) {
  const orderId = refund.order_id;
  if (!orderId) return;

  // Resolve customer + email from the order via Admin API (refund payload omits it).
  let customerId = null, email = null;
  if (admin) {
    const res = await admin.graphql(
      `query($id: ID!){ order(id:$id){ customer { id email } } }`,
      { variables: { id: `gid://shopify/Order/${orderId}` } }
    );
    const data = (await res.json())?.data?.order?.customer;
    if (data) { customerId = data.id; email = data.email; }
  }
  if (!customerId) return;

  // Refunded eligible EGP = refund line items subtotal (exclude shipping/tax).
  let refundedEgp = 0;
  for (const rli of refund.refund_line_items ?? []) {
    refundedEgp += toEgp(rli.subtotal ?? rli.subtotal_set?.shop_money?.amount ?? 0);
  }
  if (refundedEgp <= 0) return;

  const out = await ledger.reverseForRefund({ customerId, orderId, refundedEgp, refundId: refund.id });
  if (!out.applied) return;

  // Decrement spend, recompute tier, mirror.
  const existing = await loadCustomer(customerId);
  const lifetime = Math.max(0, (existing?.lifetime_spend_egp ?? 0) - refundedEgp);
  const rolling = Math.max(0, (existing?.rolling_spend_egp ?? 0) - refundedEgp);
  const tier = tierForSpend(rolling).key; // refunds can lower tier on next recompute
  await supabase.from("customers").update({
    lifetime_spend_egp: lifetime, rolling_spend_egp: rolling, updated_at: new Date().toISOString(),
  }).eq("shopify_customer_id", customerId);

  if (admin) await mirrorCustomer(admin, customerId, { points: out.balanceAfter, tier: existing?.tier ?? tier, spend: lifetime });
  await trackEvent("Loyalty Points Reversed", email, { points: out.points, balance: out.balanceAfter, refund_id: refund.id });
}

async function onOrderCancelled(order, admin) {
  if (!order?.customer?.id) return;
  const customerId = gid(order.customer.id);
  const out = await ledger.reverseForCancel({ customerId, orderId: order.id });
  if (!out.applied) return;

  const eligible = eligibleEgpFromOrder(order);
  const existing = await loadCustomer(customerId);
  const lifetime = Math.max(0, (existing?.lifetime_spend_egp ?? 0) - eligible);
  const rolling = Math.max(0, (existing?.rolling_spend_egp ?? 0) - eligible);
  await supabase.from("customers").update({
    lifetime_spend_egp: lifetime, rolling_spend_egp: rolling, updated_at: new Date().toISOString(),
  }).eq("shopify_customer_id", customerId);

  if (admin) await mirrorCustomer(admin, customerId, { points: out.balanceAfter, tier: existing?.tier ?? "insider", spend: lifetime });
  await trackEvent("Loyalty Points Reversed", existing?.email, { points: out.points, balance: out.balanceAfter, order_id: order.id, reason: "cancelled" });
}
