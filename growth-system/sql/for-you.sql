create table public.sofie_reco_events (
  event_id uuid primary key,
  visitor_id text not null check (visitor_id ~ '^[a-f0-9]{64}$'),
  session_id uuid not null,
  event text not null check (event in ('served','impression','view','click','save','cart','dismiss','purchase')),
  variant_id text not null check (variant_id ~ '^[0-9]{1,20}$'),
  request_id uuid,
  position smallint check (position between 0 and 7),
  arm text check (arm in ('control','personalized')),
  model_version text,
  created_at timestamptz not null default now()
);
create index sofie_reco_visitor_time on public.sofie_reco_events(visitor_id,created_at desc);
create index sofie_reco_request on public.sofie_reco_events(request_id,visitor_id,event);
create index sofie_reco_time on public.sofie_reco_events(created_at desc);
create table public.sofie_reco_models (
  id text primary key check (id='active'),
  payload jsonb not null,
  trained_at timestamptz not null default now()
);
alter table public.sofie_reco_events enable row level security;
alter table public.sofie_reco_models enable row level security;
revoke all on public.sofie_reco_events, public.sofie_reco_models from public, anon, authenticated;
grant select,insert,update,delete on public.sofie_reco_events, public.sofie_reco_models to service_role;
create table public.sofie_reco_orders (
  order_id text primary key check (order_id ~ '^[0-9]{1,20}$'),
  visitor_id text not null,
  session_id uuid not null,
  request_id uuid not null,
  variant_ids jsonb not null,
  paid boolean not null,
  occurred_at timestamptz not null,
  shopify_updated_at timestamptz not null
);
create index sofie_reco_order_visitor on public.sofie_reco_orders(visitor_id);
alter table public.sofie_reco_orders enable row level security;
revoke all on public.sofie_reco_orders from public, anon, authenticated;
grant select,insert,update,delete on public.sofie_reco_orders to service_role;
