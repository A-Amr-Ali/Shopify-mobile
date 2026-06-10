import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyAppProxy, verifyWebhook } from "../app/lib/hmac.server.js";

const SECRET = "shpss_testsecret_0123456789";

function signProxy(paramsObj, secret = SECRET) {
  const params = new URLSearchParams(paramsObj);
  const message = [...params.keys()].sort()
    .map((k) => `${k}=${params.getAll(k).join(",")}`).join("");
  const signature = crypto.createHmac("sha256", secret).update(message).digest("hex");
  params.set("signature", signature);
  return params;
}

test("verifyAppProxy accepts a correctly signed request and extracts customer", () => {
  const params = signProxy({
    shop: "sofiestore.myshopify.com",
    logged_in_customer_id: "987654321",
    path_prefix: "/apps/loyalty",
    timestamp: "1718000000",
  });
  const { ok, customerId } = verifyAppProxy(params, SECRET);
  assert.equal(ok, true);
  assert.equal(customerId, "gid://shopify/Customer/987654321");
});

test("verifyAppProxy rejects a tampered request", () => {
  const params = signProxy({ shop: "sofiestore.myshopify.com", logged_in_customer_id: "1" });
  params.set("logged_in_customer_id", "2"); // tamper after signing
  const { ok, customerId } = verifyAppProxy(params, SECRET);
  assert.equal(ok, false);
  assert.equal(customerId, null);
});

test("verifyAppProxy rejects when signature missing", () => {
  const params = new URLSearchParams({ shop: "x", logged_in_customer_id: "1" });
  assert.equal(verifyAppProxy(params, SECRET).ok, false);
});

test("verifyWebhook validates the base64 body HMAC", () => {
  const body = JSON.stringify({ id: 123, total_price: "7500.00" });
  const digest = crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
  assert.equal(verifyWebhook(body, digest, SECRET), true);
  assert.equal(verifyWebhook(body, "AAAA", SECRET), false);
  assert.equal(verifyWebhook(body + " ", digest, SECRET), false);
});
