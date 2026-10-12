# SOFIE Knows Your Beauty

Three-month customer advice and content system for 13 October 2026 through 12 January 2027.

## Running service

The separate Railway service uses `/growth-system` on `codex/sofie-growth-2026q4`. It does not replace the loyalty app.

`npm start` serves the bilingual adviser. `npm test` verifies basket budgets, shade availability, exact SOFIE NOW eligibility, medical escalation and webhook signatures.

The adviser reads bounded category candidates through native Shopify collection queries, with the store's existing `collection.sfm` feeds as a fallback. It rechecks each selected variant's current Shopify quantity, price and publication. SOFIE NOW uses the existing exact eligible-variant field; where that field is absent it requires the product page's exact ready-option list. It does not independently verify shelf counts or courier capacity. If an inventory check is unavailable it makes no physical-stock or express-delivery assertion. Cosmetic guidance is generated from verified listing facts when the configured AI account works; a rules fallback keeps advice available.

## Persistent state

`sql/001_growth.sql` adds new, backend-only tables with RLS and no browser grants. It leaves the existing loyalty tables intact. `growth_take_budget` enforces shared API budgets. `growth_claim_publish` locks a ready record before publishing and requires a recent Shopify stock check.

The half-hour worker checks content due within 48 hours, updates product selections for unfinished drafts, and holds finished assets when their exact featured variants are unavailable. It records its results in `growth_runs`. The campaign ends automatically after 12 January 2027.

## Configuration

Production variables reuse server-side Railway references to the existing Shopify, Supabase and AI credentials. No secrets belong in Git or page content.

Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`, `SHOP_DOMAIN`, `SHOPIFY_ADMIN_CLIENT_ID`, `SHOPIFY_ADMIN_CLIENT_SECRET`, `CRON_KEY`, `STAFF_KEY`, `RATE_HASH_KEY`, `PUBLIC_ORIGIN`.

Optional: `ANTHROPIC_API_KEY`, `GROWTH_AI_MODEL`, `AI_ENABLED`, `AI_DAILY_CAP`, `LOCAL_LOCATION_ID`, `RUN_JOBS`.

The direct Meta publishing adapter remains off unless a verified token, exact @sofiesmakeupstore account ID and current Graph version are configured. Metricool scheduling is the preferred operational route when its Instagram account is connected. Never turn on both publishers for the same content record.

## Queue and assets

Run `python3 data/build_calendar.py` to reproduce the 78 draft records: 39 reels, 26 carousels and 13 weekly packages of daily story prompts. Cairo dates include the October daylight-saving transition. Target voice length is 40–50 seconds, and actual timing must be measured after video generation.

The initial generated portrait is an original fictional virtual educator called Nour. It is always disclosed as AI. No fake reviews, endorsements, credentials or synthetic before-and-after results are permitted in published assets.

## Attribution

The customer can opt in to anonymous interaction measurement. This does not subscribe them to marketing. With that consent, cart attributes connect the campaign, content and random session to the order. HMAC-verified Shopify order webhooks record attribution without customer names, addresses or contact details. `fulfilled` is never counted as `delivered`; delivery confirmations require carrier/POS evidence.

The registration of live Shopify webhooks, Metricool account verification and final asset scheduling each have separate evidence in the campaign HQ. A successful deploy does not imply that any of those integrations are active.
