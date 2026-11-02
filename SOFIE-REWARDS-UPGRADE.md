# SOFIE Rewards upgrade — 17 October 2026

The rewards program now shows selected-option and quantity point estimates, one membership balance online and at branches, an online reward wallet, and birthday enrollment and gifts. Existing points and the four redemption rates are preserved.

## Customer rules

- Earn floor(floor(eligible EGP / 10) × multiplier). Insider 1×; VIP 1.25×; Icon 1.5×. Paid orders earn; shipping, tax and gift cards do not. Product estimates use the selected option and quantity; final discounts can change the award.
- VIP: EGP 40,000 rolling 12-month spend. Icon: EGP 120,000. The existing tier hold remains.
- Redeem 100 / 500 / 1,000 / 2,000 points for EGP 50 / 250 / 550 / 1,200. Website redemption creates an account-restricted single-use code. For a branch redemption, the cashier debits the same balance and applies the discount manually to the till receipt.
- Birthday month and day are optional. No birth year is collected; 2000 is the storage sentinel. Explicit birthday-email consent is separate from marketing consent. Saving requires a verified Shopify account email. Saved dates are locked against self-service changes; customer service can correct them after verification.
- Annual birthday credit: Insider EGP 50, VIP EGP 300, Icon EGP 750. It becomes available from the birthday for 45 days; February 29 is observed on February 28 in non-leap years. Opted-in VIP/Icon earn double their usual purchase points throughout their birthday month (2.5× / 3× total).
- One birthday gift per customer per birthday year. Allocation to online or store is atomic. Online codes cannot be applied manually at a non-Shopify till. Birthday and points discounts cannot be stacked on the same branch receipt.

## Daily birthday delivery

`npm start` runs the Remix server and a 15-minute birthday check using the existing `CRON_KEY`, `BREVO_API_KEY`/`RESEND_API_KEY` and sender settings. The job waits until 09:00 Africa/Cairo, catches up eligible birthdays during their 45-day window, creates the entitlement, and emails a link to the member's rewards page. It does not email unconsented customers. Per-year grants and atomic email claims prevent concurrent duplicate sends. Explicit failed sends retry up to five attempts. An ambiguous send that crashes before recording its result remains `sending` for staff investigation rather than sending repeatedly. `BIRTHDAY_JOBS=false` pauses the worker. The previous Klaviyo birthday metric is no longer emitted, avoiding a second delivery path.

## Branch use

Open https://shopify-mobile-production.up.railway.app/staff with the existing staff password. Find the customer by member number or exact registered email. Confirm their signed-in member card and email. Enter the branch and receipt number and purchase total. Redeem points or apply their available birthday credit, then manually apply the confirmed discount at the till. For a non-Shopify till, award points on the final amount actually paid. Never manually award a Shopify POS order that already generates paid-order webhooks. Retries with the same receipt do not debit or award points twice.

The database ledger remains append-only. New RPCs are SECURITY INVOKER, have fixed search paths, and can be executed only by the server service role. Customer APIs verify the signed Shopify proxy customer, shop, and a fresh timestamp. Client requests cannot select another customer's balance or birthday.

## Theme and deployment

Backend service: `sofie-loyalty`, project `balanced-strength`, root `/loyalty-app`. The source branch starts from the exact previous deployed loyalty tree and preserves Beauty Passport endpoints. No inventory, product prices, availability, or SOFIE NOW collection changes are included.

The `storefront/` files in this branch are theme patches. They are applied to a duplicate of the current live Connected Journey theme: **SOFIE • Rewards + Birthdays • Oct 17**, ID **160440418375**. The existing rewards page uses the `rewards` template. Publishing the draft activates the product points strip, new rewards hub, and account birthday prompt; this Shopify connection cannot publish themes.

## Evidence and verification

Sephora research used official sources: [Beauty Insider FAQ](https://www.sephora.com/beauty/loyalty-program), [2026 birthday gifts](https://newsroom.sephora.com/sephora-unwraps-another-year-of-beauty-with-its-2026-beauty-insider-birthday-gift-offerings/), and [UAE MY SEPHORA FAQ](https://www.sephora.me/ae-en/faq/my-sephora). The adapted principles are visible membership tiers, points, annual birthday recognition, and online/store continuity. SOFIE uses its own rules, design, and credit gifts.

Validation includes 43 loyalty tests, database transactions for birthday enrollment/locking/one-channel claims, receipt replay, nonnegative balances, repeated purchase awards, and online redemption retries. Synthetic database records were rolled back. Browser DOM tests cover member balance, redemption limits, valid and invalid birthdays, consent, English/Arabic output, wallet codes, selected-option/quantity estimates, sold-out options, gift cards, and non-EGP currency handling. Shopify's Liquid validator passes the changed Liquid, template, JS and CSS files and English locale. The inherited Arabic locale includes unrelated legacy translation inconsistencies; new reward keys exist in both languages. No full graphical browser is installed in this runtime.
