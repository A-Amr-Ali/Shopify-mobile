begin;
create table if not exists public.growth_campaigns (
 id text primary key, title text not null, starts_on date not null, ends_on date not null,
 state text not null default 'building', config jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.growth_content (
 id text primary key, campaign_id text references public.growth_campaigns(id), title text not null, goal text not null,
 channel text not null default 'instagram', format text not null, pillar text not null, scheduled_for timestamptz not null,
 status text not null default 'draft', hook_ar text not null, script_ar text not null, caption_ar text not null,
 landing_url text not null, product_handles jsonb not null default '[]'::jsonb, variant_ids jsonb not null default '[]'::jsonb,
 asset_url text, asset_status text not null default 'missing', publish_id text, publish_container_id text, blocker text,
 metadata jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists growth_content_queue on public.growth_content (status, scheduled_for);
create table if not exists public.growth_events (
 id uuid primary key default gen_random_uuid(), event_id uuid not null unique, session_id uuid not null,
 event text not null check (event in ('match_complete','product_click','cart_add','qr_scan')),
 goal text, content_id text, campaign text, source text, variant_ids jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists growth_events_created on public.growth_events (created_at);
create table if not exists public.growth_orders (
 order_id text primary key, campaign text, content_id text, session_id text, financial_status text,
 fulfillment_status text, currency text, net_value numeric(14,2) not null default 0,
 delivered_at timestamptz, cancelled_at timestamptz, shopify_updated_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.growth_runs (
 id uuid primary key default gen_random_uuid(), kind text not null, summary jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.growth_trends (
 id text primary key, title text not null, signal_kind text not null, evidence_urls jsonb not null,
 observed_at timestamptz not null default now(), product_handles jsonb not null default '[]'::jsonb,
 confidence text not null default 'candidate', egypt_fit text, notes text
);
create table if not exists public.growth_rate_limits (
 scope text not null, actor text not null, bucket timestamptz not null, hits integer not null,
 primary key (scope,actor,bucket)
);
alter table public.growth_campaigns enable row level security;
alter table public.growth_content enable row level security;
alter table public.growth_events enable row level security;
alter table public.growth_orders enable row level security;
alter table public.growth_runs enable row level security;
alter table public.growth_trends enable row level security;
alter table public.growth_rate_limits enable row level security;
revoke all on public.growth_campaigns, public.growth_content, public.growth_events, public.growth_orders, public.growth_runs, public.growth_trends, public.growth_rate_limits from anon, authenticated;
grant all on public.growth_campaigns, public.growth_content, public.growth_events, public.growth_orders, public.growth_runs, public.growth_trends, public.growth_rate_limits to service_role;
create or replace function public.growth_take_budget(p_scope text,p_actor text,p_cap integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_bucket timestamptz; v_hits integer;
begin
 if p_cap < 1 or p_cap > 100000 or p_seconds < 60 or p_seconds > 86400 or length(p_actor)>100 or length(p_scope)>50 then return false; end if;
 v_bucket := to_timestamp(floor(extract(epoch from now()) / p_seconds) * p_seconds);
 insert into public.growth_rate_limits(scope,actor,bucket,hits) values(p_scope,p_actor,v_bucket,1)
 on conflict(scope,actor,bucket) do update set hits=public.growth_rate_limits.hits+1 returning hits into v_hits;
 return v_hits <= p_cap;
end;
$$;
revoke all on function public.growth_take_budget(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.growth_take_budget(text,text,integer,integer) to service_role;
create or replace function public.growth_claim_publish()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.growth_content;
begin
 select * into v_row from public.growth_content
 where status='ready' and scheduled_for<=now() and scheduled_for>now()-interval '12 hours'
 and asset_url is not null and asset_status='ready'
 and coalesce((metadata->>'claims_checked')::boolean,false)
 and (metadata->>'stock_verified_at')::timestamptz > now()-interval '1 hour'
 and coalesce(metadata->>'stock_verification','')='shopify_inventory'
 and (coalesce((metadata->>'ai_character')::boolean,false)=false or coalesce((metadata->>'ai_disclosed')::boolean,false))
 and publish_id is null and publish_container_id is null
 order by scheduled_for for update skip locked limit 1;
 if not found then return null; end if;
 update public.growth_content set status='publishing',updated_at=now() where id=v_row.id;
 return to_jsonb(v_row);
end;
$$;
revoke all on function public.growth_claim_publish() from public, anon, authenticated;
grant execute on function public.growth_claim_publish() to service_role;
insert into public.growth_campaigns(id,title,starts_on,ends_on,state,config)
values('sofie_knows_q4_2026','SOFIE Knows Your Beauty','2026-10-13','2027-01-12','building',
 '{"locale":"ar-EG","timezone":"Africa/Cairo","auto_publish":false,"ad_spend_authorized":false}'::jsonb)
on conflict(id) do nothing;
commit;
