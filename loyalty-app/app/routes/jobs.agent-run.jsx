// POST /jobs/agent-run — the AI Sales Agent pipeline. Scores recently-active
// customers, generates a personalised English note for those who qualify,
// attaches shoppable products, runs the brand guardrail, and either saves a
// DRAFT for review (default) or dispatches it (AGENT_AUTOSEND=true). Idempotent
// via dedupe_key. Auth: x-cron-key header == CRON_KEY.
import { json } from "@remix-run/node";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { CRON_KEY, SHOP_DOMAIN } from "../config/loyalty.js";
import { AGENT } from "../config/brand-voice.js";
import { activeCustomers, buildSnapshot } from "../lib/agent/insights.server.js";
import { evaluateTriggers, isFresh } from "../lib/agent/triggers.server.js";
import { composeMessage } from "../lib/agent/compose.server.js";
import { checkMessage } from "../lib/agent/guardrail.server.js";
import { dispatchMessage } from "../lib/agent/dispatch.server.js";
import { searchByKeywords, bestSellers } from "../lib/recommend.server.js";

export const action = async ({ request }) => {
  if (request.headers.get("x-cron-key") !== CRON_KEY || !CRON_KEY) {
    return json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  let admin = null;
  try { admin = await getAdmin(SHOP_DOMAIN); } catch { /* products best-effort */ }

  const ids = await activeCustomers({ days: 14, limit: 500 });
  const summary = { scanned: ids.length, drafted: 0, sent: 0, held: 0, skipped: 0 };

  for (const id of ids) {
    if (summary.drafted + summary.sent >= AGENT.maxPerRun) break;

    const snap = await buildSnapshot(id);
    if (!snap.email) { summary.skipped++; continue; }

    const [candidate] = evaluateTriggers(snap, now);
    if (!candidate) { summary.skipped++; continue; }
    candidate.customerId = snap.customerId;
    if (!(await isFresh(candidate, now))) { summary.skipped++; continue; }

    // Generate the note (Claude or template), then attach real products.
    const draft = await composeMessage(snap, candidate);
    const products = await resolveProducts(admin, draft.productSearches, snap, candidate);

    // Guardrail the English copy.
    const g = checkMessage({ subject: draft.subject, body: draft.bodyEn });
    const autoOk = AGENT.autoSend && g.ok && draft.source === "claude";

    const row = {
      customer_id: snap.customerId,
      email: snap.email,
      trigger: candidate.trigger,
      channel_hint: "email",
      subject: draft.subject,
      preview: draft.preview,
      body_en: draft.bodyEn,
      body_ar: draft.bodyAr,
      products,
      guardrail: g,
      status: autoOk ? "approved" : "draft",
      source: draft.source,
      dedupe_key: candidate.dedupeKey,
    };

    const { data: inserted, error } = await supabase
      .from("agent_messages").insert(row).select("*").maybeSingle();
    if (error) {
      if (error.code === "23505") { summary.skipped++; continue; } // raced dedupe
      console.warn(`agent insert: ${error.message}`); summary.skipped++; continue;
    }

    if (autoOk) {
      const r = await dispatchMessage({ ...inserted, profile_locale: snap.locale });
      if (r.sent) summary.sent++; else { summary.held++; }
    } else {
      if (!g.ok) summary.held++; else summary.drafted++;
    }
  }

  return json({ ok: true, mode: AGENT.autoSend ? "auto" : "review", ...summary });
};

// Map the model's search terms to in-stock catalog cards; fall back to bestsellers.
async function resolveProducts(admin, searches, snap, candidate) {
  if (!admin) return [];
  const terms = (searches && searches.length)
    ? searches
    : (candidate.context.items || candidate.context.viewed || []).map((i) => i.title).filter(Boolean);
  let cards = terms.length ? await searchByKeywords(admin, terms, 4) : [];
  if (cards.length < 2) {
    const fill = await bestSellers(admin, 4);
    const seen = new Set(cards.map((c) => c.variantId));
    for (const c of fill) { if (!seen.has(c.variantId)) cards.push(c); if (cards.length >= 4) break; }
  }
  return cards.slice(0, 4);
}
