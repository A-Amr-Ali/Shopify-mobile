// Verify a Shopify customer-account session token (JWT, HS256 signed with the
// app secret). Used by the Customer Account UI extension to authenticate calls
// to our backend. Returns { customerId, payload } or null.
import crypto from "node:crypto";

function b64urlToBuf(s) {
  return Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function verifyCustomerToken(token) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!token || !secret) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;

  const expected = b64url(crypto.createHmac("sha256", secret).update(h + "." + p).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload;
  try { payload = JSON.parse(b64urlToBuf(p).toString("utf8")); } catch { return null; }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp + 5) return null;
  if (payload.nbf && now < payload.nbf - 5) return null;

  // The customer id is in `sub` (sometimes a GID, sometimes numeric).
  let sub = payload.sub || payload.customer_id || null;
  if (!sub) return null;
  const customerId = String(sub).startsWith("gid://") ? String(sub) : `gid://shopify/Customer/${sub}`;
  return { customerId, payload };
}
