# SOFIE free Sephora-source monitoring
No paid scraper subscriptions are required by this software. This is an **authorized feed adapter**, not a website scraper or a live Sephora integration.

- US source formula: USD × 112 + verified shipping kg × 2,500 + EGP 500 per item.
- UAE source formula: AED × 27 + verified shipping kg × 900 + EGP 500 per item.
- Only CSV/JSON HTTPS URLs allowlisted by you with confirmed reuse rights can be read.
- US and UAE are separate sources. Supabase authorization_status=verified AND ingestion_enabled=true required for writes **to the private source tables**.
- Shopify Admin API is never used. Neither SOFIE NOW nor other Shopify products can be modified from this code.
- Reports contain suggestions only. Product weights must be verified.
- Required GitHub Actions secrets: FEED_US_URL, FEED_UAE_URL, SUPABASE_DB_URL (private Postgres connection string).
- Required GitHub Actions variables: AUTHORIZED_FEED_HOSTS (comma-separated), SOURCE_RIGHTS_CONFIRMED=true **only after licensing approval**.
- Configured GitHub Actions schedule: daily 05:17 UTC (not fixed Cairo local time). GitHub schedules may be delayed or disabled due to inactivity.
- This workflow must be placed on the repository's default branch to run automatically; a feature branch or draft PR alone does not schedule it.
- Free Github Actions compute for public repositories is subject to GitHub's limits and terms. Existing Supabase plan quotas apply.
- Source without a valid URL is reported as not_configured rather than silently pretending Sephora was checked.
- DO NOT publish source-feed credentials or database passwords in this public repository.
