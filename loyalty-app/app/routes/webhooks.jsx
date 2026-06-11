// Single webhook entrypoint. shopify-app-remix verifies the HMAC and gives us
// {topic, shop, payload, admin}. Each handler is idempotent (keyed by order /
// refund id in the ledger). COD-aware: we earn on orders/paid (which fires when
// a COD order becomes paid at delivery), and reverse on refund/cancel.
import { authenticate } from "../shopify.server.js";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { createLedger } from "../lib/ledger.server.js";
import { createSupabaseStore } from "../lib/store.supabase.js";
import { eligibleEgpFromOrder, toEgp } from "../lib/points.server.js";
import { tierForSpend, multiplierFor, recomputeHeldTier } from "../lib/tier.server.js";
import { mirrorCustomer, mirrorProfile } from "../lib/metafields.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { awardSignup, awardReferral } from "../lib/earn-actions.server.js";
import { inferProfileFromOrders } from "../lib/inference.server.js";
import { mergeInferred } from "../lib/profile.server.js";
import { generateTips } from "../lib/tips.server.js";
import { REFERRAL } from "../config/loyalty.js";

const ledger = createLedger(createSupabaseStore());
const gid = (id) => (String(id).startsWith("gid://") ? String(id) : `gid://shopify/Customer/${id}`);

export const action = async ({ request }) => {
  const { topic, payload, admin: sessionAdmin, shop } = await authenticate.webhook(request);

  // The managed-install flow may not leave a stored session, so the webhook's
  // admin can be undefined. Fall back to a client-credentials admin so metafield
  // mirroring + order-history inference still run.
  let admin = sessionAdmin;
  if (!admin && shop) {
    try { admin = await getAdmin(shop); } catch (e) { console.warn(`webhook admin fallback failed: ${e.message}`); }
  }

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
      case "CUSTOMERS_CREATE":
        await onCustomerCreate(payload, admin);
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

  // Fallback signup bonus for accounts that predate the app (idempotent).
  await awardSignup(customerId).catch((e) => console.warn(`signup award: ${e.message}`));

  // Referral qualification: friend's FIRST paid order rewards the referrer.
  await qualifyReferral(customerId, email).catch((e) => console.warn(`referral qualify: ${e.message}`));

  // Order-history inference (gap-fill the profile + refresh tips).
  if (admin) {
    try {
      const inferred = await inferProfileFromOrders(admin, customerId);
      const profile = await mergeInferred(customerId, inferred);
      const { tips } = await generateTips(customerId, profile);
      await mirrorProfile(admin, customerId, profile, tips);
    } catch (e) {
      console.warn(`inference skipped: ${e.message}`);
    }
  }
}

// Reward the referrer when the referred friend's first order is paid.
async function qualifyReferral(customerId, email) {
  if (!email) return;
  // Is this the customer's first purchase?
  const { count } = await supabase
    .from("points_ledger").select("*", { count: "exact", head: true })
    .eq("customer_id", customerId).eq("reason", "purchase");
  if ((count ?? 0) !== 1) return; // not the first paid order

  const { data: ref } = await supabase
    .from("referrals").select("id, referrer_id")
    .eq("referred_email", email.toLowerCase()).eq("status", "pending").maybeSingle();
  if (!ref) return;

  const award = await awardReferral(ref.referrer_id, ref.id);
  await supabase.from("referrals").update({
    status: "rewarded", referred_customer_id: customerId,
  }).eq("id", ref.id);

  const { data: referrer } = await supabase
    .from("customers").select("email").eq("shopify_customer_id", ref.referrer_id).maybeSingle();
  if (award.applied) {
    await trackEvent("Loyalty Referral Rewarded", referrer?.email, {
      points: REFERRAL.referrerPoints, balance: award.balanceAfter, referred_email: email,
    });
  }
}

// New account → 100-pt join bonus + mirror (idempotent).
async function onCustomerCreate(customer, admin) {
  if (!customer?.id) return;
  const customerId = gid(customer.id);
  const email = customer.email;
  await supabase.from("customers").upsert(
    { shopify_customer_id: customerId, email, birthday: parseBirthday(customer) },
    { onConflict: "shopify_customer_id" }
  );
  const award = await awardSignup(customerId);
  if (!award.applied) return;
  if (admin) await mirrorCustomer(admin, customerId, { points: award.balanceAfter, tier: "insider", spend: 0 });
  await trackEvent("Loyalty Points Earned", email, { points: 100, reason: "signup", balance: award.balanceAfter });
}

// Birthday may arrive as a customer metafield/note; best-effort parse (YYYY-MM-DD).
function parseBirthday(customer) {
  const raw = customer.birthday || customer.note_attributes?.find?.((n) => /birth/i.test(n.name))?.value;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
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
