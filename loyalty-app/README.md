# Sofie's Loyalty + Beauty Profile (custom-coded)

A 100% in-house loyalty program for Sofie's Store (Shopify, Kalles theme, EGP).
No third-party loyalty apps. Source of truth is an **append-only points ledger**
in Supabase (Postgres); summary fields are mirrored into Shopify customer
metafields for the theme/Functions to read.

## Stack
- **App:** Remix (React Router) + Node, Shopify Admin GraphQL API, Shopify CLI.
- **DB:** Supabase (Postgres). Ledger is append-only; corrections are new rows.
- **Hosting:** Railway (web + cron).
- **Storefront ↔ backend:** Shopify App Proxy at `/apps/loyalty` (HMAC verified).
- **Customer UI:** theme app extension (app block) in the Kalles account area.

## Phase 1 (this session) — what's implemented
- Supabase schema for all tables (`supabase/migrations/0001_init.sql`), with an
  atomic `apply_ledger_entry()` Postgres function (locks the customer row,
  enforces idempotency, updates the cached balance in one transaction).
- Points math (`app/config/loyalty.js`, `app/lib/points.server.js`).
- Append-only ledger core with a swappable store
  (`app/lib/ledger.server.js`): in-memory for tests, Supabase for prod.
- Tier logic (`app/lib/tier.server.js`).
- Webhook HMAC + App Proxy HMAC utilities (`app/lib/hmac.server.js`).
- Webhooks: `orders/paid`, `refunds/create`, `orders/cancelled`
  (idempotent, COD-aware — award on paid, reverse on refund/cancel).
- Metafield mirroring (`app/lib/metafields.server.js`).
- Redemption → single-use EGP discount code (`app/lib/discounts.server.js`).
- App Proxy endpoints: `GET /apps/loyalty/me`, `POST /apps/loyalty/redeem`.
- Theme app-extension dashboard block (`extensions/loyalty-dashboard`).
- Tests for the ledger: earn, redeem, refund-reversal, idempotency
  (`test/`, run with `npm test` — pure Node, no DB needed).

## Phase 2 — beauty profile + non-purchase earning
- Quiz save + 250 pts (`POST /apps/loyalty/quiz`), manual "products I use" + 50 pts
  (`POST /apps/loyalty/profile`), profile schema + completion scoring
  (`app/lib/profile.server.js`).
- Order-history inference, hybrid metafields + title/variant parsing
  (`app/lib/inference.server.js`) — gap-fills the profile on every paid order.
- Profile/tips mirrored to customer metafields for the theme.
- Judge.me verified-buyer review webhook → 100 pts, capped 4/month
  (`app/routes/webhooks.judgeme.jsx`).
- Account-creation join bonus (100 pts) via `customers/create`.

## Phase 3 — tips, birthday, referrals, social, crons
- Rules-based tips engine + optional Claude enhancement
  (`app/lib/tips.server.js`, `app/lib/anthropic.server.js`).
- Birthday daily cron (`/jobs/birthday-daily`) → tier gift code + Klaviyo flow;
  tier recompute cron (`/jobs/tier-recompute`) over the rolling 12-month window.
- Referrals (`POST /apps/loyalty/referral`): friend welcome code now, 500 pts to
  the referrer when the friend's first order is paid.
- Social follow (`POST /apps/loyalty/social`): 50 pts once per platform.
- Theme: **Beauty Profile Quiz** app block + tips on the dashboard.
- Tests: profile completion, inference parsing, tips rules, review cap.

See `DEPLOY.md` for the full setup (Supabase migrations, Railway, crons,
Judge.me, Klaviyo flows).

## Run
```bash
cp .env.example .env      # fill in secrets
npm install
npm test                  # ledger + points + hmac unit tests (no network)
npm run dev               # shopify app dev (needs Shopify CLI + Partner app)
```

See `app/config/loyalty.js` for every tunable rule (earn divisor, tier
thresholds, multipliers, redemption tiers).
