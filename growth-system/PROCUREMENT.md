# SOFIE buying desk

Private dashboard: `/ops/procurement`. Sign in with the service's `PROCUREMENT_KEY`. The secret is never included in the repository or in browser scripts. The session lasts eight hours.

The existing Growth service and Supabase project are reused. `PROCUREMENT_ENABLED=true` enables order reconciliation at startup and every five minutes. Existing signed order webhooks trigger a fresh single-order read. When the installed app cannot read fulfillment-location details, the integration uses the order's exact `unfulfilledQuantity` without requesting additional app permissions.

Cancelled, closed, fulfilled, test, refunded, voided, and explicitly delivered/in-transit orders are excluded. Fulfilled pieces are removed from partial orders. Purchase records subtract already purchased pieces and support undo. A purchase record never places a supplier order or changes Shopify fulfillment.

Source routing uses an explicit source label or staff override first, then the existing exact SOFIE NOW option list. Items outside SOFIE NOW are labelled as inferred Reglare Store. SOFIE NOW products lacking exact stocked-option evidence require source review. No Shopify inventory, collection membership, or product data is changed.

Only Sephora or the product's official brand domain is accepted. Exact size/shade, currency, country and stock evidence are required. Verified offers expire after twelve hours. UAE is preferred over US, then UK. Automated discovery checks Sephora UAE and supported official US Shopify stores; unmatched options and UK fallbacks require research in the scheduled morning brief. Known Shopify sources are refreshed hourly against their exact supplier variant; Sephora's rendered SKU must agree with the matched SKU. The page's default shade cannot verify another shade.

Costs per piece, in EGP:

| Market | Landed cost | Target including margin |
| --- | --- | --- |
| UAE | AED price × 1.03 × 15 + kg × 900 | Landed + 500 |
| US | USD price × 1.03 × 55 + kg × 2,500 | Landed + 500 |
| UK | GBP price × 1.03 × 75 + kg × 2,500 | Landed + 500 |

Missing or zero shipping weights remain unknown. Product fill volume is never substituted for packed shipping weight. The margin is shown separately from purchase/landed cost.

All `procurement_*` tables have RLS and no browser-role grants. Access is through authenticated server routes. No customer names, email addresses, addresses or payment details are stored. The purchase RPC uses an order-row lock and an idempotency key to prevent duplicate allocations and quantities above open demand.

Run `npm test`. The morning automation should reconcile against current Shopify data, re-read purchases/options, verify official sources, update `procurement_sources`, and send the owner a concise grouped list plus unresolved exceptions. It must never buy automatically, change the protected SOFIE NOW collection, invent weights, or present search results as stock-verified purchase links.
