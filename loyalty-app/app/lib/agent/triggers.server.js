// DB-backed trigger helpers. The pure scoring lives in triggers-core.js (so it's
// testable without Supabase); here we re-export it and add the freshness checks.
import { supabase } from "../../db.server.js";
import { AGENT } from "../../config/brand-voice.js";
export { evaluateTriggers } from "./triggers-core.js";

const DAY = 864e5;

/**
 * Filter a candidate against the DB: skip if we already produced this exact
 * context (dedupe_key) or messaged this person within the cooldown window.
 */
export async function isFresh(candidate, now = Date.now()) {
  const { data: dup } = await supabase
    .from("agent_messages").select("id").eq("dedupe_key", candidate.dedupeKey).maybeSingle();
  if (dup) return false;

  const customerId = candidate.customerId || candidate.dedupeKey.split(":")[0];
  const cutoff = new Date(now - AGENT.minDaysBetweenMessages * DAY).toISOString();
  const { data: recent } = await supabase
    .from("agent_messages")
    .select("id")
    .eq("customer_id", customerId)
    .in("status", ["draft", "approved", "sent"])
    .gte("created_at", cutoff)
    .limit(1);
  return !(recent && recent.length);
}
