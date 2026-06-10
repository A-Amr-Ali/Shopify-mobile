import { test } from "node:test";
import assert from "node:assert/strict";
import {
  earnedPoints, reversalPoints, eligibleEgpFromOrder, redemptionByCost,
} from "../app/lib/points.server.js";

test("earnedPoints: 1pt per 10 EGP, floored", () => {
  assert.equal(earnedPoints(7500, 1), 750);
  assert.equal(earnedPoints(7509, 1), 750); // floor of the division
  assert.equal(earnedPoints(0, 1), 0);
  assert.equal(earnedPoints(-100, 1), 0);
});

test("earnedPoints: tier multipliers, final result floored", () => {
  assert.equal(earnedPoints(7500, 1.25), 937); // 750 * 1.25 = 937.5 → 937
  assert.equal(earnedPoints(7500, 1.5), 1125);
  assert.equal(earnedPoints(40000, 1.25), 5000);
});

test("reversalPoints: prorated, never exceeds original, returns negative", () => {
  assert.equal(reversalPoints(750, 7500, 7500), -750); // full refund
  assert.equal(reversalPoints(750, 7500, 3750), -375); // half
  assert.equal(reversalPoints(750, 7500, 99999), -750); // capped at original
  assert.equal(reversalPoints(0, 0, 100), 0);
});

test("eligibleEgpFromOrder excludes gift cards, rounds to whole EGP", () => {
  const order = {
    current_subtotal_price: "8000.00",
    line_items: [
      { price: "500.00", quantity: 1, gift_card: true },
      { price: "7500.00", quantity: 1, gift_card: false },
    ],
  };
  assert.equal(eligibleEgpFromOrder(order), 7500);
});

test("redemptionByCost maps to non-linear tiers", () => {
  assert.equal(redemptionByCost(100).egpValue, 50);
  assert.equal(redemptionByCost(2000).egpValue, 1200);
  assert.equal(redemptionByCost(123), null);
});
