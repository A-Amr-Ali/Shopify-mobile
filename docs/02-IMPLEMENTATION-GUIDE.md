# Implementation Guide (Phases 2, 4 & 5)

This package is **drop-in** and **theme-agnostic** (built and tested against Dawn
conventions, works on any Online Store 2.0 theme). Everything is namespaced
`sofie-` / `lux-` so it will **not collide with or break your current theme**.

## 0. What's in the box
```
assets/   sofie-luxury.css     ← design system (tokens, type, spacing, components)
          sofie-luxury.js      ← scroll-reveal + AJAX quick-add (progressive enhancement)
snippets/ lux-icon.liquid      ← inline SVG icon set (currentColor)
          lux-product-card.liquid ← luxury PDP card (quick-add, badges, rating)
          lux-jsonld.liquid    ← Organization/Store/Product/Breadcrumb/FAQ/Collection schema
sections/ lux-hero-split       ← split hero + above-the-fold trust strip
          lux-trust-bar        ← 5 premium trust pillars
          lux-featured-collection ← Best Sellers / Trending / New Arrivals (reusable)
          lux-shop-by-category ← editorial category tiles
          lux-brand-discovery  ← prestige brand wall (also internal-linking for SEO)
          lux-why-sofie        ← brand storytelling
          lux-instagram        ← elegant manual IG gallery (no app bloat)
          lux-seo-landing      ← H1 + products + long-form SEO copy + internal links
          lux-faq              ← accordion + FAQPage rich snippets
templates/ index.json          ← the full luxury homepage flow
          page.seo-landing.json + page.<brand>-egypt.json ×8 ← SEO pages
docs/     this guide + audit + SEO strategy + roadmap
```

## 1. Install (Shopify admin — safe, reversible)
> **Always duplicate your live theme first** (Online Store → Themes → ⋯ → Duplicate). Install into the copy, preview, then publish.

**Option A — Theme code editor (no CLI):**
1. Online Store → Themes → ⋯ → **Edit code** on the duplicated theme.
2. For each file in this repo, create the matching file in the theme and paste contents:
   - `assets/sofie-luxury.css`, `assets/sofie-luxury.js`
   - `snippets/lux-*.liquid`
   - `sections/lux-*.liquid`
   - Then `templates/index.json` (this **replaces** the homepage — your old one is saved in your un-duplicated theme).
   - Add the `page.*.json` templates.
3. Preview → publish when happy.

**Option B — Shopify CLI (recommended for devs):**
```bash
shopify theme pull --store sofiestore.net          # into a local copy of your live theme
cp -r sections snippets assets templates <your-theme>/   # merge this package in
shopify theme dev                                   # preview locally
shopify theme push --unpublished                    # push as a new unpublished theme
```

## 2. Wire the homepage (Theme Customizer)
Open the customizer on the homepage. Sections are pre-ordered. For each, set:
- **Lux Hero (Split):** pick Makeup image + Home image (use high-res, ~1600px wide, WebP). Confirm CTA links (`Shop Makeup` → your makeup collection, etc.).
- **Lux Featured Collection ×4:** point each at the right collection:
  - *Makeup Best Sellers* → your makeup collection (sort by **Best selling**).
  - *Trending & Viral* → a curated "viral/tiktok" collection (create one if needed).
  - *Home Best Sellers* → home collection.
  - *New Arrivals* → a "new" collection or all (sort by **Newest**).
- **Lux Shop by Category / Brand Discovery:** verify each tile/brand links to a real collection handle. Defaults use `shopify://collections/<handle>` — Shopify will warn on any handle that doesn't exist; fix those.
- **Lux Why Sofie:** add a boutique/lifestyle image. Point CTA to your story page.
- **Lux Instagram:** add 6–12 on-brand square images + your IG URL.
- **Lux FAQ:** keep **one** FAQ with *Emit schema* ON (avoids duplicate FAQ schema).

> Defaults reference real handles found on your store (`makeup`, `home`, `huda-beauty`, `saie`, `fragrance`, `makeup-accessories`, `sephora-favorites-1`). Verify the brand handles (`rare-beauty`, `charlotte-tilbury`, `nars`, `makeup-by-mario`, `hourglass`, `laura-mercier`, `glossier`, `summer-fridays`, `patrick-ta`, `refy`) and correct any that differ.

## 3. Add global structured data (one-time)
In `layout/theme.liquid`, just before `</head>`:
```liquid
{% render 'lux-jsonld', type: 'organization' %}
{% render 'lux-jsonld', type: 'breadcrumb' %}
```
On the **product** template add:
```liquid
{% render 'lux-jsonld', type: 'product', product: product %}
```
On **collection** template add:
```liquid
{% render 'lux-jsonld', type: 'collection', collection: collection %}
```
(See `03-SEO-STRATEGY.md` for the FAQ/Product details.)

## 4. Review stars (social proof on cards)
The card auto-shows stars when products have the standard rating metafields
`reviews.rating` and `reviews.rating_count`. If you use **Judge.me / Loox / Shopify
Product Reviews**, enable their setting to write to those metafields (all support it),
or map your app's metafield namespace in `snippets/lux-product-card.liquid`
(`rating_value` / `rating_count` variables). No stars show if data is absent — never fake them.

## 5. Quick-add behaviour
`sofie-luxury.js` posts to `/cart/add.js` and dispatches `sofie:cart:added`.
- Single-variant products → "Add to Bag" adds instantly.
- Multi-variant → "Choose Options" routes to PDP (correct UX — don't guess variant).
- It tries to open common cart drawers; if your theme's drawer differs, listen for
  the `sofie:cart:added` event and open your drawer, or remove the drawer-open block.
- Updates any `[data-cart-count]` element. Add `data-cart-count` to your header bubble.

## 6. Recommended navigation (do in Admin → Navigation)
Main menu (mega-menu if your theme supports it):
- **Makeup** → Face, Eyes, Lips, Complexion, Palettes, Accessories
- **Skincare**
- **Fragrance**
- **Home & Body**
- **Brands** → Rare Beauty, Huda Beauty, Charlotte Tilbury, NARS, Makeup by Mario, Hourglass, Laura Mercier, Glossier, Saie, Summer Fridays, Patrick Ta, REFY
- **Best Sellers** · **New In** · **Sale**
- Keep **search prominent** (beauty = high search intent).

## 7. Polishing checklist (Phase 4)
- [ ] **One** FAQ section sitewide emits schema (we guard this with `emit_schema`).
- [ ] Remove any duplicate FAQ/legacy homepage sections from the old theme.
- [ ] Consistent type: headings = serif display, body = sans (set in tokens).
- [ ] Spelling/grammar pass on all collection + page copy (EG English; "Marassi", "M-Porium").
- [ ] CTA hierarchy: one primary (solid) + one secondary (ghost) per section — already enforced.
- [ ] Alt text on every hero/category/brand/IG image (see fields in each section).
- [ ] Consistent EGP money format (Settings → Store currency display).

## 8. Speed optimization (Phase 5)
**Already built-in by this package:**
- No slider/carousel JS — **CSS scroll-snap rails** instead.
- Responsive `srcset` + explicit `width`/`height` on every image → **no CLS**.
- `loading="lazy"` + `decoding="async"` everywhere except the hero LCP image, which uses `fetchpriority="high"`.
- Single small **deferred** JS file; no jQuery; no render-blocking.
- Native IG gallery → removes a typical heavy third-party IG embed.

**Do in admin (high impact):**
1. **App audit:** Apps → review every installed app. For each, ask: does it inject JS/CSS on every page? Remove duplicates and anything unused (common offenders: multiple review apps, popup apps, IG feed apps, upsell apps). Use Shopify's **Web Performance** dashboard + [PageSpeed Insights](https://pagespeed.web.dev/) before/after.
2. **Images:** re-export hero/banner art as WebP ~1600px max; Shopify serves WebP automatically via `image_url`, but start from optimized sources.
3. **Fonts:** limit to 2 families, `font-display: swap` (Shopify font picker does this). The design system falls back gracefully to your theme fonts.
4. **Third-party scripts:** defer/async non-critical tags (chat, analytics extras). Load marketing pixels via Customer Events when possible.
5. **Targets (Core Web Vitals, mobile):** LCP < 2.5s, CLS < 0.1, INP < 200ms.

## 9. Rollback
Everything lives in new `lux-*` / `sofie-*` files + a new `index.json`. To revert,
publish your original (un-duplicated) theme. No core theme files are modified by
this package except the two `theme.liquid` schema renders you add in step 3.
