// Interactive beauty advisor. Uses Claude when an Anthropic key + credit are
// available; otherwise falls back to a solid rules-based answer from the
// customer's profile — so the advisor always responds (and gets smarter once
// Claude is funded). Native fetch (no SDK), matching the rest of the codebase.
import { TIPS, ADVISOR } from "../config/loyalty.js";
import { buildRulesTips } from "./tips-core.js";
import { buildKeywords } from "./recommend.server.js";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const VERSION = "2023-06-01";

const SYSTEM = `You are the personal beauty advisor for Sofie's Store, an Egyptian
luxury beauty boutique (brands: Rhode, Rare Beauty, Charlotte Tilbury, Huda Beauty,
Saie, Makeup by Mario, Kosas, Patrick Ta, ONE/SIZE). Voice: warm, expert, concise,
encouraging — like a knowledgeable friend at the counter. Be Egypt-aware (heat,
humidity). PERSONALIZE precisely to THIS customer's profile — reference their exact
skin type, undertone, shade, finish and concerns; never give a generic templated
answer, and vary your advice to the specifics. When useful, SEARCH THE WEB for
current product reviews, dupes, comparisons, and trends, and weave in what you find
(mention the source/brand). Give practical, specific, step-by-step advice — short
steps, no fluff, no medical claims. ALWAYS include 2-3 short catalog search terms in
"product_searches" that match your advice (e.g. "matte setting spray", "hydrating
primer", "warm nude lipstick").
End with ONLY a compact JSON object on its own: {"answer": string, "product_searches": string[]}.`;

function extractJSON(text) {
  try { return JSON.parse(text); } catch { /* fall through */ }
  const a = text.lastIndexOf("{");
  const b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* nope */ } }
  // First {...} block.
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nope */ } }
  return null;
}

// Claude path — returns the parsed result or null if unavailable/failed.
async function claudeAnswer(profile, question) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const user =
    `Customer profile:\n${JSON.stringify(profile || {}, null, 2)}\n\n` +
    `Question: ${question}\n\nResearch if helpful, then answer. End with the JSON object only.`;

  const payload = {
    model: TIPS.model,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  };
  if (ADVISOR.webSearch) {
    payload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: ADVISOR.maxSearches }];
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": VERSION, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { console.warn(`advisor HTTP ${res.status}: ${await res.text()}`); return null; }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const parsed = extractJSON(text);
    if (!parsed || !parsed.answer) { console.warn("advisor: no JSON in response"); return null; }
    return {
      answer: String(parsed.answer).trim(),
      productSearches: Array.isArray(parsed.product_searches) ? parsed.product_searches.slice(0, 3).map(String) : [],
      source: "claude",
    };
  } catch (err) {
    console.warn(`advisor (claude) failed: ${err.message}`);
    return null;
  }
}

// Rules-based fallback — always works, uses the profile + intent of the question.
function ruleAnswer(profile, question) {
  const q = String(question || "").toLowerCase();
  const finish = profile?.lip_finish_pref || "satin";
  let intro;
  if (/event|tonight|party|wedding|occasion|going out|date/.test(q)) {
    intro = "For your event — and Egypt's heat — make it last: prep with a hydrating primer, apply foundation in thin layers, set the T-zone with powder, then lock everything with a setting spray. Finish with a defined eye and a " + finish + " lip.";
  } else if (/routine|daily|morning|night|\bam\b|\bpm\b|steps?/.test(q)) {
    intro = "Here's a simple routine" + (profile?.skin_type ? " for your " + profile.skin_type + " skin" : "") + " — keep it consistent and never skip SPF in the morning:";
  } else if (/acne|pore|dry|oil|redness|spot|dull|sensitiv|concern|problem|fix|solve/.test(q)) {
    intro = "To target your concern, keep things gentle and consistent — layer a focused serum under your moisturizer and give it 4-6 weeks. Avoid over-exfoliating in the heat.";
  } else {
    intro = "Here's what I'd suggest based on your profile:";
  }
  const tips = buildRulesTips(profile || {});
  const body = tips.map((t) => "• " + t.title + ": " + t.body).join("\n");
  const answer = intro + (body ? "\n\n" + body : "") +
    "\n\n(Complete your Beauty Profile quiz for sharper, more personal advice.)";
  return { answer, productSearches: buildKeywords(profile).slice(0, 3), source: "rules" };
}

/**
 * @returns {Promise<{answer:string, productSearches:string[], source:string}>}
 * Always resolves with an answer (Claude when funded, otherwise rules-based).
 */
export async function askAdvisor(profile, question) {
  const claude = await claudeAnswer(profile, question);
  return claude || ruleAnswer(profile, question);
}
