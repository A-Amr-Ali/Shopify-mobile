alter table public.sofie_reco_events add column if not exists subject_id text check(subject_id ~ '^[a-f0-9]{64}$');
alter table public.sofie_reco_events add column if not exists features jsonb;
alter table public.sofie_reco_events add column if not exists source text;
alter table public.sofie_reco_events add column if not exists campaign text;
alter table public.sofie_reco_orders add column if not exists subject_id text;
create index if not exists sofie_reco_subject_time on public.sofie_reco_events(subject_id,created_at desc) where subject_id is not null;
create index if not exists sofie_reco_orders_subject on public.sofie_reco_orders(subject_id) where subject_id is not null;
create table public.sofie_reco_catalog (
 id text primary key check(id='active'),payload jsonb not null,updated_at timestamptz not null default now()
);
alter table public.sofie_reco_catalog enable row level security;
revoke all on public.sofie_reco_catalog from public,anon,authenticated;
grant select,insert,update,delete on public.sofie_reco_catalog to service_role;
create table public.sofie_reco_campaigns (
 id text primary key check(id ~ '^[a-z0-9_-]{1,100}$'),
 source text not null check(source in ('google','meta','instagram','tiktok','youtube','klaviyo','other')),
 terms jsonb not null check(jsonb_typeof(terms)='array' and jsonb_array_length(terms)<=20),
 active boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.sofie_reco_campaigns enable row level security;
revoke all on public.sofie_reco_campaigns from public,anon,authenticated;
grant select,insert,update,delete on public.sofie_reco_campaigns to service_role;
