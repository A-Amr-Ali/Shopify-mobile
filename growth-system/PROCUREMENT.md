# SOFIE buying desk

Private dashboard: `/ops/procurement`. Sign in with the service's `PROCUREMENT_KEY`. The secret is never included in the repository or in browser scripts. The session lasts eight hours.

The existing Growth service and Supabase project are reused. `PROCUREMENT_ENABLED=true` enables order reconciliation at startup and every five minutes. Existing signed order webhooks trigger a fresh single-order read. When the installed app cannot read fulfillment-location details, the integration uses the order's exact `unfulfilledQuantity` without requesting additional app permissions.

Cancelled, closed, fulfilled, test, refunded, voided, and explicitly delivered/in-transit orders are excluded. Fulfilled pieces are removed from partial orders. Purchase records subtract already purchased pieces and support undo. A purchase record never places a supplier order or changes Shopify fulfillment.

Source routing uses an explicit source label or staff override first, then the existing exact SOFIE NOW option list. Items outside SOFIE NOW are labelled as inferred Reglare Store. SOFIE NOW products lacking exact stocked-option evidence require source review. No Shopify inventory, collection membership, or product data is changed.

Supplier order is Sephora UAE → Sephora US → Sephora UK → official brand UAE → official brand US → official brand UK → Ulta Beauty US. Exact size/shade/SKU, currency, country and stock evidence are required; aggregate or default-shade availability never verifies another option. Verified offers expire after twelve hours. The approved-brand registry now includes Bubble, Sincerely Yours and additional current queue brands. Official Shopify search suggestions and product-catalogue lookup find changed supplier handles, then exact live variant JSON verifies availability; non-Shopify product schema is checked conservatively. Advertised official UAE/UK market links can be discovered from the approved brand site, but the market currency must still agree.

Every discovery stores supplier-by-supplier attempts in the existing private `procurement_runs.summary`: exact stock, sold out, blocked, rate limited, missing regional store, format change or no exact match yet. An access denial is not a claim that a product does not exist. Unresolved options retry after 15 minutes for transient/access errors or one hour otherwise; verified research is revisited after six hours. A sourcing-version change invalidates old failed-attempt cooldowns. Fresh/unresearched demand is handled newest-first; subsequent checks rotate oldest completed research first, so repeatedly blocked recent items cannot starve older orders. Two bounded workers handle each batch. Nothing deletes purchases, resets staff overrides, changes Shopify inventory, SOFIE NOW or fulfillment, or buys automatically.

The dashboard shows the attempt trail and candidates separately from ready-to-buy links. Staff can `Research again` for an option or `Research products` for a fresh batch. `Check a product link` accepts only an exact page on Sephora, Ulta US or an approved domain for that product's brand, rechecks its live option/price/currency/stock, and remembers the result. It is authenticated, same-origin, rate-limited, blocks redirects and never trusts a submitted URL as proof of stock. The Bubble net-fill barcode/size identity is documented separately from shipping weight; 4.4 g of balm is never used as packed shipping weight.

Costs per piece, in EGP:

| Market | Landed cost | Target including margin |
| --- | --- | --- |
| UAE | AED price × 1.03 × 15 + kg × 900 | Landed + 500 |
| US | USD price × 1.03 × 55 + kg × 2,500 | Landed + 500 |
| UK | GBP price × 1.03 × 75 + kg × 2,500 | Landed + 500 |

Weight precedence is staff override, Shopify order shipping weight, then an exact supplier variant's documented gram weight. The original supplier weight evidence is retained. Missing or zero weights remain unknown. Product fill volume is never substituted for weight. The margin is shown separately from purchase/landed cost.

All `procurement_*` tables have RLS and no browser-role grants. Access is through authenticated server routes. No customer names, email addresses, addresses or payment details are stored. The purchase RPC uses an order-row lock and an idempotency key to prevent duplicate allocations and quantities above open demand.

Database migration `procurement_allow_unverified_source_timestamp` makes `procurement_sources.verified_at` nullable. A found product without confirmed exact-option stock must retain `stock_status=unverified` and a real `checked_at`, not a fabricated verification time. The ready-source predicate still requires a non-null, recent `verified_at`, exact match, positive price, correct currency and in-stock status. No data or access grants are removed or reset.

Run `npm test`. The morning automation should reconcile against current Shopify data, re-read purchases/options, verify official sources, update `procurement_sources`, and send the owner a concise grouped list plus unresolved exceptions. It must never buy automatically, change the protected SOFIE NOW collection, invent weights, or present search results as stock-verified purchase links.

