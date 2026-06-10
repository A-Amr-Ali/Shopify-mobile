# Deploying the loyalty app (Phase 1)

A one-time checklist to get Phase 1 live against Sofie's Store.

## 1. Create the custom app (Shopify Partners)
- Partners → Apps → Create app → **build manually** (we use Shopify CLI).
- Note the **Client ID** (`SHOPIFY_API_KEY`) and **Client secret** (`SHOPIFY_API_SECRET`).
- App URL: `https://loyalty.sofiestore.net` (your Railway domain).
- The same secret verifies App Proxy **and** webhook HMAC.

## 2. Supabase
1. Create a project; copy `SUPABASE_URL` and the **service-role** key.
2. Apply migrations (Supabase SQL editor or CLI), in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_sessions.sql`
   With the CLI: `supabase db push` (after `supabase link`).

## 3. Railway
1. New project from this repo, **root directory = `loyalty-app`**.
2. Add env vars (see `.env.example`):
   `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KLAVIYO_API_KEY`.
3. Railway builds via `railway.json` (`npm run build` → `npm run start`).
4. Point DNS `loyalty.sofiestore.net` → the Railway domain.

## 4. Link + deploy the Shopify app
```bash
cd loyalty-app
npm install
shopify app config link      # writes client_id into shopify.app.toml
shopify app deploy           # pushes app config, webhooks, app proxy, extension
```
- App Proxy is declared in `shopify.app.toml` (`/apps/loyalty` → app `/apps/loyalty`).
- On install, the `afterAuth` hook registers the 3 webhooks and creates the
  customer metafield definitions (`custom.loyalty_points`, `custom.loyalty_tier`,
  `custom.lifetime_spend_egp`) automatically — no manual admin clicks.

## 5. Theme
- In the theme editor, add the **Loyalty Dashboard** app block to the customer
  account area (or any section that accepts app blocks). It reads everything
  client-side from `/apps/loyalty/me`.

## 6. Verify
- Place a test order, mark it **paid** → check `points_ledger` has a `purchase`
  row and the customer metafields updated.
- Refund part of it → a `refund_reversal` row appears (prorated).
- Redeem from the dashboard → a single-use `SOFIE-PTS-…` code is minted and the
  balance drops.

## Cron (Phase 3)
Birthday + tier-recompute jobs will be added as a separate Railway **cron
service** (e.g. `0 5 * * *`) running `node jobs/<name>.js`. Not needed for
Phase 1 — tier is recomputed inline on every paid order.
