// Deterministic brand-safety checks. The model is creative; this is the seatbelt
// that catches spammy / off-brand output before it can ever reach a customer.
// Pure and unit-tested — the same check gates both the review queue and auto-send.
import { GUARDRAILS } from "../../config/brand-voice.js";

const EMOJI = /\p{Extended_Pictographic}/gu;

/**
 * @param {{subject?:string, body?:string}} msg
 * @returns {{ok:boolean, violations:string[]}}
 */
export function checkMessage({ subject = "", body = "" } = {}) {
  const v = [];
  const text = `${subject}\n${body}`;
  const lower = text.toLowerCase();

  for (const phrase of GUARDRAILS.bannedPhrases) {
    if (lower.includes(phrase)) v.push(`banned phrase: "${phrase}"`);
  }

  const bangs = (body.match(/!/g) || []).length;
  if (bangs > GUARDRAILS.maxExclamations) v.push(`too many exclamation marks (${bangs})`);

  const caps = body.match(new RegExp(`[A-Z]{${GUARDRAILS.maxConsecutiveCaps + 1},}`, "g"));
  if (caps) v.push(`shouty caps: ${caps[0]}`);

  const emojis = (text.match(EMOJI) || []).length;
  if (emojis > GUARDRAILS.maxEmojis) v.push(`too many emojis (${emojis})`);

  if (subject.length > GUARDRAILS.subjectMax) v.push(`subject too long (${subject.length})`);
  if (body.trim().length < GUARDRAILS.bodyMin) v.push("body too short");
  if (body.length > GUARDRAILS.bodyMax) v.push(`body too long (${body.length})`);

  return { ok: v.length === 0, violations: v };
}
