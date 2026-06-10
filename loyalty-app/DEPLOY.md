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

  Migrations to apply: `0001_init.sql`, `0002_sessions.sql`, `0003_profile_referral.sql`.

## 5. Theme
- In the theme editor, add the **Loyalty Dashboard** app block to the customer
  account area (balance, tier, progress, redeem, **personalized tips**).
- Add the **Beauty Profile Quiz** app block (earns 250 pts, builds the profile).
  Both read/write client-side via `/apps/loyalty/*` (HMAC-verified).

## 6. Judge.me reviews (Phase 2)
- In Judge.me → Settings → Webhooks, add a webhook for "review created" pointing at
  `https://loyalty.sofiestore.net/webhooks/judgeme?token=YOUR_SECRET`.
- Set the same value as `JUDGEME_WEBHOOK_SECRET` in Railway. Verified-buyer
  reviews award 100 pts (capped 4/month, idempotent per review).

## 7. Crons (Phase 3) — Railway scheduled jobs
Add two Railway **cron services** (or any scheduler) that POST to the app with the
`x-cron-key: $CRON_KEY` header:
- Daily `0 5 * * *`  → `POST /jobs/tier-recompute` (rolling-12-month tier refresh)
- Daily `0 6 * * *`  → `POST /jobs/birthday-daily`  (birthday gifts → Klaviyo flow)
Set `CRON_KEY` and `SHOP_DOMAIN` in Railway. Example:
`curl -X POST -H "x-cron-key: $CRON_KEY" https://loyalty.sofiestore.net/jobs/birthday-daily`

## 8. Klaviyo flows
Create flows triggered by these events the app pushes: `Loyalty Points Earned`,
`Loyalty Tier Upgraded`, `Loyalty Reward Redeemed`, `Loyalty Referral Rewarded`,
`Loyalty Birthday Gift` (date-property birthday flow emails the unique code).

## 9. Verify
**Automated smoke test** — walks the whole lifecycle (signup → quiz → tips →
products → social → order paid → review → referral → redeem → refund) against your
real Supabase and asserts the ledger math at every step:
```bash
# needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and migrations 0001–0003 applied
npm run verify
# also ping the deployed App Proxy (HMAC + routing) — needs SHOPIFY_API_SECRET:
node scripts/verify-lifecycle.js --proxy https://loyalty.sofiestore.net/apps/loyalty
```
It writes clearly-labelled `TEST-*` rows; remove them afterwards by running
`scripts/cleanup-test-data.sql` in the Supabase SQL editor.

**Manual checks**
- Place a test order, mark it **paid** → `points_ledger` gets a `purchase` row,
  metafields update, and the profile is gap-filled from order history.
- Refund part of it → a prorated `refund_reversal` row appears.
- Redeem from the dashboard → a single-use `SOFIE-PTS-…` code is minted.
- Submit the quiz → 250 pts once, tips appear on the dashboard.
- Create a customer → 100-pt join bonus.
