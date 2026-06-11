// Convenience: mirror a customer's current summary (and optional profile/tips)
// into Shopify customer metafields, fetching an offline admin client by shop.
// Used by App-Proxy routes that don't carry an admin context.
import { getAdmin } from "./admin.server.js";
import { supabase } from "../db.server.js";
import { mirrorCustomer, mirrorProfile } from "./metafields.server.js";

export async function mirrorCustomerByShop(shop, customerId) {
  try {
    const { data } = await supabase
      .from("customers")
      .select("points_balance, tier, lifetime_spend_egp")
      .eq("shopify_customer_id", customerId)
      .maybeSingle();
    const admin = await getAdmin(shop);
    await mirrorCustomer(admin, customerId, {
      points: data?.points_balance ?? 0,
      tier: data?.tier ?? "insider",
      spend: data?.lifetime_spend_egp ?? 0,
    });
  } catch (err) {
    console.warn(`mirrorCustomerByShop skipped: ${err.message}`);
  }
}

export async function mirrorProfileByShop(shop, customerId, profile, tips) {
  try {
    const admin = await getAdmin(shop);
    await mirrorProfile(admin, customerId, profile, tips);
  } catch (err) {
    console.warn(`mirrorProfileByShop skipped: ${err.message}`);
  }
}
