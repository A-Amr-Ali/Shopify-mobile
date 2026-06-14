// Direct transactional email sender — so the AI Sales Agent can send without a
// paid Klaviyo plan. Provider is auto-detected from env (whichever key is set):
//   RESEND_API_KEY  → Resend  (3,000/mo free)
//   BREVO_API_KEY   → Brevo   (300/day free)
// Native fetch, no SDK. Returns { ok } or { ok:false, error }.
import { EMAIL } from "../../config/brand-voice.js";

/** True when a direct email provider is configured (prefer it over Klaviyo). */
export function mailerConfigured() {
  return !!((process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) && EMAIL.fromEmail);
}

export async function sendEmail({ to, subject, html }) {
  const from = EMAIL.fromEmail;
  const fromName = EMAIL.fromName;
  if (!to) return { ok: false, error: "no_recipient" };
  if (!from) return { ok: false, error: "EMAIL_FROM not set" };

  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from: `${fromName} <${from}>`, to: [to], subject, html }),
      });
      if (!r.ok) return { ok: false, error: `resend ${r.status}: ${await r.text()}` };
      return { ok: true, via: "resend" };
    }
    if (process.env.BREVO_API_KEY) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { name: fromName, email: from },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });
      if (!r.ok) return { ok: false, error: `brevo ${r.status}: ${await r.text()}` };
      return { ok: true, via: "brevo" };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: "no_mail_provider" };
}
