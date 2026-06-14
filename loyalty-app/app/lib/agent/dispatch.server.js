// Deliver a generated message by firing a single Klaviyo event carrying all the
// copy. Your Klaviyo Flow listens on this metric and decides the final channel
// (Email or WhatsApp) per the customer's consent + locale — so we stay
// channel-agnostic here and never re-implement deliverability/opt-out.
import { trackEvent } from "../klaviyo.server.js";
import { supabase } from "../../db.server.js";
import { AGENT } from "../../config/brand-voice.js";
import { renderEmail } from "./email.server.js";

/**
 * @param {object} message  an agent_messages row (must have email)
 * @returns {Promise<{sent:boolean, reason?:string}>}
 */
export async function dispatchMessage(message) {
  if (!message?.email) return { sent: false, reason: "no_email" };

  // Pick the body language the Flow should prefer (Flow can still switch).
  const lang = /^ar/i.test(String(message.profile_locale || "")) ? "ar" : "en";
  const body = lang === "ar" ? message.body_ar : message.body_en;
  const html = renderEmail({ subject: message.subject, preview: message.preview, body, products: message.products || [] });

  await trackEvent(AGENT.klaviyoMetric, message.email, {
    trigger: message.trigger,
    channel_hint: message.channel_hint || "email",
    language: lang,
    subject: message.subject,
    preview: message.preview,
    body_en: message.body_en,
    body_ar: message.body_ar,
    body,
    html, // full designed email — drop {{ event.html }} into a Klaviyo HTML block
    products: message.products || [],
    message_id: message.id,
  });

  await supabase.from("agent_messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", message.id);

  return { sent: true };
}
