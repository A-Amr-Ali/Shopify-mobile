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

Proposed terms: EGP 250 credit, 20 participants, one credit per verified customer after a paid mini is handed over locally, redeemable on the exact 240 mL option within 30 days. No stacking or cash value; delivery separate. Refunded/cancelled qualifying purchases do not qualify. Staff verify the receipt, local handover and stock before issuing a customer-specific one-use credit. Statutory return rights are unchanged. The pilot remains disabled in `growth-system/src/discovery.mjs`; no discount codes or financial commitments have been created.

The proposed credit economics and recorded cost inputs are kept in the merchant's private review. Maximum nominal credit exposure is EGP 5,000.

## Policy handoff

Shopify denied `shopPolicyUpdate`: the connected app lacks `write_legal_policies`. Complete replacement HTML is in `storefront-content/shipping-policy-canonical.html`, `refund-policy-canonical.html` and `terms-of-service-canonical.html`. Apply the shipping body to both the Shopify policy and `/pages/shipping-policy` together. Existing published policies were not silently changed after that denial.

The refund draft removes the unfinished contact field and avoids treating a 24-hour damage-report request as a loss of statutory rights. It reflects the Consumer Protection Agency's published 14-day eligible-goods and 30-day defective-goods guidance, subject to applicable exceptions: https://cpa.gov.eg/ar-EG/اسئلة-متكررة . Confirm the meaning and current lead times of the legacy “Value order” Home category before publishing its wording.

## Release and rollback

Deploy the loyalty endpoint before exposing the theme's account-saving controls. Deploy the growth service before updating the SOFIE Knows page to include `/routine-editor.js`. The preview theme contains the new Passport template and links. Publish the verified preview theme to expose the changes across the storefront. The original theme and imported theme snapshot remain available for rollback; page/policy baseline HTML is committed separately. Reverting service sources restores the prior deployments. The additive Passport table can remain during rollback and does not alter loyalty points or rewards.

## Verification

- 36 loyalty tests pass, including signed owner, stale request, wrong shop, malformed option and privacy-field checks; Remix production build passes.
- 22 growth tests pass, including exact-option stock/delivery, budgets, sensitive-skin filtering, attribution, refunds and disabled discovery-pilot safeguards.
- Shopify full-theme checks pass on the changed Liquid files. The only remaining tab warning concerns Shopify's dynamic section/block IDs.
- Browser verification and deployment results are recorded below as they complete. A real signed-in customer's cross-device round trip requires an authenticated customer session; this browser currently has a guest storefront session.
