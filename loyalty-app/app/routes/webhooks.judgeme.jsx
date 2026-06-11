// POST /webhooks/judgeme — Judge.me review webhook. Awards 100 pts for a
// VERIFIED-BUYER review (capped 4/month per customer, idempotent per review).
// Judge.me isn't a Shopify webhook, so we authenticate with a shared secret
// (set JUDGEME_WEBHOOK_SECRET here and in Judge.me's webhook config) and resolve
// the customer by email via the Admin API.
import { json } from "@remix-run/node";
import crypto from "node:crypto";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { awardReview } from "../lib/earn-actions.server.js";
import { mirrorCustomer } from "../lib/metafields.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { JUDGEME_SECRET, SHOP_DOMAIN } from "../config/loyalty.js";

function tokenOk(provided) {
  if (!JUDGEME_SECRET) return false;
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(JUDGEME_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function customerIdByEmail(admin, email) {
  const res = await admin.graphql(
    `query($q: String!){ customers(first: 1, query: $q){ edges { node { id } } } }`,
    { variables: { q: `email:${email}` } }
  );
  const node = (await res.json())?.data?.customers?.edges?.[0]?.node;
  return node?.id ?? null;
}

export const action = async ({ request }) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-judgeme-token");
  if (!tokenOk(token)) return json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const review = body.review || body;
  const verified = review.verified === true || review.verified_buyer === true || review.verified === "buyer";
  const email = (review.reviewer?.email || review.email || "").toLowerCase();
  const reviewId = review.id || review.review_id;
  if (!verified || !email || !reviewId) return json({ ok: true, skipped: "not_verified_buyer" });

  const admin = await getAdmin(SHOP_DOMAIN);
  const customerId = await customerIdByEmail(admin, email);
  if (!customerId) return json({ ok: true, skipped: "no_customer" });

  const out = await awardReview(customerId, reviewId);
  if (out.applied) {
    await mirrorCustomer(admin, customerId, await summary(customerId));
    await trackEvent("Loyalty Points Earned", email, { points: 100, reason: "review", balance: out.balanceAfter });
  }
  return json({ ok: true, awarded: out.applied ? 100 : 0, capped: !!out.capped });
};

async function summary(customerId) {
  const { data } = await supabase
    .from("customers").select("points_balance, tier, lifetime_spend_egp")
    .eq("shopify_customer_id", customerId).maybeSingle();
  return { points: data?.points_balance ?? 0, tier: data?.tier ?? "insider", spend: data?.lifetime_spend_egp ?? 0 };
}
