# Phase 7 — Handoff

**Date:** 2026-08-15
**Overall status:** ~40% delivered. Everything requiring the Shopify Admin API is
blocked — see `00-audit.md` §0 for the verified evidence.

---

## 1. URLs to submit in Google Search Console

⚠️ **None of these are live yet.** Each needs a Page or Collection created in
Shopify Admin first (see §3). Submit them only after they return HTTP 200.

**Existing templates, pages never created (the two-month gap):**

```
https://sofiestore.net/pages/rare-beauty-egypt
https://sofiestore.net/pages/huda-beauty-egypt
https://sofiestore.net/pages/charlotte-tilbury-egypt
https://sofiestore.net/pages/makeup-by-mario-egypt
https://sofiestore.net/pages/nars-egypt
https://sofiestore.net/pages/luxury-makeup-egypt
https://sofiestore.net/pages/original-makeup-egypt
https://sofiestore.net/pages/authentic-makeup-egypt
```

**Added this session:**

```
https://sofiestore.net/pages/rhode-egypt      ← the "rhode egypt" target page
https://sofiestore.net/pages/brands           ← A–Z brand index
```

**Brand collections to create (Phase 2 — not created, no API access):**

```
/collections/rhode              /collections/patrick-ta
/collections/one-size           /collections/summer-fridays
/collections/rare-beauty        /collections/saie
/collections/makeup-by-mario    /collections/glossier
/collections/kosas              /collections/charlotte-tilbury
/collections/nars               /collections/laura-mercier
/collections/hourglass          /collections/huda-beauty
```

`/collections/saie` already exists and is indexed. **Check each handle before
creating** — Shopify will silently mint `rhode-1` if `rhode` is taken.

---

## 2. Found but could not fix

| Item | Reason |
|---|---|
| Vendor audit, normalisation, collection creation, top-20 revenue, product rewrites | No Shopify Admin credentials; no network egress. Verified in `00-audit.md` §0. |
| CSV backups before Phase 1/5 | Cannot export data I cannot read. **Do not run Phase 1 or 5 until backups exist.** |
| "Shop by Brand" main-nav menu (4.1) | Shopify navigation lives in Admin (Online Store → Navigation), not in theme code. Must be done by hand — link it to `/pages/brands`. |
| Vendor → brand-collection link on product page (4.3) | No `product.liquid` in this repo; it lives in your full Kalles theme. |
| JSON-LD wiring for Product / BreadcrumbList (6) | `snippets/lux-jsonld.liquid` already supports `organization`, `product`, `breadcrumb`, `collection`, `faq` — but the product/collection templates that would call it are not in this repo. |
| `LocalBusiness` for both boutiques (6) | Blocked on a factual conflict — see below. Building it now would encode a wrong address. |
| Rich Results Test validation (6) | Network egress blocked. |
| Theme preview link (6) | Requires Shopify theme access. Nothing was published — guardrail respected. |

---

## 3. Needs a human

**Do these first — they unblock everything else:**

1. **Create the Pages in Shopify Admin.** Online Store → Pages → Add page. Title =
   the H1, handle must match the template exactly (`rhode-egypt`, `brands`, …),
   then assign the matching template in the right-hand panel. Leave the body empty;
   the section renders the content. *This is the step that was missed two months
   ago — without it the templates are inert.*
2. **Confirm the theme is published.** These templates sit on
   `claude/sofie-store-luxury-redesign-payd6`. If that theme isn't the live one,
   none of this is on the internet.
3. **Create the brand collections** (smart, rule `vendor equals <Brand>`), publish
   each to the Online Store channel, then paste the approved copy from
   `03-brand-copy/` into each collection description.
4. **Set up / verify Google Search Console.** You have been flying blind for two
   months. GSC is the only tool that answers "has Google seen this URL" definitively.
   Submit `sitemap.xml`, then URL-Inspect one brand page.

**Decisions only you can make:**

5. **The "authorized distributor" claim — 29 instances, including your homepage.**
   Flagged in `00-audit.md` §Finding 1, not edited. Tell me to proceed and I'll
   deliver it as one reviewable diff.
6. **Which two boutiques are current?** The theme says "Akti by Zahra" 20 times;
   your brief says "New Cairo Mivida". I need both names, full street addresses and
   opening hours before I can build `LocalBusiness` schema that helps rather than
   misleads.
7. **Google Business Profile** for both boutiques — the single highest-value local
   SEO action available to you, and it cannot be done in code. A verified GBP with
   correct address, hours and photos is what wins "makeup store near me" and feeds
   the map pack.
8. **Backlinks.** Nothing in this repo moves this. Egyptian beauty press, blogger
   seeding, and brand-adjacent directories are what will make "rhode egypt"
   winnable against rhodeskin.com.
9. **Review the 14 copy drafts** in `03-brand-copy/` and resolve every `[VERIFY]`
   marker (delivery window, boutique names) before anything is published.

---

## 4. Honest expectation

Even executed perfectly, `rhode egypt` is a hard query — you are competing with the
brand's own domain and large international retailers. Realistic horizon is 2–6
months *after* the pages are genuinely live and indexed. The queries worth winning
first are the buyer-intent long tails — **"rhode egypt where to buy"**, **"buy
rhode in egypt"**, **"rhode price egypt"** — which is what the FAQ blocks and the
brand copy are written to target.
