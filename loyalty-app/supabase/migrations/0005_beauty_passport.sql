begin;
create table if not exists public.beauty_passports (
  customer_id text primary key references public.customers(shopify_customer_id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 32768),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table public.beauty_passports enable row level security;
revoke all on public.beauty_passports from anon, authenticated;
grant all on public.beauty_passports to service_role;
create or replace function public.sofie_save_passport(p_customer_id text, p_expected_version integer, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_row public.beauty_passports;
begin
  if p_customer_id !~ '^gid://shopify/Customer/[0-9]+$' or p_expected_version < 0 then raise exception 'invalid_passport'; end if;
  if p_expected_version = 0 then
    insert into public.beauty_passports(customer_id, data) values(p_customer_id, p_data)
    on conflict(customer_id) do nothing returning * into v_row;
  else
    update public.beauty_passports set data=p_data, version=version+1, updated_at=now()
    where customer_id=p_customer_id and version=p_expected_version returning * into v_row;
  end if;
  if v_row.customer_id is null then
    return jsonb_build_object('ok',false,'version',(select version from public.beauty_passports where customer_id=p_customer_id));
  end if;
  return jsonb_build_object('ok',true,'version',v_row.version,'updatedAt',v_row.updated_at,'passport',v_row.data);
end;
$$;
revoke all on function public.sofie_save_passport(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.sofie_save_passport(text,integer,jsonb) to service_role;
alter table public.growth_events drop constraint if exists growth_events_event_check;
alter table public.growth_events add constraint growth_events_event_check check (event in ('match_complete','product_click','cart_add','qr_scan','journey_view','product_view','cart_view','checkout_start','match_start','passport_save','routine_edit','routine_check','discovery_view'));
commit;
