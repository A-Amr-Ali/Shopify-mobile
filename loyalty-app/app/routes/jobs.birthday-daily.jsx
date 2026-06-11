// POST /jobs/birthday-daily — daily cron. Finds customers whose birthday is
// today, mints a tier-appropriate gift code (once per year — the 365-day guard),
// and emits a Klaviyo event so the birthday flow emails the code.
// Auth: x-cron-key header == CRON_KEY.
import { json } from "@remix-run/node";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { mintOpenCode } from "../lib/discounts.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { CRON_KEY, SHOP_DOMAIN, BIRTHDAY } from "../config/loyalty.js";

export const action = async ({ request }) => {
  if (request.headers.get("x-cron-key") !== CRON_KEY || !CRON_KEY) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const year = now.getUTCFullYear();
  const mmdd = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  // birthday is a DATE; match on month-day regardless of birth year.
  const { data: customers, error } = await supabase
    .from("customers").select("shopify_customer_id, email, tier, birthday")
    .not("birthday", "is", null);
  if (error) return json({ error: error.message }, { status: 500 });

  const todays = (customers ?? []).filter((c) => String(c.birthday).slice(5) === mmdd);
  let admin = null;
  try { admin = await getAdmin(SHOP_DOMAIN); } catch { /* code mint best-effort */ }

  let granted = 0, skipped = 0;
  for (const c of todays) {
    // 365-day guard: one grant per customer per calendar year.
    const { error: insErr } = await supabase
      .from("birthday_grants").insert({ customer_id: c.shopify_customer_id, year, tier: c.tier });
    if (insErr) { if (insErr.code === "23505") skipped++; continue; } // already granted this year

    const gift = BIRTHDAY[c.tier] ?? BIRTHDAY.insider;
    let code = null;
    if (gift.egp > 0 && admin) {
      try {
        const minted = await mintOpenCode(admin, { amountEgp: gift.egp, prefix: BIRTHDAY.codePrefix, days: 45 });
        code = minted.code;
      } catch (e) { console.warn(`bday code mint: ${e.message}`); }
    }
    await supabase.from("birthday_grants")
      .update({ code, egp_value: gift.egp })
      .eq("customer_id", c.shopify_customer_id).eq("year", year);

    // Klaviyo birthday flow emails the code; the flow's own "not in last 365 days"
    // guard plus our birthday_grants unique constraint prevent double-sends.
    await trackEvent("Loyalty Birthday Gift", c.email, {
      tier: c.tier, gift_egp: gift.egp, code, note: gift.note, double_points: c.tier !== "insider",
    });
    granted++;
  }
  return json({ ok: true, birthdays: todays.length, granted, already_granted: skipped });
};
