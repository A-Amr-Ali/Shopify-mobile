-- Phase 4: AI Sales Agent — behavioural events + generated messages.
-- Privacy-first: we store DERIVED signals keyed by the Shopify customer id, not
-- raw PII. No addresses, no payment data. Events feed the agent; messages are an
-- auditable log of what was generated and (optionally) sent.
begin;

-- Personalisation fields the agent reads (populated from webhook payloads).
alter table customers add column if not exists first_name text;
alter table customers add column if not exists locale text;   -- e.g. en, ar

-- Behavioural events: product views (web pixel/app-embed), checkouts (webhook),
-- purchases (webhook). Append-only; the agent reads recent rows per customer.
create table if not exists customer_events (
  id             bigserial primary key,
  customer_id    text not null references customers(shopify_customer_id),
  type           text not null,            -- view | checkout | purchase
  product_handle text,
  product_title  text,
  data           jsonb not null default '{}'::jsonb,  -- line items, value, etc.
  token          text,                     -- checkout token / order id (dedupe)
  created_at     timestamptz not null default now()
);

create index if not exists customer_events_cust_type_idx
  on customer_events (customer_id, type, created_at desc);
-- One checkout/purchase row per token (idempotent webhook + pixel replays).
create unique index if not exists customer_events_token_uidx
  on customer_events (type, token) where token is not null;

-- Generated messages: the agent's output. status drives the review→send flow.
create table if not exists agent_messages (
  id           bigserial primary key,
  customer_id  text not null references customers(shopify_customer_id),
  email        text,
  trigger      text not null,              -- abandoned_cart | browse_no_buy | ...
  channel_hint text default 'email',       -- email | whatsapp (Flow decides final)
  subject      text,
  preview      text,
  body_en      text,
  body_ar      text,
  products     jsonb not null default '[]'::jsonb,  -- shoppable cards
  guardrail    jsonb not null default '{}'::jsonb,  -- {ok, violations[]}
  status       text not null default 'draft',       -- draft|approved|sent|skipped|failed
  source       text default 'claude',      -- claude | fallback
  dedupe_key   text not null,              -- one message per trigger-context
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  unique (dedupe_key)
);

create index if not exists agent_messages_status_idx
  on agent_messages (status, created_at desc);
create index if not exists agent_messages_cust_idx
  on agent_messages (customer_id, created_at desc);

commit;
