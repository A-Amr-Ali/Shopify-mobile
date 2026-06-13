import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMessage } from "../app/lib/agent/guardrail.server.js";
import { evaluateTriggers } from "../app/lib/agent/triggers-core.js";

const NOW = Date.parse("2026-06-13T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 3600e3).toISOString();
const daysAgo = (d) => new Date(NOW - d * 864e5).toISOString();

test("guardrail passes an on-brand note", () => {
  const r = checkMessage({
    subject: "Still thinking of it?",
    body: "Some pieces stay with us. The velvet lip was waiting in your bag — and it suits you.",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test("guardrail catches spammy phrasing and shouting", () => {
  const r = checkMessage({ subject: "LAST CHANCE", body: "BUY NOW!! Don't miss out, HURRY!!!" });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.includes("banned phrase")));
  assert.ok(r.violations.some((v) => v.includes("exclamation")));
  assert.ok(r.violations.some((v) => v.includes("caps")));
});

test("guardrail rejects too-short bodies and over-long subjects", () => {
  assert.equal(checkMessage({ subject: "ok", body: "hi" }).ok, false);
  const longSubject = "x".repeat(80);
  assert.ok(checkMessage({ subject: longSubject, body: "a".repeat(60) }).violations.some((v) => v.includes("subject too long")));
});

test("abandoned cart wins once aged past the window and unconverted", () => {
  const snap = {
    customerId: "gid://shopify/Customer/1",
    viewed: [], purchaseCount: 0, lastPurchase: null,
    lastCheckout: { token: "ck1", items: [{ title: "Velvet Lip" }], valueEgp: 1200, at: hoursAgo(6) },
  };
  const [c] = evaluateTriggers(snap, NOW);
  assert.equal(c.trigger, "abandoned_cart");
  assert.equal(c.dedupeKey, "gid://shopify/Customer/1:abandoned_cart:ck1");
});

test("a fresh checkout (within the window) does not trigger", () => {
  const snap = {
    customerId: "gid://shopify/Customer/1", viewed: [], purchaseCount: 0, lastPurchase: null,
    lastCheckout: { token: "ck1", items: [{ title: "Velvet Lip" }], at: hoursAgo(1) },
  };
  assert.equal(evaluateTriggers(snap, NOW).length, 0);
});

test("a converted checkout does not trigger abandoned cart", () => {
  const snap = {
    customerId: "gid://shopify/Customer/1", viewed: [], purchaseCount: 1,
    lastCheckout: { token: "ck1", items: [{ title: "Velvet Lip" }], at: hoursAgo(8) },
    lastPurchase: { token: "order:9", items: [], at: hoursAgo(7) },
  };
  assert.equal(evaluateTriggers(snap, NOW).length, 0);
});

test("browse-no-buy triggers on repeated views with no checkout/purchase", () => {
  const snap = {
    customerId: "gid://shopify/Customer/2", purchaseCount: 0, lastPurchase: null, lastCheckout: null,
    viewed: [{ title: "A" }, { title: "B" }, { title: "C" }],
  };
  const [c] = evaluateTriggers(snap, NOW);
  assert.equal(c.trigger, "browse_no_buy");
});

test("post-purchase pairing triggers a week after a paid order", () => {
  const snap = {
    customerId: "gid://shopify/Customer/3", viewed: [], purchaseCount: 1, lastCheckout: null,
    lastPurchase: { token: "order:5", items: [{ title: "Glow Serum" }], at: daysAgo(7) },
  };
  const [c] = evaluateTriggers(snap, NOW);
  assert.equal(c.trigger, "post_purchase");
});
