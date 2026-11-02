# SOFIE intent and account recommendations — v2

## What is implemented

- Complete paginated retrieval of published, active, positive-inventory Shopify
  variants, up to a 40,000-variant safety limit. A failed or truncated refresh
  never replaces a good catalogue. API cost/throttle metadata controls pacing.
  Hourly refresh, persistent server-only snapshot, five-minute in-memory index.
- Bilingual Arabic/English BM25-style retrieval over names, brand, product type,
  tags and description, with variant-title matching. It retrieves new products
  even without previous interactions. No paid embedding or LLM inference calls.
- Arrival context from explicit campaign routing, declared UTM keywords, current
  on-site search and the actual landing product. Referrers become source names
  only; Google/Meta private history, personal files and conversations are not
  read. Contact-like query strings are dropped and unrecognised query terms
  are removed against the catalogue vocabulary.
- Current search or declared ad intent supersedes old retrieval interests.
  Historical behavior still personalizes ranking within relevant candidates.
  Fresh candidates,
  learned collaborative relationships and recency-weighted history are blended.
  Exploration respects the current intent rather than inserting unrelated items.
- Optional authenticated account continuity. Shopify's signed proxy, exact shop,
  fresh timestamp and verified customer ID issue a 120-second AES-GCM encrypted
  identity ticket. The growth server validates it and derives a pseudonymous
  subject. It never trusts a customer ID supplied by browser JavaScript.
- An account sees only its subject-scoped recommendation history across signed-in
  browsers, plus its own saved Beauty Passport choices, routine and profile
  preferences. Legacy paid-order item titles inform interest but are never
  represented as verified shade/variant purchases when IDs are absent.
  Anonymous history reads exclude records tied to a signed-in account.
- Server-recorded features on served requests and actual impressions. A logistic
  click ranker is eligible only with 500 mature impressions, at least 50 positive
  and 200 negative labels, a temporal holdout of sufficient size, and held-out
  log-loss improvement. Otherwise it stays inactive. This is not a proven
  conversion model; no uplift, perfect shade match or reading minds is claimed.
- Staff-authenticated campaign-route import endpoint
  `POST /ops/for-you/campaigns` accepts at most 100 entries:
  `{campaigns:[{id,source,terms,active}]}`.
  It contains no advertising credentials, does not create ads or spend money,
  and does not claim to import Windsor automatically.

## Deployment

The growth service baseline is the connected journey branch; the loyalty service
baseline is `0190ed85dc63ddc5e60dd2600c7219304422bfff`. Only the identity core
and the new `apps.loyalty.reco-identity` route are added to loyalty; existing
rewards and birthday code is preserved. Both services derive the internal ticket
key from their existing server-side Supabase service role secret. It never
reaches the theme. If keys differ, tickets are rejected rather than trusted.

Database migration: `sofie_for_you_verified_identity_intent_catalog`.
New catalogue and campaign tables are RLS-enabled and grant no access to public,
anonymous or authenticated browser roles. Subject indexes support account reads.
No extra subscriptions, ad spending or API purchases are started.

The UI starts from the actual published
**SOFIE • Home + Beauty • Original Photos • Nov 2**, theme 161121337415.
The v2 draft is **SOFIE • Home + Beauty + For You v2 • Nov 2**.
For You moves to the first home-template section after the existing seasonal
layer. Original home/beauty gift files and images are preserved. The compact
horizontal product row avoids adding multiple vertical rows ahead of shopping.

## Example campaign links

These are prepared routing links, not launched campaigns:

- Blush:
  `https://sofiestore.net/?sf_campaign=sofie-blush&utm_source=meta&utm_medium=paid_social&sf_intent=blush`
- Rhode lips:
  `https://sofiestore.net/?sf_campaign=sofie-rhode-lips&utm_source=instagram&utm_medium=paid_social&sf_intent=lips`
- Hair/frizz:
  `https://sofiestore.net/?sf_campaign=sofie-hair-frizz&utm_source=meta&utm_medium=paid_social&sf_intent=hair`
- Home gifts:
  `https://sofiestore.net/?sf_campaign=sofie-home-gifts&utm_source=klaviyo&utm_medium=email&sf_intent=gifts`

Use `sf_campaign` for a registered campaign code or ID. An existing UTM campaign
with a registered ID also resolves. Unknown campaigns do not create targeting
rules. User-supplied context is a hint, not verified personal fact.

## Controls, measurements and limits

Shopify analytics AND preferences permission remains required before identity,
storage or behavioural requests. Tickets stay in memory, not persistent storage.
Device opt-out stops new requests and clears local context. With a fresh account
ticket it removes subject-scoped recommendation history; without one it can
remove only device-scoped history. Explicit Beauty Passport data is not deleted
by this action. Aggregate models refresh on the next training cycle.

80/20 assignment is stable by verified subject when signed in and by browser
otherwise. Compare mature actual impressions/clicks/cart events and paid-order
outcomes by assigned actor. Position and selection bias remain limits of the
initial click ranker; a held-out improvement is not proof of causal sales lift.
Do not treat campaign-level reporting as an individual's cross-platform history.

Windsor.ai reads were verified on 2 November 2026. The Meta connector returned
27 ads for account `1036288484368758` over 1 October–2 November. Fifteen ads had
explicit product copy and were mapped to three intents: Rhode lip tint, Rhode
lip peptide, and Huda Beauty perfume. Reviewed routing metadata is in
`data/windsor-ad-routes-20261102.json`; generic/dynamic/ambiguous ads were omitted.
Only routing terms and ad IDs enter the server-only registry. Ad discounts,
delivery promises, raw copy, spend and individual social profiles are not imported.

For those ads use `sf_ad={{ad.id}}` in URL parameters; alternatively a numeric
`utm_content={{ad.id}}` is recognized when `utm_source=meta` or `instagram`.
The frontend resolves it as `meta-ad-<ID>`. Explicit `sf_campaign` takes precedence.
Example verified ad: `https://sofiestore.net/?utm_source=meta&sf_ad=120253519911590579`.
Returned `url_tags` and `link_url` were null, so automatic attribution of current
ad traffic is not established. No live ad was edited, launched or funded.
Updating Meta ad parameters requires confirmation of the specific change.
This is a reviewed import snapshot, not a recurring Windsor sync. Google Ads
and GA4 were absent from connected sources. There is no private search access.

Catalogue sync uses 50-variant pages, bounded retry of transient timeouts and
throttling, a 30-second Admin read deadline, and atomic snapshot publication.
Failed catalogue jobs retry after five minutes, retaining the last good snapshot.
Product metadata is stored once per handle in the v2 snapshot, with separate
exact-option records. Catalogue reads/writes have a dedicated 60-second deadline;
ordinary application database calls keep their existing 10-second deadline.
