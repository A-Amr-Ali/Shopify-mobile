// Minimal Anthropic Messages API client (native fetch — matches this codebase's
// no-SDK convention for Shopify/Klaviyo). Turns a structured beauty profile into
// on-brand, natural-language tips. Optional: rules-based tips always work without it.
import { TIPS } from "../config/loyalty.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

const SYSTEM = `You are the in-house beauty advisor for Sofie's Store, an Egyptian
luxury beauty boutique selling authentic Western brands (Rhode, Rare Beauty,
Charlotte Tilbury, Huda Beauty, Saie, Makeup by Mario, Kosas, Patrick Ta, ONE/SIZE).
Voice: warm, expert, concise, encouraging — never pushy. Egypt-aware (heat, humidity).
Given a customer's beauty profile and a set of rules-based starter tips, rewrite them
into 3-5 short, personal tips. Respond ONLY with a JSON array of objects
{ "title": string, "body": string }. No preamble, no markdown, no code fences.`;

/**
 * @param {object} profile  the customer's beauty profile
 * @param {Array<{title:string,body:string}>} ruleTips  rules-based seed tips
 * @returns {Promise<Array<{title,body}>|null>} null if Claude is unavailable/disabled
 */
export async function generateClaudeTips(profile, ruleTips) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!TIPS.useClaude || !apiKey) return null;

  const userContent =
    `Customer profile:\n${JSON.stringify(profile, null, 2)}\n\n` +
    `Rules-based starter tips:\n${JSON.stringify(ruleTips, null, 2)}\n\n` +
    `Return the final JSON array only.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: TIPS.model,
        max_tokens: TIPS.maxTokens,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      console.warn(`Anthropic tips HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((t) => t && t.title && t.body)
      .map((t) => ({ title: String(t.title), body: String(t.body) }));
  } catch (err) {
    console.warn(`Anthropic tips failed: ${err.message}`);
    return null;
  }
}
