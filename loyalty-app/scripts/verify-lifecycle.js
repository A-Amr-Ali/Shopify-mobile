#!/usr/bin/env node
// End-to-end smoke test for the loyalty app against a REAL Supabase instance.
// Walks the full customer lifecycle through the actual server libraries
// (ledger, earn-actions, profile, tips) and asserts the balance math at every
// step. The points ledger is append-only, so each run uses a fresh, clearly
// labelled TEST-* customer id; clean up afterwards with
// `scripts/cleanup-test-data.sql`.
//
//   Prereqs: npm install, and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env,
//            with migrations 0001–0003 applied.
//
//   Usage:
//     node scripts/verify-lifecycle.js                 # DB lifecycle (default)
//     node scripts/verify-lifecycle.js --proxy URL     # also ping the live App Proxy
//
// Exits non-zero on the first failed assertion.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { supabase } from "../app/db.server.js";
import { createLedger } from "../app/lib/ledger.server.js";
import { createSupabaseStore } from "../app/lib/store.supabase.js";
import {
  awardSignup, awardQuiz, awardCurrentProducts, awardSocial, awardReview, awardReferral,
} from "../app/lib/earn-actions.server.js";
import { saveQuiz, addCurrentProducts } from "../app/lib/profile.server.js";
import { generateTips } from "../app/lib/tips.server.js";
import { recomputeHeldTier, tierForSpend } from "../app/lib/tier.server.js";
import { eligibleEgpFromOrder } from "../app/lib/points.server.js";
import { EARN_ACTIONS, REFERRAL, REDEMPTION_TIERS } from "../app/config/loyalty.js";

const ledger = createLedger(createSupabaseStore());
const ts = Date.now();
const CUST = `gid://shopify/Customer/TEST-${ts}`;
const REFERRER = `gid://shopify/Customer/TEST-REF-${ts}`;
const EMAIL = `loyalty-test-${ts}@example.com`;

let passed = 0;
async function step(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    console.error(`  \x1b[31m✗ ${name}\x1b[0m\n    ${err.message}`);
    process.exit(1);
  }
}
const bal = () => ledger.getBalance(CUST);
async function expectBalance(n) {
  const b = await bal();
  assert.equal(b, n, `expected balance ${n}, got ${b}`);
}

async function dbLifecycle() {
  console.log(`\n🧪 DB lifecycle  ·  customer ${CUST}\n`);

  await step(`signup → +${EARN_ACTIONS.signup.points}`, async () => {
    await supabase.from("customers").upsert(
      { shopify_customer_id: CUST, email: EMAIL }, { onConflict: "shopify_customer_id" });
    const r = await awardSignup(CUST);
    assert.equal(r.applied, true);
    await expectBalance(100);
  });

  await step("signup is idempotent (no double award)", async () => {
    const again = await awardSignup(CUST);
    assert.equal(again.applied, false);
    await expectBalance(100);
  });

  await step(`quiz saves profile + awards +${EARN_ACTIONS.quiz.points}`, async () => {
    const profile = await saveQuiz(CUST, {
      skin_type: "oily", undertone: "warm", lip_finish_pref: "matte",
      foundation_shade: "230 Warm", skin_concerns: ["large pores", "dullness"],
    });
    assert.equal(profile.skin_type, "oily");
    assert.ok(profile.completion_pct >= 80, `completion ${profile.completion_pct}`);
    const r = await awardQuiz(CUST);
    assert.equal(r.applied, true);
    await expectBalance(350);
  });

  await step("tips generated + cached on profile", async () => {
    const { tips, source } = await generateTips(CUST);
    assert.ok(Array.isArray(tips) && tips.length > 0, "expected at least one tip");
    assert.ok(tips.every((t) => t.title && t.body));
    console.log(`      (${tips.length} tips, source=${source})`);
  });

  await step(`add current products → +${EARN_ACTIONS.currentProducts.points}`, async () => {
    await addCurrentProducts(CUST, [{ brand: "Rhode", product: "Peptide Lip Treatment", shade: "Salted Caramel" }]);
    const r = await awardCurrentProducts(CUST);
    assert.equal(r.applied, true);
    await expectBalance(400);
  });

  await step(`social follow (instagram) → +${EARN_ACTIONS.social.points}`, async () => {
    const r = await awardSocial(CUST, "instagram");
    assert.equal(r.applied, true);
    await expectBalance(450);
  });

  await step("social follow is once-per-platform", async () => {
    const again = await awardSocial(CUST, "instagram");
    assert.equal(again.applied, false);
    await expectBalance(450);
  });

  let order;
  await step("orders/paid earn (7,500 EGP × insider 1.0 → +750)", async () => {
    order = { id: `TEST-ORD-${ts}`, current_subtotal_price: "7500.00", line_items: [], source_name: "web" };
    const r = await ledger.earnFromOrder({ customerId: CUST, order, multiplier: 1.0 });
    assert.equal(r.applied, true);
    assert.equal(r.points, 750);
    await expectBalance(1200);
  });

  await step("orders/paid is idempotent per order", async () => {
    const again = await ledger.earnFromOrder({ customerId: CUST, order, multiplier: 1.0 });
    assert.equal(again.applied, false);
    await expectBalance(1200);
  });

  await step("spend + tier columns update (rolling spend, held tier)", async () => {
    const eligible = eligibleEgpFromOrder(order); // 7500
    const { tier, lockedUntil } = recomputeHeldTier("insider", null, eligible);
    await supabase.from("customers").update({
      lifetime_spend_egp: eligible, rolling_spend_egp: eligible, tier, tier_locked_until: lockedUntil,
    }).eq("shopify_customer_id", CUST);
    const { data } = await supabase.from("customers")
      .select("rolling_spend_egp, tier").eq("shopify_customer_id", CUST).maybeSingle();
    assert.equal(data.rolling_spend_egp, 7500);
    assert.equal(data.tier, tierForSpend(7500).key); // insider at 7.5k
  });

  await step(`verified review → +${EARN_ACTIONS.review.points} (capped 4/mo)`, async () => {
    const r = await awardReview(CUST, `TEST-REV-${ts}`);
    assert.equal(r.applied, true);
    await expectBalance(1300);
  });

  await step("review is idempotent per review id", async () => {
    const again = await awardReview(CUST, `TEST-REV-${ts}`);
    assert.equal(again.applied, false);
    await expectBalance(1300);
  });

  await step(`referral rewards the referrer (+${REFERRAL.referrerPoints})`, async () => {
    await supabase.from("customers").upsert(
      { shopify_customer_id: REFERRER, email: `ref-${EMAIL}` }, { onConflict: "shopify_customer_id" });
    const { data: ref } = await supabase.from("referrals")
      .insert({ referrer_id: REFERRER, referred_email: EMAIL, status: "pending" })
      .select("id").single();
    const r = await awardReferral(REFERRER, ref.id);
    assert.equal(r.applied, true);
    const refBal = await ledger.getBalance(REFERRER);
    assert.equal(refBal, REFERRAL.referrerPoints);
  });

  const reward = REDEMPTION_TIERS.find((t) => t.pointsCost === 500);
  await step(`redeem ${reward.pointsCost} pts (debit) → −500`, async () => {
    const r = await ledger.redeem({ customerId: CUST, pointsCost: reward.pointsCost, redemptionId: `TEST-RDM-${ts}` });
    assert.equal(r.applied, true);
    assert.equal(r.reward.egpValue, reward.egpValue);
    await expectBalance(800);
    // NOTE: the live /redeem route also mints a Shopify code via Admin API; this
    // smoke test exercises the ledger debit only (no OAuth admin context here).
  });

  await step("redeem cannot overdraw the balance", async () => {
    await assert.rejects(
      () => ledger.redeem({ customerId: CUST, pointsCost: 2000, redemptionId: `TEST-RDM2-${ts}` }),
      /insufficient_points/);
    await expectBalance(800);
  });

  await step("refund reversal (full 7,500 EGP refund → −750)", async () => {
    const r = await ledger.reverseForRefund({ customerId: CUST, orderId: order.id, refundedEgp: 7500, refundId: `TEST-RF-${ts}` });
    assert.equal(r.applied, true);
    assert.equal(r.points, -750);
    await expectBalance(50);
  });

  await step("final ledger reconciles to the cached balance", async () => {
    const { data: rows } = await supabase.from("points_ledger")
      .select("delta, reason, balance_after").eq("customer_id", CUST).order("id");
    const sum = rows.reduce((s, r) => s + r.delta, 0);
    assert.equal(sum, 50, `ledger sum ${sum} != 50`);
    assert.equal(rows[rows.length - 1].balance_after, 50);
    console.log(`      (${rows.length} ledger rows: ${rows.map((r) => r.reason).join(", ")})`);
  });
}

// ── Optional: ping the live App Proxy /me with a valid Shopify signature ──
async function proxyPing(baseUrl) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) { console.error("  ✗ proxy: SHOPIFY_API_SECRET not set"); process.exit(1); }
  console.log(`\n🌐 App Proxy connectivity  ·  ${baseUrl}\n`);

  // Use a real numeric id if provided, else 0 (returns not_logged_in, still proves HMAC+route).
  const cid = process.env.PROXY_TEST_CUSTOMER_ID || "0";
  const params = new URLSearchParams({
    shop: process.env.SHOP_DOMAIN || "sofiestore.myshopify.com",
    logged_in_customer_id: cid,
    path_prefix: "/apps/loyalty",
    timestamp: String(Math.floor(Date.now() / 1000)),
  });
  const message = [...params.keys()].sort().map((k) => `${k}=${params.getAll(k).join(",")}`).join("");
  params.set("signature", crypto.createHmac("sha256", secret).update(message).digest("hex"));

  await step("GET /apps/loyalty/me returns 200 with a valid signature", async () => {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/me?${params}`, { headers: { Accept: "application/json" } });
    assert.equal(res.status, 200, `HTTP ${res.status}`);
    const body = await res.json();
    assert.ok("balance" in body || body.error === "not_logged_in", `unexpected body: ${JSON.stringify(body)}`);
    console.log(`      (response: ${JSON.stringify(body).slice(0, 120)})`);
  });
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and apply migrations 0001–0003) first.");
    process.exit(2);
  }
  await dbLifecycle();

  const proxyIdx = process.argv.indexOf("--proxy");
  if (proxyIdx !== -1 && process.argv[proxyIdx + 1]) {
    await proxyPing(process.argv[proxyIdx + 1]);
  }

  console.log(`\n\x1b[32m✅ All ${passed} checks passed.\x1b[0m`);
  console.log(`   Test rows are labelled TEST-${ts}; remove them with scripts/cleanup-test-data.sql.\n`);
}

main().catch((err) => { console.error(`\n❌ ${err.stack || err.message}\n`); process.exit(1); });
