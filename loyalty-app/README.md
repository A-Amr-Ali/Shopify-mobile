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

## Run
```bash
cp .env.example .env      # fill in secrets
npm install
npm test                  # ledger + points + hmac unit tests (no network)
npm run dev               # shopify app dev (needs Shopify CLI + Partner app)
```

See `app/config/loyalty.js` for every tunable rule (earn divisor, tier
thresholds, multipliers, redemption tiers).
