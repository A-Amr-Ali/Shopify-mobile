// Supabase service-role client (server-side only — bypasses RLS).
// NEVER import this into anything that reaches the browser.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  // Don't crash unit tests that never touch the DB; fail loudly only on use.
  console.warn("⚠️  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail.");
}

export const supabase = createClient(url ?? "http://localhost", key ?? "anon", {
  auth: { persistSession: false },
});
