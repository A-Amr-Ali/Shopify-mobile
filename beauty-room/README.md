# SOFIE Beauty Room

Six needs, written inside the original sage and blush arches, replace the shuffled opening shelf. Seventeen reviewed products introduce hydration, glow, cheeks, lips, complexion and eyes. Every arch opens its complete edit. A prominent link preserves the full 1,460-product catalog and all 23 best-seller brands.

## Installed draft

- Store: sofiestore.net
- Theme: `160596656199`, **SOFIE • Beauty Room • First Experience**, unpublished
- Base theme: `160472006727`, **SOFIE • Beauty Quest • Popup + Banner**
- Guided page: `136827633735`, handle `sofie-beauty-room`, suffix `beauty-room`
- Catalog: `350856085575`, handle `the-sofie-beauty-room`
- Preview: https://sofiestore.net/pages/sofie-beauty-room?preview_theme_id=160596656199

`theme/` overlays the base theme. The room invitation remains the first Makeup banner; the index invitation follows categories. Collection views use `?view=beauty-room` and retain brand selection, sorting, numbered pages and “More shelves”.

The Shopify connector permits unpublished-theme edits and blocks publishing/live-theme writes. Activate by publishing **SOFIE • Beauty Room • First Experience** in Online Store → Themes. The former live theme remains the rollback option; review concurrent theme edits before activation.

## Complete need edits

| English arch prompt | Products at verification |
| --- | ---: |
| Feeling dry? | 71 |
| Want more glow? | 123 |
| A fresh flush? | 154 |
| Your lip wardrobe. | 264 |
| An even finish? | 101 |
| Eyes, defined. | 187 |

`catalog/needs-collections.json` records collection IDs, membership and featured handles. These edits were formed from the published best-seller-brand catalog, then refined to exclude unrelated brushes, cases and accessories. Products can belong to several appropriate edits. The six edits are curated manual collections and can be refreshed when new merchandise arrives. The aggregate and full brand collections use vendor rules and automatically include newly published products.

English prompts, short notes and featured products are editable through theme settings. Product placement follows verified store descriptions; no treatment claims are added.

## Images and interaction

Peptide Lip Treatment, Patrick Ta Blush Duo and the Dior palette now use complete transparent assets with opaque pale packaging. The official Rhode lip-shape PNG supplies one real stick through a native presentation crop. `hosted-assets.json` records Shopify references; `ASSET-BRIEFS.md` records prompts and project asset paths.

Other packshots are masked locally in a small worker for shelf presentation. Original catalog photographs are unchanged. The renderer prefers the primary packshot, avoids obvious swatches/model alternates and rejects uncertain or fragmented masks. It retains the original photograph if extraction is uncertain. All seventeen guided products were visually checked as complete cutouts.

Products occupy separate areas on two shelves; English guidance sits above them. Hover, focus or first touch reveals a short product card. Native dialogs preserve exact variant prices, availability, product links and cart IDs. Sold-out choices stay disabled; duplicate submissions and cart errors recover correctly. SOFIE NOW eligibility is unchanged.

Eight product characters animate across the two guided rows. Pocket Blush follows the crowns while the others use separate lower routes. Added catalog shelves preserve existing character nodes and receive their own characters. Hover, focus and product dialogs do not pause movement; reduced-motion preferences slow it.

## Verification

- 13 legacy product/cart interaction checks passed.
- Seven catalog checks cover 12→24 unique products, appended-product variants, duplicate-load protection, native failure fallback and preserved characters.
- Six guided checks cover English arch guidance, appropriate membership, complete edit links, repaired treatment and exact variant flow.
- Eight image checks preserve product colors, opaque packaging, existing alpha and original source pixels.
- Both repaired product cores are 100% opaque with transparent exterior pixels.
- Native browser: 1,460 products, 23 brands and six need links remain reachable. Hydration loads 12→24 products while all eight characters keep running. Rhode's last page reaches products 97–106; a one-product brand uses one arch.
- Native Peptide Lip Treatment dialog uses the complete corrected image, its five actual variants and EGP 3,040 price. Earlier native cart add/remove verification remains valid; no checkout was submitted.
- Mobile/tablet content widths 375px/753px: zero product or copy collisions, no page overflow, all eight characters running.
- Changed code/templates pass Shopify validation. The Arabic locale retains 716 inherited mismatches outside `sf.room`; new room keys are complete.

The temporary responsive preview template has been restored to an inert, noindex link without static products or prices. Results are in `catalog/*check.json`, `catalog/*results.json` and `catalog/validation-summary.json`.

With `jsdom` available: run `node beauty-room/test.cjs`, `node beauty-room/catalog/test.cjs`, `node beauty-room/catalog/guided-test.cjs`, and `node beauty-room/catalog/matte-test.cjs`. Fixtures are dated verification data, not production catalog sources.
