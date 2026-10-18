# Beauty Quest invitation and homepage banner

Installed on unpublished Shopify theme **SOFIE • Beauty Quest • Popup + Banner**, ID `160472006727`, duplicated from the current profile/rewards/birthdays theme on 18 October 2026. Publishing this theme in Shopify Admin → Online Store → Themes activates these placements. The Shopify connector supports editing unpublished themes and blocks theme publishing and live-theme file writes.

## Customer experience

- Invitation appears after eight seconds, once per browser session across storefront navigation. The editor offers a 5–30 second delay and an enable switch.
- Close, Escape, Maybe later and backdrop click dismiss it. A Beauty Quest launcher lets shoppers reopen it.
- Display waits while the tab is hidden, someone is typing, or another native dialog is open.
- Cart, checkout, account/password pages and the game itself are excluded. Browsers without native dialog support keep the banner and skip the popup.
- Sage-and-cream banner sits directly after the hero on both `templates/index.json` and `templates/page.home-makeup.json` (the `/pages/sofies-makeup` page).
- Both placements link to `/pages/beauty-quest`; UTM placement labels distinguish popup and homepage banner traffic. The existing consented SofieJourney analytics integration gates invitation events.
- English and Egyptian Arabic strings use `sf.quest`. The game itself remains its existing English experience.
- No discount, email gate, camera use, cart change, or compulsory purchase is introduced.

## Files

`theme/` preserves the exact ten installed files. Five are new: two sections, a portrait snippet, CSS and JS. `layout/theme.liquid` loads the assets and the global invitation section. Two templates receive only the new banner section. Two locale files receive only twelve new `sf.quest` keys each. Existing section order, matching flows and all prior locale values were checked for preservation.

The theme editor can disable each banner independently. All visual styles use the `sfqp-` prefix. The invitation uses native dialog focus containment, restores focus on dismissal, and respects reduced motion. The persistent launcher sits above mobile bottom controls.

## Verification

Run from the repository root, with `jsdom` installed:

```sh
node beauty-quest/promotion/test.cjs
```

Fourteen behavioral checks pass: initial delay, focus, display frequency, dismissal, manual reopening, cross-page session behavior, typing/dialog deferral, excluded pages and unsupported-browser fallback. `test-results.json` records the result. Native Shopify theme-file installation returned zero errors. Live browser checks exercised the makeup page, the root homepage, and game navigation.

The Shopify Liquid validator passed the layout, new sections/snippet/assets, English locale, and both homepage templates. The Arabic file retains pre-existing missing/default-translation mismatches outside `sf.quest`; the twelve newly added translations have no validation errors. All previous Arabic values and keys were preserved exactly. See `validation-summary.json`.

Preview screenshots are saved under `qa/`. An unpublished alternate template was used to inspect the actual promotion components in 390px mobile and 768px tablet frames, then replaced with an inert noindex completion page. Shopify's connector blocks theme-file deletion, so this eleventh file remains inactive; it is not assigned to a page or linked from the storefront.

## Activation and rollback

In Shopify Admin → Online Store → Themes, preview and publish **SOFIE • Beauty Quest • Popup + Banner**. The existing live theme remains available for rollback. If the store theme changes again before publication, rebase these ten files onto that newer theme before publishing. The game page exists independently and continues to work without this promotion.
