-- SOFIE operations: backend-only records. No customer contact data is stored.
create table public.procurement_orders (
  order_id text primary key,
  order_name text not null,
  created_at timestamptz not null,
  shopify_updated_at timestamptz not null,
  scanned_at timestamptz not null default now(),
  active boolean not null default true,
  fulfillment_status text not null,
  lines jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb
);
create index procurement_orders_active_idx on public.procurement_orders (created_at) where active;

create table public.procurement_options (
  variant_id text primary key,
  source_override text check (source_override in ('sofie','regular')),
  weight_kg numeric(10,4) check (weight_kg > 0 and weight_kg <= 100),
  updated_at timestamptz not null default now()
);

create table public.procurement_sources (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null,
  region text not null check (region in ('AE','US','UK')),
  retailer text not null,
  url text not null,
  supplier_variant_id text,
  matched_title text not null,
  matched_option text not null,
  exact_match boolean not null default false,
  stock_status text not null check (stock_status in ('in_stock','out_of_stock','unverified','not_found')),
  price numeric(12,2) check (price > 0),
  currency text check (currency in ('AED','USD','GBP')),
  evidence text not null,
  verification_method text not null check (verification_method in ('official_page','official_json','staff_checked')),
  verified_at timestamptz not null,
  checked_at timestamptz not null default now(),
  unique (variant_id, region, url)
);
create index procurement_sources_variant_idx on public.procurement_sources (variant_id, region);

create table public.procurement_purchases (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  order_id text not null references public.procurement_orders(order_id),
  line_id text not null,
  variant_id text not null,
  quantity integer not null check (quantity > 0 and quantity <= 1000),
  source_id uuid references public.procurement_sources(id),
  unit_price numeric(12,2) check (unit_price > 0),
  currency text check (currency in ('AED','USD','GBP')),
  note text not null default '',
  voided_at timestamptz,
  created_at timestamptz not null default now()
);
create index procurement_purchases_order_idx on public.procurement_purchases (order_id, line_id) where voided_at is null;

create table public.procurement_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.procurement_orders enable row level security;
alter table public.procurement_options enable row level security;
alter table public.procurement_sources enable row level security;
alter table public.procurement_purchases enable row level security;
alter table public.procurement_runs enable row level security;
revoke all on public.procurement_orders, public.procurement_options, public.procurement_sources, public.procurement_purchases, public.procurement_runs from public, anon, authenticated;
grant select, insert, update, delete on public.procurement_orders, public.procurement_options, public.procurement_sources, public.procurement_purchases, public.procurement_runs to service_role;

-- Stable lock + compare prevents double-clicks, concurrent purchases, and stale syncs.
create function public.procurement_record_purchase(p_request_id uuid, p_order_id text, p_line_id text, p_variant_id text, p_quantity integer, p_source_id uuid, p_note text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_order public.procurement_orders; v_line jsonb; v_bought integer; v_id uuid; v_source public.procurement_sources;
begin
  select id into v_id from public.procurement_purchases where request_id=p_request_id;
  if v_id is not null then return jsonb_build_object('id',v_id,'duplicate',true); end if;
  select * into v_order from public.procurement_orders where order_id=p_order_id for update;
  select id into v_id from public.procurement_purchases where request_id=p_request_id;
  if v_id is not null then return jsonb_build_object('id',v_id,'duplicate',true); end if;
  if v_order.order_id is null or not v_order.active or v_order.scanned_at < now()-interval '15 minutes' then raise exception 'order_needs_fresh_sync'; end if;
  select x into v_line from jsonb_array_elements(v_order.lines) x where x->>'lineId'=p_line_id and x->>'variantId'=p_variant_id;
  if v_line is null or coalesce((v_line->>'quantity')::integer,0) <= 0 then raise exception 'line_not_open'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  select coalesce(sum(quantity),0) into v_bought from public.procurement_purchases where order_id=p_order_id and line_id=p_line_id and voided_at is null;
  if p_quantity > (v_line->>'quantity')::integer-v_bought then raise exception 'quantity_exceeds_open_demand'; end if;
  if p_source_id is not null then
    select * into v_source from public.procurement_sources where id=p_source_id and variant_id=p_variant_id;
    if not found then raise exception 'invalid_source'; end if;
  end if;
  insert into public.procurement_purchases(request_id,order_id,line_id,variant_id,quantity,source_id,unit_price,currency,note)
  values(p_request_id,p_order_id,p_line_id,p_variant_id,p_quantity,p_source_id,v_source.price,v_source.currency,left(coalesce(p_note,''),500)) returning id into v_id;
  return jsonb_build_object('id',v_id,'duplicate',false);
end; $$;
revoke all on function public.procurement_record_purchase(uuid,text,text,text,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.procurement_record_purchase(uuid,text,text,text,integer,uuid,text) to service_role;
