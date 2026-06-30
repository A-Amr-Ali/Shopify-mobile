// Turn a behaviour snapshot + trigger into a hyper-personalised, on-brand message
// in English. Claude writes it when funded; a graceful template is the fallback so
// the pipeline never hard-fails. Native fetch (no SDK), matching the rest of the
// codebase. Output is structured JSON, validated before it's trusted.
import { BRAND_BIBLE, EXEMPLARS, TRIGGERS, AGENT } from "../../config/brand-voice.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

const SYSTEM = `You are the personal correspondent for Sofie, an Egyptian luxury
house for cosmetics and home accessories. You write one short, hyper-personalised
note to one customer based on their behaviour and taste.

BRAND VOICE — follow exactly:
${BRAND_BIBLE}

You write ONE short note in English only. Do not write any Arabic.
Reference the specific product(s) the customer looked at or bought. Keep the body
to 2-4 short sentences. Suggest 2-3 catalog search terms for products that pair
with or relate to what they care about.

Return ONLY a compact JSON object, nothing else:
{"subject": string (<= 60 chars),
 "preview": string (<= 90 chars, preview/teaser),
 "body": string,
 "product_searches": string[]}`;

function exemplarFor(trigger) {
  const ex = EXEMPLARS.find((e) => e.trigger === trigger) || EXEMPLARS[0];
  return `Example for a "${ex.trigger}" note (tone reference, do not copy):\nSubject: ${ex.subject}\n${ex.body}`;
}

function userPrompt(snap, candidate) {
  const t = TRIGGERS[candidate.trigger];
  const lines = [
    `Trigger: ${candidate.trigger} — ${t?.label || ""}`,
    `Customer first name: ${snap.firstName || "(unknown — write warmly without a name)"}`,
    `Loyalty tier: ${snap.tier}`,
    snap.profile ? `Beauty profile: ${JSON.stringify(snap.profile)}` : "Beauty profile: (none yet)",
  ];
  if (candidate.context.items?.length) lines.push(`Items in their cart/order: ${JSON.stringify(candidate.context.items)}`);
  if (candidate.context.viewed?.length) lines.push(`Recently viewed: ${JSON.stringify(candidate.context.viewed)}`);
  if (candidate.context.valueEgp) lines.push(`Cart value: ${candidate.context.valueEgp} EGP`);
  lines.push("", exemplarFor(candidate.trigger), "", "Write the note now. Return the JSON object only.");
  return lines.join("\n");
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nope */ } }
  return null;
}

async function claudeCompose(snap, candidate) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        model: AGENT.model,
        max_tokens: AGENT.maxTokens,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt(snap, candidate) }],
      }),
    });
    if (!res.ok) { console.warn(`agent compose HTTP ${res.status}: ${await res.text()}`); return null; }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const p = extractJSON(text);
    const bodyText = p && (p.body ?? p.body_en); // tolerate either key
    if (!bodyText) return null;
    return {
      subject: String(p.subject || "").trim().slice(0, 80),
      preview: String(p.preview || "").trim().slice(0, 120),
      bodyEn: String(bodyText).trim(),
      bodyAr: "",
      productSearches: Array.isArray(p.product_searches) ? p.product_searches.slice(0, 3).map(String) : [],
      source: "claude",
    };
  } catch (err) {
    console.warn(`agent compose failed: ${err.message}`);
    return null;
  }
}

// Graceful template fallback — keeps the pipeline alive when Claude is unfunded.
function fallbackCompose(snap, candidate) {
  const name = snap.firstName ? `, ${snap.firstName}` : "";
  const product =
    candidate.context.items?.[0]?.title ||
    candidate.context.viewed?.[0]?.title ||
    "the piece you were drawn to";
  const map = {
    abandoned_cart: {
      subject: `Still thinking of it${name}?`,
      bodyEn: `Some pieces stay with us. The ${product} was waiting in your bag — and it suits you. Whenever the moment feels right, it's here for you.`,
    },
    post_purchase: {
      subject: `A little ritual to go with it`,
      bodyEn: `We hope your ${product} brings a quiet kind of joy. When you're ready, a few things pair beautifully with it.`,
    },
    browse_no_buy: {
      subject: `It caught your eye for a reason`,
      bodyEn: `The ${product} lingered with you — and we understand why. It's still here whenever you'd like to make it yours.`,
    },
    win_back: {
      subject: `We've been thinking of you`,
      bodyEn: `It's been a while, and we've missed you. A few new arrivals feel made for your taste — come see what's waiting.`,
    },
  };
  const c = map[candidate.trigger] || map.browse_no_buy;
  return {
    subject: c.subject,
    preview: c.bodyEn.slice(0, 110),
    bodyEn: c.bodyEn,
    bodyAr: "",
    productSearches: [],
    source: "fallback",
  };
}

/** Always resolves with a draft (Claude when funded, otherwise a template). */
export async function composeMessage(snap, candidate) {
  return (await claudeCompose(snap, candidate)) || fallbackCompose(snap, candidate);
}
