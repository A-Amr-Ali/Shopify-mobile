# Sofie's Makeup Store — Luxury Redesign Package

A production-ready, **drop-in Shopify Online Store 2.0** package that redesigns
the homepage for conversion, strengthens luxury positioning & trust, and lays
down a full SEO foundation for **https://www.sofiestore.net** — without breaking
your current branding or premium feel.

> **Why a package and not edits to your live theme?** This repository was an empty
> clone and the live theme is bot-protected (can't be pulled here). So everything
> is delivered as **new, namespaced files** (`lux-*`, `sofie-*`) you install into
> a *duplicated* theme — zero risk to your live store, fully reversible. See
> [`docs/02-IMPLEMENTATION-GUIDE.md`](docs/02-IMPLEMENTATION-GUIDE.md).

## Start here
1. **Read the audit** → [`docs/01-AUDIT.md`](docs/01-AUDIT.md) — every problem, prioritized, with impact/effort/CR estimates.
2. **Install** → [`docs/02-IMPLEMENTATION-GUIDE.md`](docs/02-IMPLEMENTATION-GUIDE.md) — exact steps (admin or CLI), customizer setup, speed.
3. **SEO** → [`docs/03-SEO-STRATEGY.md`](docs/03-SEO-STRATEGY.md) — keyword map, title/meta copy, schema, internal linking.
4. **Roadmap** → [`docs/04-ROADMAP.md`](docs/04-ROADMAP.md) — sprint-by-sprint plan + how to measure lift.

## What's included
- **Homepage flow** (`templates/index.json`): Split Hero + above-the-fold trust → Trust bar → Makeup Best Sellers → Trending/Viral → Home Best Sellers → New Arrivals → Shop by Category → Brand Discovery → Why Sofie → Instagram → FAQ.
- **9 reusable luxury sections** (`sections/lux-*.liquid`) — all editable in the Theme Customizer with sensible presets.
- **Self-contained snippets** — luxury product card (hover quick-add via AJAX, badges, review stars), an inline SVG icon set, and a full **JSON-LD engine** (Organization, LocalBusiness ×2, Product, Breadcrumb, FAQ, Collection).
- **Design system** (`assets/sofie-luxury.css`) — luxury type scale (serif display + refined sans), champagne-gold restraint, editorial spacing, mobile-first swipe rails, reduced-motion support.
- **Lightweight JS** (`assets/sofie-luxury.js`) — scroll reveal + AJAX add-to-bag, progressive enhancement (works with JS off), no jQuery, deferred.
- **8 SEO landing templates** (`templates/page.*-egypt.json`) for Rare Beauty, Huda, Charlotte Tilbury, Makeup by Mario, NARS + Luxury/Original/Authentic Makeup Egypt — each with H1, real product grid, long-form copy, internal links, and FAQ rich snippets.

## Design principles honored
- **Luxury preserved:** restrained palette, generous spacing, serif display, sharp editorial corners — premium, never cheap or cluttered.
- **No popup spam, no discount-first noise.** Trust and curation do the selling.
- **Conversion-structured:** clear hero intent (makeup-led, home as elegant counterpart), trust above the fold, best-sellers early, social proof at the decision point, fast paths to cart.
- **Fast by construction:** CSS scroll-snap (no slider libs), responsive `srcset` with explicit dimensions (no CLS), lazy/async images, prioritized hero LCP, one deferred script.

## Compatibility
Built to Dawn / Online Store 2.0 conventions; uses only standard Shopify Liquid
objects, so it runs on virtually any OS 2.0 theme. All CSS/JS/markup is namespaced
to avoid collisions. The only host-theme edit is adding two `lux-jsonld` renders
in `theme.liquid` (Implementation Guide §3).

## Validation
- All `templates/*.json` and every `{% schema %}` block are valid JSON (CI-checkable; see `docs/02` notes).
- Validate structured data with Google's Rich Results Test after install.
- Measure CR / CWV before and after — your analytics are the source of truth.
