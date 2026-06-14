// POST /staff/agent-api — backend for the AI Sales Agent review console.
// Protected by STAFF_KEY (sent in the body). Actions:
//   list  → pending drafts to review
//   test  → generate a preview for one email WITHOUT saving or sending
//   test_send → fire ONE real event to Klaviyo for that email (creates the
//               metric + lets you see the live email) — does not save a draft
//   send  → dispatch a draft now (after a final guardrail check)
//   skip  → discard a draft
//   edit  → save manual edits to a draft's copy
import { json } from "@remix-run/node";
import { getAdmin } from "../lib/admin.server.js";
import { supabase } from "../db.server.js";
import { STAFF_KEY, SHOP_DOMAIN } from "../config/loyalty.js";
import { AGENT } from "../config/brand-voice.js";
import { buildSnapshot } from "../lib/agent/insights.server.js";
import { evaluateTriggers } from "../lib/agent/triggers.server.js";
import { composeMessage } from "../lib/agent/compose.server.js";
import { checkMessage } from "../lib/agent/guardrail.server.js";
import { dispatchMessage } from "../lib/agent/dispatch.server.js";
import { renderEmail } from "../lib/agent/email.server.js";
import { trackEvent } from "../lib/klaviyo.server.js";
import { searchByKeywords, bestSellers } from "../lib/recommend.server.js";

export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!STAFF_KEY) return json({ error: "staff_key_not_set" }, { status: 503 });
  if (String(body.key ?? "").trim() !== STAFF_KEY.trim()) return json({ error: "unauthorized" }, { status: 401 });

  switch (body.action) {
    case "list": return listDrafts();
    case "test": return testForEmail(body);
    case "test_send": return testSend(body);
    case "send": return sendDraft(body);
    case "skip": return skipDraft(body);
    case "edit": return editDraft(body);
    default: return json({ error: "bad_action" }, { status: 400 });
  }
};

async function listDrafts() {
  const { data, error } = await supabase
    .from("agent_messages")
    .select("id, email, trigger, subject, preview, body_en, body_ar, products, guardrail, status, source, created_at")
    .in("status", ["draft", "approved"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: error.message }, { status: 500 });
  return json({ ok: true, drafts: data ?? [] });
}

async function products(admin, terms) {
  if (!admin) return [];
  let cards = terms?.length ? await searchByKeywords(admin, terms, 4) : [];
  if (cards.length < 2) {
    const fill = await bestSellers(admin, 4);
    const seen = new Set(cards.map((c) => c.variantId));
    for (const c of fill) { if (!seen.has(c.variantId)) cards.push(c); if (cards.length >= 4) break; }
  }
  return cards.slice(0, 4);
}

function pickTestCandidate(snap, forced) {
  const [evald] = evaluateTriggers(snap);
  let cand = evald;
  if (!cand) {
    if (snap.viewed.length) cand = { trigger: "browse_no_buy", dedupeKey: "test", context: { viewed: snap.viewed.slice(0, 5) } };
    else if (snap.lastPurchase) cand = { trigger: "post_purchase", dedupeKey: "test", context: { items: snap.lastPurchase.items } };
    else cand = { trigger: "win_back", dedupeKey: "test", context: { tier: snap.tier } };
  }
  if (forced) cand = { ...cand, trigger: forced };
  cand.customerId = snap.customerId;
  return cand;
}

// Resolve an email → customer, then compose a draft + products. Shared by the
// preview and the test-send paths. Returns { error } or { snap, candidate, draft, cards }.
async function buildPreview(body) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!email.includes("@")) return { error: "bad_email", status: 400 };

  let admin = null, custId = null;
  try {
    admin = await getAdmin(SHOP_DOMAIN);
    const res = await admin.graphql(
      `query($q:String!){ customers(first:1, query:$q){ edges { node { id } } } }`,
      { variables: { q: `email:${email}` } }
    );
    custId = (await res.json())?.data?.customers?.edges?.[0]?.node?.id || null;
  } catch (e) { /* fall back to whatever we have locally */ }

  if (custId) {
    await supabase.from("customers").upsert(
      { shopify_customer_id: custId, email }, { onConflict: "shopify_customer_id", ignoreDuplicates: true });
  } else {
    const { data } = await supabase.from("customers").select("shopify_customer_id").eq("email", email).maybeSingle();
    custId = data?.shopify_customer_id;
  }
  if (!custId) return { error: "no_customer", status: 404 };

  const snap = await buildSnapshot(custId);
  const candidate = pickTestCandidate(snap, body.trigger);
  const draft = await composeMessage(snap, candidate);
  const cards = await products(admin, draft.productSearches);
  return { email, snap, candidate, draft, cards };
}

// Generate a live preview for one customer — the "test before going live" path.
async function testForEmail(body) {
  const r = await buildPreview(body);
  if (r.error) return json({ error: r.error }, { status: r.status || 400 });
  const { candidate, draft, cards } = r;
  const g = checkMessage({ subject: draft.subject, body: `${draft.bodyEn}\n${draft.bodyAr}` });
  return json({
    ok: true,
    preview: {
      trigger: candidate.trigger, source: draft.source,
      subject: draft.subject, preview: draft.preview,
      body_en: draft.bodyEn, body_ar: draft.bodyAr,
      products: cards, guardrail: g,
    },
  });
}

// Fire ONE real Klaviyo event for this email (and deliver via your Flow). Used to
// create the metric in Klaviyo and to see the actual email. No draft is saved.
async function testSend(body) {
  const r = await buildPreview(body);
  if (r.error) return json({ error: r.error }, { status: r.status || 400 });
  const { email, snap, candidate, draft, cards } = r;
  const lang = /^ar/i.test(String(snap.locale || "")) ? "ar" : "en";
  const bodyText = lang === "ar" ? draft.bodyAr : draft.bodyEn;
  const html = renderEmail({ subject: draft.subject, preview: draft.preview, body: bodyText, products: cards });
  await trackEvent(AGENT.klaviyoMetric, email, {
    trigger: candidate.trigger,
    channel_hint: "email",
    language: lang,
    subject: draft.subject,
    preview: draft.preview,
    body_en: draft.bodyEn,
    body_ar: draft.bodyAr,
    body: bodyText,
    html,
    products: cards,
    test: true,
  });
  return json({ ok: true, sent: true, to: email });
}

async function sendDraft(body) {
  const { data: msg } = await supabase.from("agent_messages").select("*").eq("id", body.id).maybeSingle();
  if (!msg) return json({ error: "not_found" }, { status: 404 });
  if (msg.status === "sent") return json({ ok: true, already: true });

  const g = checkMessage({ subject: msg.subject, body: `${msg.body_en}\n${msg.body_ar}` });
  if (!g.ok && !body.override) return json({ error: "guardrail", violations: g.violations }, { status: 422 });

  const { data: cust } = await supabase.from("customers").select("locale").eq("shopify_customer_id", msg.customer_id).maybeSingle();
  const r = await dispatchMessage({ ...msg, profile_locale: cust?.locale });
  return r.sent ? json({ ok: true }) : json({ error: r.reason || "send_failed" }, { status: 502 });
}

async function skipDraft(body) {
  const { error } = await supabase.from("agent_messages").update({ status: "skipped" }).eq("id", body.id);
  return error ? json({ error: error.message }, { status: 500 }) : json({ ok: true });
}

async function editDraft(body) {
  const patch = {};
  for (const k of ["subject", "preview", "body_en", "body_ar"]) if (typeof body[k] === "string") patch[k] = body[k];
  if (!Object.keys(patch).length) return json({ error: "nothing_to_edit" }, { status: 400 });
  patch.guardrail = checkMessage({ subject: patch.subject ?? "", body: `${patch.body_en ?? ""}\n${patch.body_ar ?? ""}` });
  const { error } = await supabase.from("agent_messages").update(patch).eq("id", body.id);
  return error ? json({ error: error.message }, { status: 500 }) : json({ ok: true, guardrail: patch.guardrail });
}
