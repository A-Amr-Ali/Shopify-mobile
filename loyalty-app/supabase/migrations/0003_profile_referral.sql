-- Phase 2/3: profile tips cache, birthday grant guard, social-follow guard.
begin;

-- Cached tips on the profile (regenerated on profile change).
alter table profiles add column if not exists tips jsonb default '[]'::jsonb;
alter table profiles add column if not exists tips_updated_at timestamptz;
alter table profiles add column if not exists completion_pct integer default 0;

-- Birthday grants — one per customer per calendar year (the 365-day guard).
create table if not exists birthday_grants (
  id          bigserial primary key,
  customer_id text not null references customers(shopify_customer_id),
  year        integer not null,
  tier        loyalty_tier,
  code        text,
  egp_value   integer,
  created_at  timestamptz not null default now(),
  unique (customer_id, year)
);

-- Social follow grants — one per platform per customer (the once-only guard).
create table if not exists social_grants (
  id          bigserial primary key,
  customer_id text not null references customers(shopify_customer_id),
  platform    text not null,           -- instagram | tiktok
  created_at  timestamptz not null default now(),
  unique (customer_id, platform)
);

-- Helpful index for the monthly review cap.
create index if not exists points_ledger_reason_month_idx
  on points_ledger (customer_id, reason, created_at);

commit;
