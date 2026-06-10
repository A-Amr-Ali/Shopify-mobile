// Personalized tips engine. Rules-based first (deterministic, always available);
// optionally enhanced into natural-language prose by Claude. Pure rule functions
// are unit-tested; generateTips() composes them and caches the result on the profile.
import { supabase } from "../db.server.js";
import { generateClaudeTips } from "./anthropic.server.js";
import { buildRulesTips } from "./tips-core.js";

export { buildRulesTips };

/**
 * Build tips for a customer, cache them on the profile. Returns { tips, source }.
 */
export async function generateTips(customerId, profileOverride) {
  let profile = profileOverride;
  if (!profile) {
    const { data } = await supabase.from("profiles").select("*").eq("customer_id", customerId).maybeSingle();
    profile = data;
  }
  const ruleTips = buildRulesTips(profile);
  let tips = ruleTips;
  let source = "rules";

  const claude = await generateClaudeTips(profile, ruleTips);
  if (claude && claude.length) { tips = claude; source = "claude"; }

  await supabase.from("profiles").update({
    tips, tips_updated_at: new Date().toISOString(),
  }).eq("customer_id", customerId);

  return { tips, source };
}
