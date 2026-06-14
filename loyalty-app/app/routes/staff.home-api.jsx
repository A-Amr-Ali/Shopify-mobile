// POST /staff/home-api — live status for the Mission Control page. Returns
// today's sends, the review-queue size, behaviour activity, and which
// integrations are configured. Protected by STAFF_KEY (sent in the body).
import { json } from "@remix-run/node";
import { supabase } from "../db.server.js";
import { STAFF_KEY } from "../config/loyalty.js";
import { AGENT } from "../config/brand-voice.js";
import { mailerConfigured } from "../lib/agent/mailer.server.js";

export const action = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  if (!STAFF_KEY) return json({ error: "staff_key_not_set" }, { status: 503 });
  if (String(body.key ?? "").trim() !== STAFF_KEY.trim()) return json({ error: "unauthorized" }, { status: 401 });

  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.toISOString();

  const tally = async (table, build) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count ?? 0;
  };

  const [sentToday, queue, totalCustomers, eventsToday] = await Promise.all([
    tally("agent_messages", (q) => q.eq("status", "sent").gte("sent_at", since)),
    tally("agent_messages", (q) => q.in("status", ["draft", "approved"])),
    tally("customers"),
    tally("customer_events", (q) => q.gte("created_at", since)),
  ]);

  const { data: last } = await supabase
    .from("agent_messages").select("created_at")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const emailProvider = process.env.RESEND_API_KEY ? "resend" : (process.env.BREVO_API_KEY ? "brevo" : "none");

  return json({
    ok: true,
    mode: AGENT.autoSend ? "auto" : "review",
    sentToday, queue, totalCustomers, eventsToday,
    lastMessageAt: last?.created_at ?? null,
    integrations: {
      email: mailerConfigured() ? emailProvider : "none",
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      klaviyo: !!process.env.KLAVIYO_API_KEY,
      supabase: !!process.env.SUPABASE_URL,
    },
  });
};
