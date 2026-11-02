# SOFIE For You

First release: a learned item-to-item recommender blended with product text
similarity, decaying device interests, fresh discovery, and an 80/20 experiment.
This is not a neural model or a claim of YouTube-level accuracy.

## Runtime and data

Built on the actual growth deployment, commit
`a2bcda7ff324f2fd826bc766d66a05ebe45a0955`, rather than the repository default.
The theme integration starts from the current published Christmas Gifts + NOW
theme 161119010887. Existing decorations, product images and NOW logic are
preserved. No marketing campaigns are sent and no media generation is needed.

- Browser interactions require Shopify analytics AND preferences permission.
  The existing SOFIE measurement opt-out is also respected.
- A signed anonymous capability persists on this browser for up to 90 days.
  It is not a customer account, does not link devices, and is not fingerprinting.
- Product views require four seconds; a recommendation impression requires at
  least 50% visibility for one second in a visible tab. Server delivery and
  browser impression are different events.
- Served request IDs bind impression/dismissal attribution to the right device,
  variant, position, model and experiment arm.
- The browser can submit views/clicks/saves/carts, but never purchases.
- Existing authenticated Shopify order webhooks verify paid, non-test,
  non-cancelled orders and actual purchased recommended variants. Late updates
  cannot overwrite newer order state. Refunds remove positive purchase labels.
  This is last recommendation click attribution, not proof of causal uplift.
- Opt-out clears local identity, requests removal of device event/order history,
  and clears cart attribution. Aggregate relationships refresh at the next
  training run. A failed network deletion is bounded by the 90-day retention
  sweep; do not promise immediate deletion during an outage.
- All three new tables have RLS, no public/anonymous/authenticated grants, and
  server-only access. No customer names, contact details or raw IPs are stored
  in the recommendation tables.

## Learning and serving

Training runs 30 seconds after startup and every six hours. It uses 30 days of
legacy product clicks and cart adds, plus new device interactions and verified
order outcomes. Passive legacy views are excluded: their session quality is
insufficient for collaborative learning. Sessions are capped to 20 distinct
items per day, repeats do not inflate support, pairs require two sessions, and
cosine similarities are shrunk for low support. Initial engagement weights are
explicit engineering priors, not learned conversion probabilities.

The model is atomically replaced only after training succeeds and is persisted
in Supabase. Bounded keyset pagination fails rather than silently truncating
training data. There is a 20,000-row bound per event source and a 1,000-row bound
on paid attributed orders in the 30-day window; increase/paginate these before
traffic exceeds these release limits.

Candidate retrieval blends recent items, learned neighbors, popular items and
up to 24 distinct products from the existing Fresh at SOFIE collection. Exact
variant price, positive inventory and online publication are rechecked with a
60-second cache. Product text similarity is deliberately modest and uses names,
brand and option titles; it is not a diagnosis or guaranteed skin/shade fit.
Different shades of one product do not fill the row. The current option and
dismissed options are excluded. One slot explores a novel candidate when one
exists. Exploration selection changes daily per browser.

An 80% personalized / 20% popularity control assignment is stable per browser.
The UI is identical. Measure actual impressions, click rate, cart rate and paid
order outcomes per assigned browser; do not treat served counts as exposures
or declare a winner before adequate traffic and a complete buying window.

## Deployment and rollback

1. Apply `sql/for-you.sql` once through the connected database migration tool.
   The recorded production migrations are
   `sofie_for_you_learning_foundation` and
   `sofie_for_you_verified_order_outcomes` and
   `sofie_reco_clean_signals_training_index`.
2. Deploy the growth code from the connected journey branch after tests.
   Existing `RATE_HASH_KEY` signs anonymous capabilities; an optional
   `RECO_SIGNING_KEY` isolates that purpose. Never expose either to the theme.
3. Verify training produces `sofie_reco_models.id=active`, then smoke-test the
   consent, visitor, recommendation and feedback endpoints.
4. Upload only the new For You assets/section/snippet and the reviewed changes
   to the current theme layout, English locale and home template. Re-read those
   three files before upload so concurrent theme edits are preserved.
5. Verify mobile and desktop and consent withdrawal. Roll back the theme's
   seven changed files if necessary. `RECO_ENABLED=false` disables the backend
   subsystem and model jobs without affecting existing advisers or rewards.

Staff-only `GET /ops/for-you` with the existing bearer staff key returns model
version, timestamp, session count, item count and pair count. No shopper history
is returned. No new paid services or model API calls are required.

## Validation

`npm test` includes learned neighbor behavior, refresh resistance, stale/future
rejection, experiment control, dismissals, exact variant exclusion, capability
tampering, consent races, cross-device attribution rejection, verified purchase
labels, refund ordering and data deletion. Shopify validation covers all seven
changed theme files against live layout/template dependencies.

Future work: authenticated opt-in cross-device profiles; explicit validated
product attributes; learned conversion ranking after sufficient clean labels;
position-bias correction; evaluation dashboards; and richer search/video signals.
These are not represented as completed features in this release.
