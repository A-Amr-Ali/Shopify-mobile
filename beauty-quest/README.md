# SOFIE Beauty Quest

Live Shopify page: https://sofiestore.net/pages/beauty-quest

A mobile-first, dependency-free storefront game with two journeys: a complexion shade shortlist and a cosmetic skin-care ritual. Players choose visual clues, tap a face map, and collect progress tokens. Budget is optional. No camera, account, email capture, or purchase is needed to play.

## Build and test

Use Node 20.19 or newer. Run `npm install` in this directory, then `npm test`. `node build.mjs` assembles the reviewed page body in `dist/page-body.html`; `dist/index.html` is a standalone layout preview. Live catalogue requests require the Shopify storefront origin.

`src/rules.js` contains deterministic recommendation rules; `src/game.js` handles the game, current product checks, exact variant selection, cart integration, and explicit saves. `src/style.css` is scoped to `#sofie-beauty-quest`.

## Deployment

Shopify Page ID: `gid://shopify/Page/136680996935`. The page uses the live theme's standard `sf-page` template and its `page.content` slot. Deployment updates this page's HTML body through `pageUpdate`; no theme switch or live-theme file changes are needed. Rebuild before replacing its body. The game is available at the URL above; homepage/navigation promotion is a separate placement change.

The existing live `collection.sfm` view supplies the catalogue. It must be requested with `Accept: text/html`; Shopify otherwise negotiates its standard collection JSON response. Feed categories come from the existing matching configuration, with matching fallback handles. Only selected category feeds are requested, up to the live view's first 250 products and 70 variants per product. Recommendations are rechecked against the Ajax Product API before display and before adding to cart. Skin steps try up to two alternative candidates if a candidate fails the full product-detail check. Missing matches are shown explicitly.

## Matching and customer care

- Shade depth and undertone use written shade descriptions. Bare shade numbers are never normalized into skin depth. Unverified shade names appear as formula discoveries, and customers must select a shade before adding.
- Budget restrictions apply to the same available variant that is displayed and added. Product prices and availability are rechecked. A price change requires another deliberate add action.
- Cosmetic skin guidance starts with gentle cleansing, moisturizing, and verified broad-spectrum SPF 30+. Eye/lip journeys stay specific to those areas. Sensitive-skin choices require explicit fragrance-free product details. Strong exfoliants/retinoids are excluded from this initial game.
- Product-detail text matching is conservative and is not a medical diagnosis, clinical recommendation engine, guaranteed shade match, or guarantee of local inventory. No numerical match confidence is shown.
- No automatic answer persistence. Explicit device saves use `sofie-beauty-quest-v1`; customers can forget them. Explicit Beauty Passport saves add only selected product picks and preserve existing saved items.
- Game events contain action names and optional variant IDs only; publishing requires existing analytics consent. Answers are never copied into cart/order attributes. No new analytics service is provisioned.

## Validation

Automated checks cover incompatible shades, numerical shade ambiguity, actual-variant budgets, skin-area constraints, fragrance-free filtering, SPF requirements, changing prices, stock changes, exact add payloads, optional budget, explicit save/forget, concern limits, error recovery, and Shopify response negotiation. Live browser verification also exercises the published game against current storefront products.

Future catalogue and product-description changes can affect results. Recheck the game after replacing the live theme or changing matching feed handles. Shopify page HTML edits made in the visual rich-text editor can alter embedded code; keep source-controlled HTML as the canonical implementation.
