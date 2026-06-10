import { test } from "node:test";
import assert from "node:assert/strict";
import { createLedger } from "../app/lib/ledger.server.js";
import { createMemoryStore } from "../app/lib/store.memory.js";

const CUST = "gid://shopify/Customer/1";
const order = (id, subtotal) => ({ id, current_subtotal_price: String(subtotal), line_items: [] });

test("earn: awards floor(eligible/10) * multiplier", async () => {
  const ledger = createLedger(createMemoryStore());
  const r = await ledger.earnFromOrder({ customerId: CUST, order: order(1001, 7500), multiplier: 1.25 });
  assert.equal(r.applied, true);
  assert.equal(r.points, 937);
  assert.equal(r.balanceAfter, 937);
});

test("earn is idempotent per order (COD paid fires once)", async () => {
  const ledger = createLedger(createMemoryStore());
  await ledger.earnFromOrder({ customerId: CUST, order: order(1001, 7500), multiplier: 1 });
  const second = await ledger.earnFromOrder({ customerId: CUST, order: order(1001, 7500), multiplier: 1 });
  assert.equal(second.applied, false);
  assert.equal(await ledger.getBalance(CUST), 750); // not doubled
});

test("redeem: debits points; invalid tier rejected", async () => {
  const ledger = createLedger(createMemoryStore());
  await ledger.earnFromOrder({ customerId: CUST, order: order(1, 20000), multiplier: 1 }); // 2000 pts
  const red = await ledger.redeem({ customerId: CUST, pointsCost: 500, redemptionId: "rdm-1" });
  assert.equal(red.applied, true);
  assert.equal(red.balanceAfter, 1500);
  assert.equal(red.reward.egpValue, 250);
  await assert.rejects(() => ledger.redeem({ customerId: CUST, pointsCost: 123, redemptionId: "x" }), /invalid redemption/);
});

test("redeem cannot drive balance negative", async () => {
  const ledger = createLedger(createMemoryStore());
  await ledger.earnFromOrder({ customerId: CUST, order: order(1, 1000), multiplier: 1 }); // 100 pts
  await assert.rejects(
    () => ledger.redeem({ customerId: CUST, pointsCost: 2000, redemptionId: "rdm-2" }),
    /insufficient_points/
  );
  assert.equal(await ledger.getBalance(CUST), 100); // unchanged
});

test("redeem is idempotent per redemption id", async () => {
  const ledger = createLedger(createMemoryStore());
  await ledger.earnFromOrder({ customerId: CUST, order: order(1, 20000), multiplier: 1 });
  await ledger.redeem({ customerId: CUST, pointsCost: 500, redemptionId: "rdm-9" });
  const replay = await ledger.redeem({ customerId: CUST, pointsCost: 500, redemptionId: "rdm-9" });
  assert.equal(replay.applied, false);
  assert.equal(await ledger.getBalance(CUST), 1500); // debited once
});

test("refund reversal: full and partial, prorated and append-only", async () => {
  const store = createMemoryStore();
  const ledger = createLedger(store);
  await ledger.earnFromOrder({ customerId: CUST, order: order(2002, 7500), multiplier: 1 }); // 750 pts

  const partial = await ledger.reverseForRefund({ customerId: CUST, orderId: 2002, refundedEgp: 3750, refundId: "rf-1" });
  assert.equal(partial.applied, true);
  assert.equal(partial.points, -375);
  assert.equal(await ledger.getBalance(CUST), 375);

  // A second, distinct refund reverses the rest.
  const rest = await ledger.reverseForRefund({ customerId: CUST, orderId: 2002, refundedEgp: 3750, refundId: "rf-2" });
  assert.equal(rest.points, -375);
  assert.equal(await ledger.getBalance(CUST), 0);

  // Every change is a new row — nothing mutated.
  assert.equal(store._entries.length, 3); // 1 earn + 2 reversals
});

test("refund reversal is idempotent per refund id", async () => {
  const ledger = createLedger(createMemoryStore());
  await ledger.earnFromOrder({ customerId: CUST, order: order(3003, 7500), multiplier: 1 });
  await ledger.reverseForRefund({ customerId: CUST, orderId: 3003, refundedEgp: 7500, refundId: "rf-x" });
  const replay = await ledger.reverseForRefund({ customerId: CUST, orderId: 3003, refundedEgp: 7500, refundId: "rf-x" });
  assert.equal(replay.applied, false);
  assert.equal(await ledger.getBalance(CUST), 0); // reversed once
});

test("cancel reverses the full earn once", async () => {
  const ledger = createLedger(createMemoryStore());
  await ledger.earnFromOrder({ customerId: CUST, order: order(4004, 12000), multiplier: 1.25 }); // 1500
  const c = await ledger.reverseForCancel({ customerId: CUST, orderId: 4004 });
  assert.equal(c.points, -1500);
  assert.equal(await ledger.getBalance(CUST), 0);
  const replay = await ledger.reverseForCancel({ customerId: CUST, orderId: 4004 });
  assert.equal(replay.applied, false);
});
