# SOFIE birthday desk

Private dashboard: `/ops/birthdays`. It uses the same `PROCUREMENT_KEY` (or `STAFF_KEY` fallback) as the buying desk and an eight-hour, HTTP-only operations session.

## What appears

- Only customers with a saved birthday and `birthday_opt_in = true` are included.
- Dates are evaluated in `Africa/Cairo`.
- The page shows birthdays today and the next 30 days.
- Shopify is queried live for `numberOfOrders`, `amountSpent`, and the latest non-test, non-cancelled order.
- If Shopify is temporarily unavailable, the page clearly warns staff and uses stored `lifetime_spend_egp` only as a fallback.

The dashboard is read-only. It does not send gifts, contact customers, edit birthdays, or change Shopify orders.
