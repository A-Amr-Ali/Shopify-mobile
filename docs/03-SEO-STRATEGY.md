# SEO Strategy — Dominate Luxury Makeup Search in Egypt (Phase 3)

Goal: own high-intent **"[brand] Egypt"**, **"luxury/original/authentic makeup
Egypt"**, and category queries. Strategy = intent-mapped landing pages +
optimized collections + complete structured data + tight internal linking.

## 1. Keyword → page map
| Target keyword (+ EG/Arabic intent) | Page (template) | Primary collection |
|---|---|---|
| rare beauty egypt / ريرر بيوتي مصر | `page.rare-beauty-egypt.json` | `rare-beauty` |
| huda beauty egypt / هدى بيوتي مصر | `page.huda-beauty-egypt.json` | `huda-beauty` |
| charlotte tilbury egypt | `page.charlotte-tilbury-egypt.json` | `charlotte-tilbury` |
| makeup by mario egypt | `page.makeup-by-mario-egypt.json` | `makeup-by-mario` |
| nars egypt | `page.nars-egypt.json` | `nars` |
| luxury makeup egypt / مكياج فخم مصر | `page.luxury-makeup-egypt.json` | `makeup` |
| original makeup egypt / مكياج اصلي | `page.original-makeup-egypt.json` | `makeup` |
| authentic makeup egypt | `page.authentic-makeup-egypt.json` | `makeup` |

Each page already includes: keyword H1, helpful intro, real product grid (internal
links + indexable), 2–3 long-form copy blocks, sibling internal-links row, and an
FAQ with **FAQPage** schema.

## 2. Create the pages (Admin)
For each template above:
1. Online Store → **Pages** → Add page.
2. **Title** = the SEO H1 (e.g. "Rare Beauty Egypt"). Shopify sets the handle; make
   it match the template name's handle (e.g. `rare-beauty-egypt`).
3. **Theme template** (right panel) → select the matching template
   (`rare-beauty-egypt`, etc.). Leave page body empty — the section renders content.
4. Fill **Search engine listing** (title tag + meta description) per §3.
5. Link them from the footer ("Shop by Brand") and the homepage brand wall.

> Tip: brand pages are even stronger as **optimized collections** (they list live
> inventory and update automatically). Use these page templates when you want
> editorial control / extra copy, or when a brand has no collection yet. You can
> also paste the `lux-seo-landing` rich copy into the corresponding **collection
> description** to get the same SEO benefit on the collection URL.

## 3. Title tags + meta descriptions (paste into "Search engine listing")
Keep titles ≤ ~60 chars, metas ≤ ~155. Front-load the keyword.

| Page | Title tag | Meta description |
|---|---|---|
| Rare Beauty Egypt | `Rare Beauty Egypt — 100% Authentic \| Sofie's` | `Shop authentic Rare Beauty in Egypt at Sofie's Makeup Store. Soft Pinch Blush, Positive Light & more. Fast delivery nationwide. 100% original.` |
| Huda Beauty Egypt | `Huda Beauty Egypt — 100% Authentic \| Sofie's` | `Authentic Huda Beauty in Egypt: Faux Filter, palettes, lips & more. Curated by experts, delivered across Egypt. 100% original, guaranteed.` |
| Charlotte Tilbury Egypt | `Charlotte Tilbury Egypt — Authentic \| Sofie's` | `Shop authentic Charlotte Tilbury in Egypt — Pillow Talk, Magic Cream, Flawless Filter. 100% original. Fast delivery nationwide.` |
| Makeup by Mario Egypt | `Makeup by Mario Egypt — Authentic \| Sofie's` | `Authentic Makeup by Mario in Egypt: Master Mattes, SurrealSkin & more. 100% original, expert-curated, delivered nationwide.` |
| NARS Egypt | `NARS Egypt — 100% Authentic \| Sofie's Makeup` | `Shop authentic NARS in Egypt — Radiant Creamy Concealer, Orgasm blush & more. 100% original. Fast delivery across Egypt.` |
| Luxury Makeup Egypt | `Luxury Makeup Egypt — 100% Authentic \| Sofie's` | `Egypt's home for luxury makeup. Rare Beauty, Charlotte Tilbury, NARS, Huda & more — 100% authentic, expert-curated, delivered nationwide.` |
| Original Makeup Egypt | `Original Makeup Egypt — Guaranteed \| Sofie's` | `Buy original, 100% authentic makeup in Egypt. Sourced from official brands & authorized distributors. 10+ years trusted. Fast delivery.` |
| Authentic Makeup Egypt | `Authentic Makeup Egypt \| Sofie's Makeup Store` | `100% authentic makeup in Egypt from the brands you love. Expert-curated, original guaranteed, delivered to every governorate.` |

**Homepage** title/meta:
- Title: `Sofie's Makeup Store — Authentic Luxury Beauty in Egypt`
- Meta: `Egypt's trusted luxury beauty destination. 100% authentic makeup & home from Rare Beauty, Charlotte Tilbury, NARS, Huda & more. 10+ years. Fast delivery.`

## 4. Collection SEO (template you can reuse)
For each top collection, set a unique title/meta and write a 80–150 word description:
```
[Brand/Category] in Egypt — 100% authentic at Sofie's Makeup Store.
[2–3 sentences: what it is, hero products, who it's for.]
Every product is genuine, sourced from official brands & authorized distributors.
Curated by 10+ years of beauty expertise and delivered across Egypt.
Shop in person at Marassi M-Porium & Akti by Zahra.
```
Priorities: makeup, huda-beauty, rare-beauty, charlotte-tilbury, nars, fragrance,
makeup-palettes, makeup-accessories, home, sephora-favorites.

## 5. Structured data (already shipped — wire per Implementation Guide §3)
- **Organization + 2× Store (LocalBusiness)** → brand entity, both EG boutiques, sameAs to IG/FB, WebSite SearchAction (sitelinks search box). `lux-jsonld type:'organization'` in `<head>`.
- **BreadcrumbList** on collection/product/page → breadcrumb rich results.
- **Product + Offer + AggregateRating** on PDP → price + stars in SERP. (`type:'product'`).
- **CollectionPage + ItemList** on collections.
- **FAQPage** on homepage + each SEO page (the `lux-faq` section emits it; keep one per page).

Validate everything with **Google Rich Results Test** and **Schema.org validator**
before/after publishing. Re-submit `sitemap.xml` in Search Console.

## 6. Internal linking (PageRank flow)
- Homepage **Brand Discovery** wall → brand collections/pages (already wired).
- Each SEO page → sibling SEO pages (auto "Explore More" row) + its collection.
- Footer: add **"Shop by Brand"** and **"Beauty Guides"** columns linking all brand pages.
- From collection descriptions, link to the matching `[brand] Egypt` page and back.

## 7. Image SEO
- Descriptive alt text pattern: `"[Product/Brand] — [type] at Sofie's Makeup Store Egypt"`. Section fields support custom alt; cards default to product title.
- Compress hero/banner art to WebP; keep file names descriptive (`rare-beauty-soft-pinch-blush.webp`).

## 8. Technical SEO checklist
- [ ] One H1 per page (sections enforce this — hero uses `<h1>`, others `<h2>`).
- [ ] Canonical tags correct (Shopify default; avoid duplicate via `?` params).
- [ ] `robots.txt`/`sitemap.xml` healthy; submit in Search Console.
- [ ] No duplicate FAQ schema (one emitting FAQ per page).
- [ ] Fast Core Web Vitals (see Implementation Guide §8) — speed is a ranking + CRO factor.
- [ ] hreflang only if you run Arabic + English locales (recommended for EG).
- [ ] Descriptive, keyword-aware URL handles for new pages/collections.

## 9. Content moat (ongoing, optional but powerful)
Blog/guides that capture top-of-funnel EG beauty search and link down to brand pages:
"Best Rare Beauty blush shades for Egyptian skin tones", "Charlotte Tilbury Pillow
Talk dupes vs. the real thing", "How to spot fake makeup in Egypt" (ties directly to
your authenticity moat). Each links to the relevant `[brand] Egypt` page.
