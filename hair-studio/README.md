# SOFIE Hair Studio

An eight-question haircare journey on the existing `/pages/hair` page. It separates natural pattern from strand thickness and scalp needs, then proposes an editable, priced routine from the live `all-hair` collection. This folder is a theme overlay for the copied production theme, not a standalone theme.

## Deployment

- Repository base: `A-Amr-Ali/Shopify-mobile`, `claude/sofie-store-luxury-redesign-payd6`, `b2227e9820f19874a28a630f09628e7d1218188a`.
- Source published theme: `160959365191`.
- Installed draft: `161076936775`, **SOFIE • Hair Studio • Nov 1**.
- The Shopify connector explicitly refused live-theme file writes. All feature files were instead applied to this unpublished duplicate. A merchant must publish the draft in Shopify Admin to activate it for all visitors.
- No product, inventory, collection membership, loyalty backend, database or account data was changed.
- The overlay's existing header, dialog, match teaser, collection, home templates and locale files were based on a fresh published-theme read on 1 November 2026. Rebase these files against any later merchant edits before applying the overlay to another theme.

## Behaviour

1. Eight questions: natural pattern, strand thickness, scalp, up to two ordered concerns, colour, heat, budget per product, delivery selection.
2. A paginated Liquid feed reads published storefront products and variant availability/prices. Draft preview requests carry the draft theme ID; published requests use the main theme.
3. Cosmetic matching uses the product details supplied by SOFIE. No diagnostic claims, invented match percentages, supplements, fragrance mists or tools appear in routines. Unknown sensitive-scalp cleansers are excluded; missing matches remain visible gaps.
4. SOFIE NOW eligibility uses the existing `sf-now-ready` snippet and the selected variant. Ordinary sellable options are labelled available to order with standard delivery, not physically in stock or express.
5. Product alternatives and sizes stay within the chosen per-product budget and delivery filter. Optional steps can be removed and totals recalculate. Product prices and availability are rechecked before one Shopify AJAX bag-add request.
6. K18 mask is ordered after shampoo with its four-minute wait; conditioner is omitted for that treatment wash. OLAPLEX No.3 is treated as pre-shampoo care. Consult each product's packaging for the exact formula's usage.
7. Hair answers are stored only after the shopper chooses device saving. Recommendations refresh on return. The optional Beauty Passport action adds selected product snapshots to its existing saved-products API without replacing the shopper's skincare routine or writing hair health answers to an account.
8. Existing consent-aware journey events measure start, completion, product click and bag add without sending quiz answers.

## Validation

- `node --test hair-studio/tests/hair-core.test.cjs`: eight meaningful matching tests passed.
- DOM integration exercised all eight questions, concern priority/limit, pagination, K18 ordering, optional local save, a price-change rejection, mocked bag add, editable totals and scalp referral. No purchase or customer profile write was used for testing. A separate guest-bag browser test also confirmed the real AJAX add succeeds; its test items were removed afterward.
- Shopify theme validator passed all 16 deployment files. The four legacy Find My Match fragments were concatenated and syntax-checked together, as the storefront loads them.
- Browser testing on the draft completed the journey against the real paginated catalog and verified real product images, selectable sizes, prices, reasons and editable totals.
- Optional authenticated Passport saving uses the existing service and has not been tested with a real customer account in this task. The Supabase project-list tool returned an internal error; no database change was required.

## Graphify

The initial baseline matched repository/default branch/commit and contained 814 nodes. Its scoped query located the existing beauty-profile quiz fields. Inspection confirmed that those stored fields were for skin/makeup, while the live theme had a simpler hair ritual; the new hair studio remains in the theme and reuses the existing Passport product-saving interface.

After adding the feature, Graphify extracted 143 code files into a task-specific graph: 852 nodes, 1,760 edges and 43 communities, with zero LLM API tokens. Liquid/CSS are not AST-indexed by this Graphify release. The existing split `sofie-match-4.js` is not a standalone JavaScript file and is only partially extracted; its concatenated runtime script passes Node syntax checking. This task graph is not a full business or deployed-backend audit.

## Product-specific references

- [K18 instructions](https://www.k18hair.com/pages/how-to): shampoo before the mask, skip conditioner before application, towel-dry, wait four minutes, leave in.
- [OLAPLEX No.3 / No.3PLUS](https://olaplex.com/blogs/news/your-guide-to-olaplex-no-3): pre-shampoo treatment; follow the formula's own bottle timing.
- [American Academy of Dermatology](https://www.aad.org/public/diseases/hair-loss/treatment/diagnosis-treat/): diagnosis of hair loss requires identifying its cause.
