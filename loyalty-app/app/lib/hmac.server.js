// HMAC verification for the two trust boundaries:
//   1) Shopify App Proxy  — storefront → app  (signature query param)
//   2) Shopify Webhooks    — Shopify  → app   (X-Shopify-Hmac-Sha256 header)
// Both use SHOPIFY_API_SECRET. Comparisons are timing-safe.

import crypto from "node:crypto";

const secret = () => process.env.SHOPIFY_API_SECRET ?? "";

function timingSafeEqualHex(aHex, bHex) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verify a Shopify App Proxy request.
 * Shopify signs all query params except `signature` by:
 *   - sorting params by key
 *   - joining as `key=value` (array values joined by comma) with NO separator
 *   - HMAC-SHA256 with the app secret, hex digest
 * App Proxy strips cookies; trust `logged_in_customer_id` from the verified query.
 * @param {URL|URLSearchParams|string} input  request URL or its query
 * @returns {{ok: boolean, customerId: string|null, params: URLSearchParams}}
 */
export function verifyAppProxy(input, sharedSecret = secret()) {
  const params = toSearchParams(input);
  const signature = params.get("signature") || "";

  const pairs = [];
  for (const key of [...params.keys()].sort()) {
    if (key === "signature") continue;
    const values = params.getAll(key);
    pairs.push(`${key}=${values.join(",")}`);
  }
  const message = pairs.join("");
  const digest = crypto.createHmac("sha256", sharedSecret).update(message).digest("hex");

  const ok = !!signature && timingSafeEqualHex(digest, signature);
  const rawCid = params.get("logged_in_customer_id") || null;
  return {
    ok,
    // Only trust the customer id when the signature checks out.
    customerId: ok && rawCid ? `gid://shopify/Customer/${rawCid}` : null,
    params,
  };
}

/**
 * Verify a Shopify webhook. Pass the RAW request body (bytes/string, not parsed
 * JSON) and the header value.
 * @returns boolean
 */
export function verifyWebhook(rawBody, hmacHeader, sharedSecret = secret()) {
  if (!hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", sharedSecret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8"))
    .digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function toSearchParams(input) {
  if (input instanceof URLSearchParams) return input;
  if (input instanceof URL) return input.searchParams;
  const s = String(input);
  const qIdx = s.indexOf("?");
  return new URLSearchParams(qIdx >= 0 ? s.slice(qIdx + 1) : s);
}
