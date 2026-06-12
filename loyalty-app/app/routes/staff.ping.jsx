// GET /staff/ping — diagnostic: confirms whether the server actually has a
// STAFF_KEY configured, and its length (NOT the value). Lets us tell a missing
// variable apart from a typo/hidden character without exposing the password.
import { json } from "@remix-run/node";
import { STAFF_KEY, SHOP_DOMAIN } from "../config/loyalty.js";

export const loader = async () =>
  json({
    staff_key_configured: !!STAFF_KEY,
    staff_key_length: STAFF_KEY ? STAFF_KEY.length : 0,
    shop_domain_set: !!SHOP_DOMAIN,
  });
