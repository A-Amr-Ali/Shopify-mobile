// Non-purchase earning: signup, quiz, current-products, social follow, review,
// referral. Each is fraud-guarded: once-only actions use a deterministic ledger
// idempotency key; the review action is monthly-capped; social is one-per-
// platform via the social_grants unique constraint.
import { supabase } from "../db.server.js";
import { createLedger } from "./ledger.server.js";
import { createSupabaseStore } from "./store.supabase.js";
import { EARN_ACTIONS, REFERRAL } from "../config/loyalty.js";
import { withinMonthlyCap } from "./earn-core.js";

const ledger = createLedger(createSupabaseStore());

export { withinMonthlyCap };

function startOfMonthISO(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function ensureCustomer(customerId, fields = {}) {
  await supabase.from("customers").upsert(
    { shopify_customer_id: customerId, ...fields },
    { onConflict: "shopify_customer_id", ignoreDuplicates: true }
  );
}

/** One-time: account creation. */
export async function awardSignup(customerId) {
  await ensureCustomer(customerId);
  return ledger.record({
    customerId, delta: EARN_ACTIONS.signup.points, reason: "signup",
    referenceType: "signup", referenceId: customerId, idempotencyKey: `signup:${customerId}`,
  });
}

/** One-time: completed the beauty-profile quiz. */
export async function awardQuiz(customerId) {
  await ensureCustomer(customerId);
  return ledger.record({
    customerId, delta: EARN_ACTIONS.quiz.points, reason: "quiz",
    referenceType: "quiz", referenceId: customerId, idempotencyKey: `quiz:${customerId}`,
  });
}

/** One-time: added "products I currently use" to the profile. */
export async function awardCurrentProducts(customerId) {
  await ensureCustomer(customerId);
  return ledger.record({
    customerId, delta: EARN_ACTIONS.currentProducts.points, reason: "social",
    referenceType: "current_products", referenceId: customerId,
    idempotencyKey: `currentproducts:${customerId}`,
  });
}

/** One per platform: social follow (instagram | tiktok). */
export async function awardSocial(customerId, platform) {
  const plat = String(platform || "").toLowerCase();
  if (!["instagram", "tiktok"].includes(plat)) throw new Error("invalid_platform");
  await ensureCustomer(customerId);
  // Unique constraint enforces once-per-platform; a duplicate insert is the guard.
  const { error } = await supabase.from("social_grants").insert({ customer_id: customerId, platform: plat });
  if (error) {
    if (error.code === "23505") return { applied: false, capped: true }; // already granted
    throw new Error(`social_grants: ${error.message}`);
  }
  return ledger.record({
    customerId, delta: EARN_ACTIONS.social.points, reason: "social",
    referenceType: "social", referenceId: plat, idempotencyKey: `social:${plat}:${customerId}`,
  });
}

/** Verified-buyer review: 100 pts, capped at 4/month, idempotent per review. */
export async function awardReview(customerId, reviewId) {
  await ensureCustomer(customerId);
  const { count, error } = await supabase
    .from("points_ledger")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("reason", "review")
    .gte("created_at", startOfMonthISO());
  if (error) throw new Error(`review cap query: ${error.message}`);
  if (!withinMonthlyCap(count ?? 0)) return { applied: false, capped: true };

  return ledger.record({
    customerId, delta: EARN_ACTIONS.review.points, reason: "review",
    referenceType: "review", referenceId: String(reviewId),
    idempotencyKey: `review:${reviewId}`,
  });
}

/** Referrer reward when the referred friend's first order is paid. */
export async function awardReferral(referrerId, referralId) {
  await ensureCustomer(referrerId);
  return ledger.record({
    customerId: referrerId, delta: REFERRAL.referrerPoints, reason: "referral",
    referenceType: "referral", referenceId: String(referralId),
    idempotencyKey: `referral:${referralId}`,
  });
}
