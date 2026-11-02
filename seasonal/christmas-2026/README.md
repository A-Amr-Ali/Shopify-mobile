# SOFIE Christmas 2026/27

SOFIE's storefront receives a forest-green, berry and champagne Christmas layer: an animated miniature Santa sleigh above the original logo, a gift-edit ribbon, a seasonal homepage illustration, restrained snowfall on storefront pages, small product-card stars and a festive footer sign-off.

The layer ends automatically at **8 January 2027, 00:00 Africa/Cairo** (`2027-01-07T22:00:00Z`). Liquid stops emitting its markup and asset requests at the boundary. A browser timer also removes the decorations from tabs already open, including after a tab becomes visible again. This is a one-season date window, not an annual recurrence or a rollback to an old theme.

## Shopify draft

- Draft: **SOFIE • Christmas Magic • Jan 7**, theme `161115865159`.
- Copied from the published **SOFIE • Hair Match • Nov 1**, theme `161076838471`, whose snapshot was updated `2026-11-01T11:40:54Z`.
- Preview: `https://sofiestore.net/?preview_theme_id=161115865159`.
- The Shopify connector permits file updates on unpublished themes and blocks theme publishing. Publish the completed draft in Shopify Admin to make the design visible to shoppers.
- `theme/` is a focused overlay for this exact source theme, not a complete downloadable theme. Apply the files at the same relative paths. The copied layout, header, settings schema and locales preserve the published source around the seasonal additions.

## Controls and performance

Theme settings include **Christmas 2026/27 → Enable Christmas decorations** and **Enable gentle snowfall**. Shoppers can pause all festive animation; the preference persists in their own browser. Reduced-motion preferences disable animation and snowfall. Snow also stays off for browsers reporting data saver.

Snow uses at most 24 decorative spans on desktop and 12 on mobile, CSS transform animations, no image downloads and no external animation libraries. The overlay cannot intercept clicks. Background tabs pause the animations. The CSS is approximately 3.1 KB gzipped and JavaScript 1.4 KB gzipped.

Gift-edit and mini links use the store's existing collections and fall back to the full catalog if the collections are unavailable. The homepage hero also appears on the SOFIE Makeup and SOFIE Home landing pages; product pages receive the ribbon and snowfall without the large hero.

An unassigned `page.christmas-qa.liquid` alternate template renders the normal `sf-page` section. Its temporary responsive test harness was replaced with this pass-through because the connector blocks file deletion. No page assignments were changed.

## Verification

Run `npm install` and `npm test` in this directory with Node 22 or later. Test-only dependencies are pinned in `package.json`; they are not storefront dependencies.

The 27 checks cover Cairo midnight, Liquid output before and after expiry, already-open and cached pages, merchant switches, mobile snow limits, reduced motion, data saver, blocked browser storage, pause persistence, product-page output, collection fallbacks and matching English/Arabic seasonal keys.

Shopify theme validation passes the changed Liquid, JavaScript, CSS, header, layout, settings schema and English locale. The Arabic locale retains the same 900 pre-existing theme-check translation diagnostics as the published baseline, with no added diagnostics. Existing translations are semantically unchanged apart from the new `sf.christmas` group.

Browser review verified the real draft homepage and product page, working pause/resume controls, the existing product form, and `pointer-events: none` on the snow. Responsive component previews at 390px and 320px had no horizontal overflow. A checksum comparison verifies the uploaded overlay against local source and confirms all other original theme files are unchanged.

## Home + Beauty gifts

The Christmas Home & Living hero and the main homepage entry link to the separate Home Meets Beauty collection. Mixed gifts have no advertised price ceiling. The hero uses the reviewed bundle photograph, showing every included product together inside one gift box with `object-fit: contain`. Match each product's original shape, colour, packaging, cap, logo and exact option. A generated gift setting is permitted; replacing a complete bundle photograph with a single component or separate thumbnail cards is not. The product gallery retains the original component photographs for detail inspection.

SOFIE NOW eligibility is derived from all selected component options and available stock. The underlying SOFIE NOW collection is not modified. New seasonal copy is included in English and Arabic, and the existing Christmas cutoff and motion controls apply.

Run `npm test` for the seasonal lifecycle, bundle stock handling, separate-purchase savings and Home + Beauty banner checks.
