// Single source of truth for the AI Sales Agent's "Emotional Luxury" brand
// voice, the triggers it acts on, and the guardrails that keep every generated
// message on-brand and never spammy. Tune here, not in the agent logic.

// ── Brand bible ────────────────────────────────────────────────────────────
// This text is injected verbatim as the system prompt's voice section. It is
// the ONE place the tone is defined, so every message — email or WhatsApp,
// English or Arabic — speaks the same way.
export const BRAND_BIBLE = `Sofie is an Egyptian luxury house for cosmetics and
home accessories. The voice is "Emotional Luxury": warm, intimate, and quietly
confident — like a trusted friend with impeccable taste writing a personal note,
never a brand blasting a promotion.

Principles:
- Speak to one person, by name, about the specific thing they looked at or loved.
- Lead with feeling and the ritual/experience, not the discount. Desire, not urgency.
- Short, graceful sentences. Generous white space. One clear, soft invitation.
- Sensory, tactile language (texture, glow, warmth, light) — but never overwrought.
- Egypt-aware and seasonally aware when relevant (heat, gatherings, gifting).
- Respect the reader's time and intelligence. No pressure, no FOMO, no hard sell.

Never do: ALL-CAPS, multiple exclamation marks, "BUY NOW", "LAST CHANCE",
"DON'T MISS OUT", "HURRY", "ACT FAST", countdown pressure, emoji spam, or any
phrase that feels like a mass marketing blast.`;

// A couple of gold-standard exemplars (few-shot) so the model anchors on the
// right register instead of drifting into generic e-commerce copy.
export const EXEMPLARS = [
  {
    trigger: "abandoned_cart",
    subject: "Still thinking of it, {{first_name}}?",
    body: `Some pieces stay with us. The {{product}} was waiting in your bag — and it suits you.\n\nWhenever the moment feels right, it's here for you.`,
  },
  {
    trigger: "post_purchase",
    subject: "A little ritual to go with it",
    body: `Your {{product}} should be arriving soon — we hope it brings a quiet kind of joy.\n\nWhen you're ready, a few things pair beautifully with it.`,
  },
];

// ── Triggers the agent acts on (v1: abandoned cart, purchase history, views) ──
export const TRIGGERS = {
  abandoned_cart: {
    label: "Abandoned cart",
    // Hours a checkout must sit untouched (and unconverted) before we reach out.
    afterHours: Number(process.env.AGENT_ABANDON_HOURS ?? 4),
    // Don't reach out about the same checkout twice.
    enabled: true,
  },
  browse_no_buy: {
    label: "Browsed, didn't buy",
    // Minimum distinct product views in the window to qualify.
    minViews: Number(process.env.AGENT_BROWSE_MIN_VIEWS ?? 3),
    windowDays: Number(process.env.AGENT_BROWSE_WINDOW_DAYS ?? 7),
    enabled: true,
  },
  post_purchase: {
    label: "Post-purchase pairing",
    // Days after a paid order to send a gentle complementary suggestion.
    afterDays: Number(process.env.AGENT_POST_PURCHASE_DAYS ?? 7),
    enabled: true,
  },
  win_back: {
    label: "Win back a lapsed customer",
    // Days since last order before a warm re-introduction.
    afterDays: Number(process.env.AGENT_WINBACK_DAYS ?? 90),
    enabled: true,
  },
};

// ── Guardrails — deterministic checks before anything is sent ────────────────
export const GUARDRAILS = {
  // Phrases that signal a spammy / pressure tone. Case-insensitive substring.
  bannedPhrases: [
    "buy now", "last chance", "don't miss", "dont miss", "hurry", "act fast",
    "act now", "limited time", "while supplies last", "clearance", "biggest sale",
    "huge sale", "flash sale", "expires soon", "ending soon", "final hours",
    "click here", "free money", "100% free", "risk-free", "no obligation",
  ],
  maxExclamations: 1,     // at most one "!" in the whole body
  maxConsecutiveCaps: 4,  // reject SHOUTY runs of 5+ capital letters
  maxEmojis: 2,
  subjectMax: 64,
  bodyMin: 40,
  bodyMax: 900,
};

// ── Agent runtime behaviour ──────────────────────────────────────────────────
export const AGENT = {
  model: process.env.AGENT_MODEL || process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
  maxTokens: Number(process.env.AGENT_MAX_TOKENS ?? 900),
  // OFF by default: messages are saved as drafts for you to review in the
  // /staff/agent console. Flip AGENT_AUTOSEND=true once you trust the output and
  // passing messages will dispatch automatically (still only if they clear the
  // guardrails).
  autoSend: /^(1|true|yes)$/i.test(String(process.env.AGENT_AUTOSEND ?? "")),
  // Safety cap: max messages a single cron run will generate (cost control).
  maxPerRun: Number(process.env.AGENT_MAX_PER_RUN ?? 25),
  // Don't message the same person more than once per this many days.
  minDaysBetweenMessages: Number(process.env.AGENT_MIN_DAYS_BETWEEN ?? 5),
  // Languages to generate. The Flow / profile locale picks which one to send.
  languages: ["en", "ar"],
  // The Klaviyo metric the dispatcher fires (your Flow listens on this).
  klaviyoMetric: process.env.AGENT_KLAVIYO_METRIC || "Sofie AI Agent Message",
};
