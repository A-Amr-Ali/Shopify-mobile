# SOFIE Beauty Room

Eight real Shopify products sit on the original soft sage and blush arches. Transparent product assets sit directly on two continuous shelves. Hover or keyboard focus reveals a short emoji note and current price; the first touch reveals the card, and a second touch opens product options. Four tiny product characters bring the room and its invitation banner to life.

## Installed draft

- Store: sofiestore.net
- Draft theme: `160596656199`, **SOFIE • Beauty Room • First Experience**
- Base live theme at creation: `160472006727`, **SOFIE • Beauty Quest • Popup + Banner**
- Page: `136827633735`, handle `sofie-beauty-room`, template suffix `beauty-room`
- Preview: https://sofiestore.net/pages/sofie-beauty-room?preview_theme_id=160596656199

The files in `theme/` are an overlay for that exact base theme. The layout conditionally loads the room's CSS/JS on its page. The invitation is the first banner on the Makeup landing page, with its primary H1. On the store index it follows the existing categories section. Eight department links lead to the full existing beauty catalog. The existing Beauty Quest popup is excluded only on the room page, so it does not interrupt discovery. Other homepage content and previous translations are preserved.

The connected Shopify tool permits draft theme edits but blocks publishing and live-theme writes. To activate, open Online Store → Themes and publish **SOFIE • Beauty Room • First Experience**. The former live theme remains the rollback option. Review any concurrent live theme edits before publishing this draft.

## Assets and character

Eight alpha-preserving WebP cutouts are in `theme/assets/sfbr-*-cutout.webp`; `hosted-assets.json` records their Shopify Files references. No product background rectangles are drawn. `cutout-geometry.json` aligns the opaque base of each image to its shelf.

The four characters reuse the Pocket Blush, Glazing Milk, Lip Tint and Dior Lip Oil cutouts. CSS supplies their little faces, arms and legs; routes are recalculated from the arch geometry. Pocket Blush explores the arch crowns while the others use separate lower lanes, keeping the product displays clear. Motion continues during hover, focus and open product dialogs, with no pause control. Reduced-motion preferences slow the path while preserving gentle continuous movement. This revision restores the first CSS arches and does not render the earlier wooden arch image.

## Product flow

Variant selection controls the exact current Shopify price, availability, product link and cart variant. A choice is required before adding; sold-out variants are disabled. Native Ajax cart errors are shown and repeated submissions are prevented. Delivery is checked through the product's existing details; no SOFIE NOW collection or eligibility was changed. Measurement uses the store's existing consent gate.

## Verification

- `test-results.json`: 13 interaction checks passed, including required variant selection, double-submit protection, inventory failure recovery, focus restoration, touch cards, continuously moving characters and all eight department links.
- Real browser: Glazing Milk 124ml was added to the actual bag, its variant and price were verified, then the test item was removed. Bag returned to zero. No checkout was submitted.
- Real browser after this revision: Pocket Blush shade selection enables add and generates its exact variant link; homepage invitation returns to the room.
- `layout-check.json`: all eight opaque product bounds were checked at desktop, 390px mobile and 768px tablet. Zero overlaps; minimum gaps were 14.91px, 11.55px and 16.21px respectively.
- `final-validation-summary.json`: changed theme files pass Shopify validation. The Arabic locale retains 716 pre-existing translation mismatches outside `sf.room`; this change introduces no room translation errors.
- `qa/first-banner.jpg`: native storefront proof that the new invitation is the first Makeup banner.
- `qa/final-preview.jpg`: native storefront screenshot of the restored arches, four characters and department navigation.
- `motion-check.json`: all four animations remained running while product details were open; native mobile/tablet previews also verified the first banner.

The unlinked `page.beauty-room-preview.liquid` was used for responsive visual QA and is now an inert, noindex link to the real room; no static product/price snapshot remains in it.

Run the interaction checks with Node.js and `jsdom` available: `node beauty-room/test.cjs`. `fixtures/room.html` is the isolated rendered component used by these checks.
