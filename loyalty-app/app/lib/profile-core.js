// Pure profile helpers (no I/O) — safe to import in tests without a DB driver.
import { PROFILE_COMPLETION_FIELDS } from "../config/loyalty.js";

/** Percent of completion fields that are filled (0–100). */
export function completionPct(profile) {
  if (!profile) return 0;
  let filled = 0;
  for (const f of PROFILE_COMPLETION_FIELDS) {
    const v = profile[f];
    if (Array.isArray(v) ? v.length > 0 : v != null && v !== "") filled++;
  }
  return Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100);
}
