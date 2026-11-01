# SOFIE Hair Match

Hair Match gives shoppers a hair profile and a routine from currently purchasable SOFIE products. It separates natural pattern, individual strand thickness and scalp condition, then considers colour or chemical processing, up to two concerns, heat use, washing frequency, routine size and an optional price cap per product.

The installed preview is the unpublished theme **SOFIE • Hair Match • Nov 1**, theme ID `161076838471`. Its entry route is `/collections/all-hair?view=hair-match`. A `page.hair-match` template is also available if a dedicated page is wanted later. Existing Find My Match hair links, the desktop and mobile navigation, and the Hair and All Hair collection introductions lead to this experience.

## Product matching

The `collection.sfhair` Liquid view exposes live prices, available variants, descriptions and exact variant eligibility from the existing `sf-now-ready` snippet. The client follows every returned catalog page. It requests HTML content negotiation because Shopify otherwise returns its generic collection JSON instead of the Liquid view. Draft requests carry the source theme ID to keep previews consistent across tabs. Published pages do not add a preview parameter.

The matching engine parses both Hair Type and Hair Texture description fields, including catalogs where these labels are reversed. Explicit pattern and strand incompatibilities are excluded. The engine excludes pet shampoo, fragrances, supplements, dry shampoo as a wash step, medicated scalp products and unrelated merchandise. Purple toning requires suitable hair colour and an explicit brassiness concern. Heat-activated products are excluded for air-dry profiles. Clarifying shampoo requires an oily scalp and a buildup concern.

Budget checks use the chosen available size, rather than the product-wide minimum price. SOFIE NOW filtering is strict at variant level and uses the existing collection-based eligibility logic. A missing match remains a visible gap. There are no invented confidence percentages or stock fallbacks. Recommendations depend on the completeness and accuracy of the merchant's product descriptions.

## Customer controls

Customers can switch sizes, explore alternative matches, exclude a product and add one product or the selected routine. Prices and availability are checked again before adding to the bag; SOFIE NOW options also have their eligibility rechecked. A changed price stops the add so the customer can refresh and review it. Adding a routine is a single cart request with unique variants. No order is submitted by the quiz.

The optional device-save button saves the questionnaire in `sofie-hair-profile-v1`. Customers can resume or forget it on the start screen. Saving selected products to Beauty Passport uses the existing `SofiePassport` API, retains existing saved items and leaves the skincare routine and profile answers unchanged. Hair answers are not transmitted to Passport. Existing consent-aware shopping measurement receives the generic match-completed event without questionnaire answers. This feature adds no subscription or AI service.

## Scalp guidance and product directions

Sudden or patchy hair loss, a painful or burning scalp, sores or bleeding stop product recommendations and direct the shopper to a dermatologist. Persistent shedding, itching or flakes show a care note. An irritated scalp leaves the cleanser slot open. The questionnaire does not diagnose a condition or promise hair growth.

K18 leave-in repair mask recommendations have separate timing and a conditioner notice. Pre-wash treatments appear before cleansing. Other products link to their own directions rather than receiving invented doses or treatment schedules.

Reference checks:

- [American Academy of Dermatology: signs and symptoms of hair loss](https://www.aad.org/public/diseases/hair-loss/insider/begin)
- [American Academy of Dermatology: tips for managing hair loss](https://www.aad.org/public/diseases/hair-loss/treatment/tips/)
- [K18: how to use](https://www.k18hair.com/pages/how-to)
- [Shopify: theme performance](https://shopify.dev/docs/storefronts/themes/best-practices/performance)

## Validation and release

Run engine checks with `node --test tests/hair-match.test.cjs`. The UI check uses Playwright with a local server and public product fixtures: `node tests/hair-match.ui.cjs`. Set `CHROMIUM_EXECUTABLE_PATH` if using an existing browser binary and `HAIR_TEST_OUTPUT` to choose the screenshot directory. UI checks mock all cart and Passport writes; they do not place orders or change customer data.

The UI suite covers required answers, an optional budget, the two-concern limit, full pagination, preview parameters, available variants, unique batch cart additions, changed-price rejection, empty SOFIE NOW results, device save/resume, Passport preservation, scalp referral, loading failures, retry and a 390px layout. Shopify's Liquid validator checks all changed theme files. The four existing Find My Match script parts are validated as a concatenated program because each part is intentionally incomplete on its own.

The source package is based on repository commit `b2227e9820f19874a28a630f09628e7d1218188a` and the published theme snapshot `160959365191`. `storefront/` contains the change set, not a complete replacement theme. The Shopify draft was duplicated from the published theme and patched only after duplication completed. The Beauty Quest invitation is suppressed inside Hair Match so it cannot interrupt the questionnaire.

Publishing remains a Shopify admin action: Online Store → Themes → **SOFIE • Hair Match • Nov 1** → Publish. The connector supports draft file edits and blocks live theme writes and publishing. Check for newer published-theme changes before release; do not replace a concurrent storefront revision without reconciling it.

Graphify was used against the matching repository baseline before source inspection. Its local refresh covers the new feature with zero LLM API tokens. Liquid and CSS are outside the raw AST extractor's language coverage; structural file references supplement that graph. Separate legacy script parts may have extraction warnings even when their concatenated program is valid. This scoped feature graph is not a business-wide audit.
