// Beauty-profile persistence + completion scoring. Source of truth is the
// Postgres `profiles` table; key fields are mirrored to customer metafields by
// the caller (App-Proxy routes) so the theme can read them.
import { supabase } from "../db.server.js";
import { completionPct } from "./profile-core.js";

export { completionPct };

const QUIZ_FIELDS = [
  "foundation_shade", "foundation_brand", "highlighter_shade", "lip_shades",
  "lip_finish_pref", "skin_type", "skin_concerns", "skincare_routine",
  "undertone",
];

/** Upsert a profile from quiz answers (whitelisted fields only). */
export async function saveQuiz(customerId, answers) {
  const patch = { customer_id: customerId, source: "quiz", updated_at: new Date().toISOString() };
  for (const f of QUIZ_FIELDS) if (answers[f] !== undefined) patch[f] = answers[f];
  const { data, error } = await supabase
    .from("profiles")
    .upsert(patch, { onConflict: "customer_id" })
    .select("*")
    .single();
  if (error) throw new Error(`saveQuiz: ${error.message}`);
  const pct = completionPct(data);
  await supabase.from("profiles").update({ completion_pct: pct }).eq("customer_id", customerId);
  return { ...data, completion_pct: pct };
}

/** Append manually-entered "products I use" (deduped by brand+product+shade). */
export async function addCurrentProducts(customerId, items) {
  const { data: existing } = await supabase
    .from("profiles").select("current_products").eq("customer_id", customerId).maybeSingle();
  const current = existing?.current_products ?? [];
  const key = (x) => `${x.brand}|${x.product}|${x.shade ?? ""}`.toLowerCase();
  const seen = new Set(current.map(key));
  const merged = [...current];
  for (const it of items) {
    if (!it?.brand || !it?.product) continue;
    const clean = { brand: String(it.brand), product: String(it.product), shade: it.shade ? String(it.shade) : null };
    if (!seen.has(key(clean))) { merged.push(clean); seen.add(key(clean)); }
  }
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ customer_id: customerId, current_products: merged, updated_at: new Date().toISOString() }, { onConflict: "customer_id" })
    .select("*").single();
  if (error) throw new Error(`addCurrentProducts: ${error.message}`);
  return data;
}

export async function getProfile(customerId) {
  const { data } = await supabase.from("profiles").select("*").eq("customer_id", customerId).maybeSingle();
  return data ?? null;
}

/** Fill only the gaps from an inferred profile — never overwrite quiz/manual data. */
export async function mergeInferred(customerId, inferred) {
  const existing = (await getProfile(customerId)) ?? { customer_id: customerId };
  const patch = { customer_id: customerId, updated_at: new Date().toISOString() };
  let changed = false;
  for (const [k, v] of Object.entries(inferred)) {
    if (k === "current_products") continue; // handled additively below
    const cur = existing[k];
    const empty = Array.isArray(cur) ? !cur?.length : cur == null || cur === "";
    if (empty && v != null && (!Array.isArray(v) || v.length)) { patch[k] = v; changed = true; }
  }
  // current_products is additive even when other fields exist.
  if (inferred.current_products?.length) {
    await addCurrentProducts(customerId, inferred.current_products);
  }
  if (!changed) return getProfile(customerId);
  if (!existing.source) patch.source = "inferred";
  const { data, error } = await supabase
    .from("profiles").upsert(patch, { onConflict: "customer_id" }).select("*").single();
  if (error) throw new Error(`mergeInferred: ${error.message}`);
  return data;
}
