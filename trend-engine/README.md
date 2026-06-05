# Sofie Trend Engine

Auto-tags **trending** and **best-selling** products for Sofie's Makeup Store so
your homepage updates itself — no manual product picking.

It **blends three real signals**, matches them to *your* catalog, and writes
product tags via the Shopify Admin API. Your homepage points at automated
collections built on those tags, so everything stays in sync automatically.

## ⚠️ Read this first — what's actually possible
- **TikTok and Instagram do NOT offer a usable "trending products" API**, and scraping them breaks constantly and violates their ToS. So there is no magic "live from TikTok" switch. Instead we use the **legal, reliable** signals below.
- **You can only feature products you stock.** A global trend only matters if a matching, in-stock product exists in your store — the engine enforces that.

### The three signals it blends
1. **Google Trends (Egypt)** — real search interest for beauty brands/products, geo-targeted to Egypt. *(Unofficial endpoint; isolated so it can fail without breaking the run.)*
2. **Your live sales velocity** — what's actually selling in YOUR store over the last N days (the most accurate "trending with my customers" signal). Needs `read_orders`.
3. **Manual TikTok/IG feed** — a tiny CSV where you (or a VA) paste what you see going viral. 10 seconds, whenever you like. This is how real brands handle "TikTok viral."

Best sellers are ranked purely by **your real sales** (most honest). You can also just use Shopify's built-in **"Best selling"** collection sort and skip best-seller tagging entirely.

---

## Setup (one time, ~15 min)

### 1. Create a Shopify custom app (gets you an API token)
1. Shopify admin → **Settings → Apps and sales channels → Develop apps**
2. **Create an app** → name it "Trend Engine"
3. **Configure Admin API scopes** → enable:
   - `read_products`, `write_products` (required)
   - `read_orders` (optional — enables the sales-velocity signal)
4. **Install app** → reveal the **Admin API access token** (`shpat_…`). Copy it.

### 2. Create the automated collections (tag-driven)
1. **Products → Collections → Create collection**
2. Title: **Trending & Viral** · Collection type: **Smart (automated)**
3. Condition: **Product tag — is equal to — `trending`**
4. Sort: **Best selling** (or Newest) → Save
5. (Optional) Repeat for **Best Sellers** with tag `bestseller`.

Then in your theme: **Customize → homepage → "Trending & Viral" section → Collection → choose the new `trending` collection.** (Best Sellers section → the `bestseller` collection, or keep it on a collection sorted by "Best selling".)

### 3. Run it
**Option A — GitHub Actions (recommended, free, hands-off):**
1. In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SHOPIFY_STORE` = `a45545-2.myshopify.com`
   - `SHOPIFY_ADMIN_TOKEN` = your `shpat_…` token
2. The workflow `.github/workflows/trend-engine.yml` runs **daily at 06:00 UTC**.
3. Test it now: repo **Actions → Sofie Trend Engine → Run workflow** (tick *Preview only* for a dry run first).

**Option B — run locally / your own server:**
```bash
cd trend-engine
cp .env.example .env          # fill in store + token
cp data/manual-trends.example.csv data/manual-trends.csv   # optional
npm install
npm run dry-run               # preview, writes nothing
npm start                     # writes tags
```

---

## How it decides (and how to tune it)
Final score per product =
`WEIGHT_GOOGLE·googleMatch + WEIGHT_SALES·salesVelocity + WEIGHT_MANUAL·manualMatch (+ daily-trend bonus)`

Tune in `.env` (or the workflow env):
- `MAX_TRENDING` / `MAX_BESTSELLERS` — how many products to keep tagged.
- `WEIGHT_GOOGLE` / `WEIGHT_SALES` / `WEIGHT_MANUAL` — relative influence.
- `TREND_GEO` — `EG` for Egypt, `""` for worldwide.
- `SALES_LOOKBACK_DAYS` — velocity window.
- `DRY_RUN=true` — compute & print, write nothing.

Each run **reconciles** tags: it **adds** the tag to new winners and **removes** it from products that no longer qualify — so the collections never go stale.

## Updating the manual TikTok/IG feed
Edit `data/manual-trends.csv` (format `keyword,weight`). Example:
```
rare beauty soft pinch,1.0
lip oil,0.8
charlotte tilbury,0.6
```
The engine matches each keyword to your product titles/brands/types/tags. If you run via GitHub Actions, commit the CSV so the workflow sees it.

## Honest limitations
- Google Trends is an **unofficial** source; if Google changes it, that signal may pause until the dependency updates. The engine keeps running on the other signals.
- Trend→product matching is keyword-based, so review the dry-run output and adjust keywords/weights for best results.
- "Best sellers around the world" isn't available as a free, legal data feed; this uses **your** real sales, which is what you can actually fulfill.

## Files
```
trend-engine/
  src/index.js              orchestrator (run this)
  src/config.js             env config
  src/shopify.js            Admin GraphQL client (products, tags, orders)
  src/keywords.js           beauty keyword universe (+ your vendors)
  src/match.js              match signals → catalog, rank
  src/signals/googleTrends.js   Google Trends (Egypt)
  src/signals/salesVelocity.js  your live sales
  src/signals/manual.js         manual TikTok/IG CSV
  data/manual-trends.example.csv
.github/workflows/trend-engine.yml   daily schedule
```
