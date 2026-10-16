# SOFIE connected buying journey

Implementation started 16 October 2026. Theme preview: `160399294535` (SOFIE • Connected Journey • Oct 16). Original live theme: `160393723975`.

## Customer behaviour

- Featured shelves and the first category tab render product cards in Liquid. Empty selections do not leave a blank featured shelf. Subsequent tabs retain an explicit collection link when loading fails.
- Mobile browsing avoids client-side image background processing. The primary font has one preload; critical styles load in the document head. The existing hero keeps eager loading and high priority.
- Beauty Passport connects Find My Match answers, SOFIE Knows preferences, exact saved product options, the editable routine, and the existing Rewards profile. Guests save on their device; signed-in customers save through the existing Shopify app proxy.
- Routine shoppers can exclude a step, change size/shade, swap a product, see a revised total and save. Exact variant price, online publication and reported stock are rechecked before adding. Delivery reads the store's existing SOFIE NOW rendered option list. Unknown delivery evidence is shown as needing confirmation.
- Existing content-calendar UTM IDs travel through a shared shopping session into cart attributes and the existing order webhook. Measurement follows the Shopify privacy API or the shopper's explicit choice. Turning it off removes the session and attribution attributes. Beauty answers and contact details are excluded from growth events.

## Data and authentication

`loyalty-app/supabase/migrations/0005_beauty_passport.sql` adds `beauty_passports`, keyed to the existing customer. RLS is enabled and browser roles have no table or RPC privileges. Only the signed app proxy can read or write an account Passport. Requests require the expected shop, a fresh signature timestamp and the signed customer ID. Versions prevent concurrent saves from overwriting each other. Free-text notes and saved prices are discarded. The Rewards profile remains the existing source of truth.

The migration also extends the existing consent-aware event names. Its save/conflict/update behaviour was exercised in a rolled-back transaction. No test customer was retained.

## Discovery pilot prepared for approval

Cheirosa 62 90 mL option `40432045654087` → 240 mL option `40432045621319`. Reported availability in Shopify's New Cairo location was checked on 16 October. Neither is in SOFIE NOW; this implementation does not change that.

Proposed terms: EGP 500 credit, 20 participants, one credit per verified customer after a paid mini is handed over locally, redeemable on the exact 240 mL option within 30 days. No stacking or cash value; delivery separate. Refunded/cancelled qualifying purchases do not qualify. Staff verify the receipt, local handover and stock before issuing a customer-specific one-use credit. Statutory return rights are unchanged. The pilot remains disabled in `growth-system/src/discovery.mjs`; no discount codes or financial commitments have been created.

The proposed credit economics and recorded cost inputs are kept in the merchant's private review. Maximum nominal credit exposure is EGP 10,000.

## Policy handoff

Shopify denied `shopPolicyUpdate`: the connected app lacks `write_legal_policies`. Complete replacement HTML is in `storefront-content/shipping-policy-canonical.html`, `refund-policy-canonical.html` and `terms-of-service-canonical.html`. Apply the shipping body to both the Shopify policy and `/pages/shipping-policy` together. Existing published policies were not silently changed after that denial.

The refund draft removes the unfinished contact field and avoids treating a 24-hour damage-report request as a loss of statutory rights. It reflects the Consumer Protection Agency's published 14-day eligible-goods and 30-day defective-goods guidance, subject to applicable exceptions: https://cpa.gov.eg/ar-EG/اسئلة-متكررة . Confirm the meaning and current lead times of the legacy “Value order” Home category before publishing its wording.

## Release and rollback

Deploy the loyalty endpoint before exposing the theme's account-saving controls. Deploy the growth service before updating the SOFIE Knows page to include `/routine-editor.js`. The preview theme contains the new Passport template and links. Publish the verified preview theme to expose the changes across the storefront. The original theme and imported theme snapshot remain available for rollback; page/policy baseline HTML is committed separately. Reverting service sources restores the prior deployments. The additive Passport table can remain during rollback and does not alter loyalty points or rewards.

## Verification

- 36 loyalty tests pass, including signed owner, stale request, wrong shop, malformed option and privacy-field checks; Remix production build passes.
- 24 growth tests pass, including exact-option stock/delivery, budgets, sensitive-skin filtering, attribution, refunds and disabled discovery-pilot safeguards.
- Shopify full-theme checks pass on the changed Liquid files. The only remaining tab warning concerns Shopify's dynamic section/block IDs.
- Browser verification and deployment results are recorded below as they complete. A real signed-in customer's cross-device round trip requires an authenticated customer session; this browser currently has a guest storefront session.

Cart QA found an active 5% automatic promotion. The discovery draft is therefore EGP 500 rather than EGP 250, so it can beat a 5% discount on the observed EGP 5,400 full size. Keep it non-stacking and recheck promotions before activation.

## Continuation check — 17 October 2026

The preview now uses Shopify's storefront sign-in route so a customer returns to the page they started from. After sign-in, an explicit import adds guest device saves to the account. Existing account preferences, routine and match take precedence; exact saved options are deduplicated. The device copy is removed only after a successful account save. Failed writes, concurrent edits and the 100-option limit preserve that copy for retry.

Five client integration tests exercise first-account import, preservation of existing choices, save failure, concurrent edits, guest denial and save limits. All 45 current growth tests pass, including unrelated operations tests already on the shared branch. The unchanged loyalty deployment remains successful. Live customer authentication and the cross-device round trip remain pending; opening the sign-in screen is not proof of an account save.

Shopify still reports Connected Journey as unpublished. The connected app still lacks write_legal_policies; no retry or partial policy publication was performed. The local discovery credit remains disabled.

The changed Passport JavaScript and Liquid configuration pass Shopify checks. All Passport translation keys are present in English and Arabic and both JSON files parse. A full locale check also reports missing older Arabic translations outside Passport; these predate this patch and were not rewritten.
