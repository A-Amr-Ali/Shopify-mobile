// Interactive AI beauty advisor. Given the customer's profile + a free-text
// question ("I have an event tonight — what makeup?", "how do I fix my oily
// T-zone?"), Claude returns a short, on-brand answer plus a few catalog search
// terms we turn into add-to-cart product picks. Native fetch (no SDK), matching
// the rest of this codebase.
import { TIPS } from "../config/loyalty.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

const SYSTEM = `You are the personal beauty advisor for Sofie's Store, an Egyptian
luxury beauty boutique (brands: Rhode, Rare Beauty, Charlotte Tilbury, Huda Beauty,
Saie, Makeup by Mario, Kosas, Patrick Ta, ONE/SIZE). Voice: warm, expert, concise,
encouraging — like a knowledgeable friend at the counter. Be Egypt-aware (heat,
humidity). Use the customer's beauty profile to personalize. Give practical,
specific, step-by-step advice — short paragraphs or numbered steps, no fluff,
no medical claims. When products would help, suggest 1-3 short catalog search
terms (e.g. "matte setting spray", "hydrating primer").
Respond ONLY as compact JSON: {"answer": string, "product_searches": string[]}.
No markdown, no code fences.`;

/**
 * @returns {Promise<{answer:string, productSearches:string[]}|null>} null if Claude is unavailable
 */
export async function askAdvisor(profile, question) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const user =
    `Customer profile:\n${JSON.stringify(profile || {}, null, 2)}\n\n` +
    `Question: ${question}\n\nReturn the JSON only.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": VERSION, "content-type": "application/json" },
      body: JSON.stringify({
        model: TIPS.model,
        max_tokens: 900,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) { console.warn(`advisor HTTP ${res.status}: ${await res.text()}`); return null; }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text);
    return {
      answer: String(parsed.answer || "").trim(),
      productSearches: Array.isArray(parsed.product_searches) ? parsed.product_searches.slice(0, 3).map(String) : [],
    };
  } catch (err) {
    console.warn(`advisor failed: ${err.message}`);
    return null;
  }
}
