import { test } from "node:test";
import assert from "node:assert/strict";
import { completionPct } from "../app/lib/profile-core.js";
import {
  parseFinish, parseUndertone, signalsForLineItem, buildInferredProfile, metafieldsToSignals,
} from "../app/lib/inference.server.js";
import { buildRulesTips } from "../app/lib/tips-core.js";
import { withinMonthlyCap } from "../app/lib/earn-core.js";

test("completionPct counts filled fields (arrays count when non-empty)", () => {
  assert.equal(completionPct(null), 0);
  assert.equal(completionPct({}), 0);
  assert.equal(completionPct({ skin_type: "oily" }), 20);
  assert.equal(completionPct({
    skin_type: "oily", undertone: "warm", skin_concerns: ["acne"],
    foundation_shade: "230", lip_finish_pref: "matte",
  }), 100);
  assert.equal(completionPct({ skin_concerns: [] }), 0); // empty array doesn't count
});

test("inference parsers: finish + undertone keywords", () => {
  assert.equal(parseFinish("Soft Matte Lip Cream"), "matte");
  assert.equal(parseFinish("Dewy Set Spray"), "dewy");
  assert.equal(parseFinish("nothing here"), null);
  assert.equal(parseUndertone("Warm Honey 320"), "warm");
  assert.equal(parseUndertone("Cool Rose"), "cool");
  assert.equal(parseUndertone("Neutral 200"), "neutral");
  assert.equal(parseUndertone("320"), null);
});

test("metafields win over title parsing", () => {
  const s = signalsForLineItem({
    title: "Foundation", variantTitle: "Matte 320", vendor: "Rare Beauty",
    metafields: [{ node: { key: "finish", value: "dewy" } }, { node: { key: "shade", value: "320W" } }],
    category: "Foundation",
  });
  assert.equal(s.finish, "dewy");   // metafield beats the "Matte" in the variant
  assert.equal(s.shade, "320W");    // metafield shade beats variantTitle
  assert.equal(s.brand, "Rare Beauty");
});

test("metafieldsToSignals maps keys", () => {
  const sig = metafieldsToSignals([
    { node: { key: "shade", value: "210" } },
    { node: { key: "undertone", value: "cool" } },
  ]);
  assert.equal(sig.shade, "210");
  assert.equal(sig.undertone, "cool");
});

test("buildInferredProfile aggregates owned products, foundation, dominant finish/undertone", () => {
  const profile = buildInferredProfile([
    { brand: "Rare Beauty", product: "Soft Pinch Blush", shade: "Joy", finish: "matte", undertone: "cool", category: "Blush" },
    { brand: "Charlotte Tilbury", product: "Airbrush Foundation", shade: "8 Warm", finish: "matte", undertone: "warm", category: "Foundation" },
    { brand: "Saie", product: "Glowy Gel", shade: null, finish: "dewy", undertone: null, category: "Highlighter" },
  ]);
  assert.equal(profile.current_products.length, 3);
  assert.equal(profile.foundation_shade, "8 Warm");
  assert.equal(profile.foundation_brand, "Charlotte Tilbury");
  assert.equal(profile.lip_finish_pref, "matte"); // 2 matte vs 1 dewy
});

test("buildRulesTips produces routine + undertone + owned-product tips", () => {
  const tips = buildRulesTips({
    skin_type: "oily", undertone: "warm", lip_finish_pref: "matte",
    skin_concerns: ["large pores"],
    current_products: [{ brand: "Rhode", product: "Peptide Lip" }],
  });
  const titles = tips.map((t) => t.title).join(" | ");
  assert.match(titles, /oily skin routine/);
  assert.match(titles, /Shades that flatter/);
  assert.match(titles, /matte lip/);
  assert.match(titles, /Complete your routine/);
  assert.ok(tips.every((t) => t.title && t.body));
});

test("buildRulesTips empty for empty profile", () => {
  assert.deepEqual(buildRulesTips(null), []);
  assert.deepEqual(buildRulesTips({}), []);
});

test("withinMonthlyCap enforces the 4/month review cap", () => {
  assert.equal(withinMonthlyCap(0), true);
  assert.equal(withinMonthlyCap(3), true);
  assert.equal(withinMonthlyCap(4), false);
  assert.equal(withinMonthlyCap(2, 2), false);
});
