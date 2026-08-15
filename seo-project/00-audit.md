# Phase 0 — Audit

**Date:** 2026-08-15
**Status:** PARTIAL — the live-data half of this phase is blocked. See §0.

---

## 0. Blocking issue: no Shopify Admin API access

This environment has **no Shopify credentials and no outbound network access**, so
nothing that reads or writes the live store could run. Verified:

| Check | Result |
|---|---|
| `SHOPIFY_ADMIN_TOKEN` | missing |
| `SHOPIFY_ADMIN_CLIENT_ID` / `_SECRET` | missing |
| `SHOPIFY_API_KEY` / `_SECRET` | missing |
| `SHOP_DOMAIN` | missing |
| `JUDGEME_API_TOKEN` | missing |
| Egress to `sofiestore.net` | blocked by network proxy |
| Egress to `shopify.com` | blocked (HTTP 000) |

`loyalty-app/app/lib/admin.server.js` mints its Admin token from
`SHOPIFY_ADMIN_CLIENT_ID` + `SHOPIFY_ADMIN_CLIENT_SECRET` (or a static
`SHOPIFY_ADMIN_TOKEN`). With none of those set, `getAdmin()` throws immediately.

**Consequently these are NOT done and cannot be done from here:**

| Phase | Item | Why blocked |
|---|---|---|
| 0.1 | Product list + vendor values + counts | needs Admin API |
| 0.2 | Vendor inconsistency flags | needs the real vendor strings |
| 0.3 | Collection list w/ SEO fields, counts, body_html | needs Admin API |
| 1 | Vendor normalisation mapping | can't map values I can't read |
| 2 | Create smart collections | write access |
| 4.1 | "Shop by Brand" nav menu | Shopify navigation is Admin-managed, not a theme file |
| 5.1 | Top 20 products by 90-day revenue | needs Orders API |
| 5.2–5.3 | Product description rewrites | needs the current descriptions to rewrite faithfully |
| 6 (validation) | Rich Results Test | needs network |
| 6 (preview) | Theme preview link | needs Shopify theme access |
| Guardrail | CSV backups before Phase 1 / 5 | can't export what I can't read |

**To unblock:** either set `SHOP_DOMAIN` + `SHOPIFY_ADMIN_TOKEN` (a `shpat_…`
token from a custom app with `read_products, write_products, read_orders,
write_publications`) in this environment with egress allowed, or run the audit
locally against your store and hand me the export.

I did **not** guess at any of the above. No fabricated vendor lists, no invented
revenue rankings.

---

## 0.4 Indexation check for brand terms — DONE (with caveats)

Checked via web search (not Google Search Console, and the search index used is
US-based, so treat this as directional, not a substitute for GSC).

**Indexed and confirmed live:**

- `sofiestore.net/` (homepage)
- `/collections/makeup`, `/collections/mascara`, `/collections/lip`,
  `/collections/fragrance`, `/collections/tinted-moisturizer`,
  `/collections/smooth-sleek`, `/collections/new-in-makeup`,
  `/collections/sofies-makeup`, `/collections/saie`, `/collections/emsan`
- `/pages/sofies-makeup`, `/pages/contact`, `/search`
- Product URLs, e.g. `/products/floral-peony-blossom-fragrance-layering-balm`

**NOT found in the index:**

- **No `/collections/rhode`.** Rhode stock appears only inside generic
  collections (`/collections/lip`, `/collections/makeup`, `/new-in-makeup`).
- **None of the 8 brand/category SEO landing pages.** No `/pages/rare-beauty-egypt`,
  `-huda-beauty-`, `-charlotte-tilbury-`, `-nars-`, `-makeup-by-mario-`,
  `-luxury-makeup-`, `-original-makeup-`, `-authentic-makeup-egypt`.
  The only `/pages/` URLs indexed are `sofies-makeup` and `contact`.

**Read:** the site is crawled and indexed normally — no penalty, no robots block.
The brand landing pages simply do not exist as live URLs. Their templates were
added to the theme on **2026-06-05** (~2 months ago, matching the "we changed all
SEO 2 months ago" timeline) but `docs/03-SEO-STRATEGY.md` §2 requires a manual
Admin step — *Online Store → Pages → Add page → set handle → assign template* —
that appears never to have been completed. A theme template is only a layout; it
is inert until a Page with the matching handle is created and assigned.

Also confirm the theme carrying these templates
(`claude/sofie-store-luxury-redesign-payd6`) is actually **published** as the live
theme rather than sitting unpublished.

---

## Brand list used for Phase 3 (repo-derived, not live vendor data)

Since the `vendor` field was unreadable, brand copy was drafted against the brands
this codebase says you carry — `trend-engine/src/brandSources.js`, corroborated by
`loyalty-app/app/lib/advisor.server.js` and `anthropic.server.js`:

Rhode · One/Size · Rare Beauty · Makeup by Mario · Patrick Ta · Summer Fridays ·
Saie · Glossier · Kosas · Charlotte Tilbury · NARS · Laura Mercier · Hourglass ·
Huda Beauty

**This is not a substitute for the real vendor audit.** Re-run Phase 0.1 once the
Admin API is reachable and reconcile — brands here you no longer stock, and brands
you stock that aren't listed here, will both need handling.

---

## ⚠️ FINDING 1 — "authorized distributor" overclaim (29 instances)

You asked me to flag copy claiming official/authorised distributor status. It is
**pervasive across the live theme**, not occasional. Representative sample:

| File | Claim |
|---|---|
| `sections/lux-trust-bar.liquid:53,61` | "Sourced from official brands & authorized distributors." |
| `sections/lux-why-sofie.liquid:76` | "Sourced only from official brands and authorized distributors." |
| `sections/lux-faq.liquid:63,70` | "sourced directly from official brands and authorized distributors" |
| `templates/index.json:33,396` | same, on the **homepage** (trust bar + FAQ) |
| `templates/page.original-makeup-egypt.json:10,17,47,64,71` | "We buy only through official brands and authorized distributors." (×5) |
| `templates/page.authentic-makeup-egypt.json:10,64` | "sourced from official brands and authorized distributors" |
| `page.rare-beauty-` / `huda-beauty-` / `charlotte-tilbury-` / `nars-` / `makeup-by-mario-` / `luxury-makeup-` / `seo-landing` | "sourced through authorized channels" |
| `sections/lux-seo-landing.liquid:130` | default copy, same claim |

Full list: `git grep -nIi "authorized distributor\|official brands\|authorized channel"`.

Two tiers of risk, worth separating:

1. **"official brands and authorized distributors"** — the stronger claim. Asserts
   a direct/authorised supply relationship. This is the one to remove first, and
   it is on your **homepage**.
2. **"sourced through authorized channels"** — vaguer but still reads as an
   authorisation claim to a regulator or a brand's legal team.

Suggested replacement wording, consistent with what you told me is true:
> "Every product is genuine. We source authentic stock and stand behind it — if
> anything you receive isn't authentic, we'll make it right."

**I did not bulk-edit these** — you asked for a flag, and a 29-instance sweep
across the homepage is a change you should read first. Say the word and I'll do it
as a reviewable diff.

**One I did fix:** `templates/page.rhode-egypt.json`, which I authored last turn,
carried the same claim because I copied the house pattern. Corrected in this
commit — it now says we source authentic product, nothing stronger.

---

## ⚠️ FINDING 2 — the second boutique's name conflicts

Your brief names the boutiques **"Marassi M-Porium"** and **"New Cairo Mivida"**.
The theme overwhelmingly says something else:

| Wording | Occurrences |
|---|---|
| "Marassi M-Porium & **Akti by Zahra**" | 12 |
| "Marassi and **Akti by Zahra** boutiques" | 3 |
| "Marassi & **Akti by Zahra**" (variants) | 4 |
| "Marassi M-Porium and **Mivida, New Cairo**" | 2 |

Meanwhile your live site's own text (per search snippet) says *"M-porium Mall,
Marassi And Mivida - New Cairo"*, and `loyalty-app` config defaults to
`"Marassi & Mivida, Egypt"`.

So the theme is largely **stale** — it still advertises "Akti by Zahra". If you've
moved or renamed, ~20 strings need updating, and this also affects the
`LocalBusiness` schema in Phase 6 (wrong address = wrong local SEO signal).

`[VERIFY]` — tell me the two current boutique names, full addresses and opening
hours, and I'll correct every instance and build the LocalBusiness JSON-LD from
real data rather than guesses.

---

## ⚠️ FINDING 3 — Phase 4.3 and Phase 6 have no template to edit here

This repo contains only custom `lux-*` sections/snippets and JSON page templates.
It has **no `product.liquid` / `collection.liquid`**, so:

- **4.3** (vendor name → brand collection link on the product page) can't be done —
  the product template lives in your full Kalles theme, which isn't in this repo.
- **6** — `snippets/lux-jsonld.liquid` already supports
  `organization`, `product`, `breadcrumb`, `collection`, `faq`. The snippet exists;
  what's missing is the *wiring* into product/collection templates, which again
  aren't here.

To proceed on these, either add the full theme to this repo or give me theme access.

---

## What was delivered despite the blockage

- `seo-project/03-brand-copy/*.md` — 14 original brand copy drafts (Phase 3),
  written without any distributor claim, with `[VERIFY]` markers on unconfirmed facts.
- `templates/page.brands.json` + `sections/lux-brand-index.liquid` — the A–Z brand
  index page (Phase 4.2).
- `templates/page.rhode-egypt.json` — the missing Rhode landing page (prior commit),
  overclaim now removed.
- `seo-project/07-next-steps.md` — handoff.
