begin;
alter table public.customers add column if not exists birthday_opt_in boolean not null default false;
alter table public.customers add column if not exists birthday_consent_at timestamptz;
alter table public.customers add column if not exists birthday_saved_at timestamptz;
alter table public.birthday_grants add column if not exists status text not null default 'available';
alter table public.birthday_grants add column if not exists channel text;
alter table public.birthday_grants add column if not exists expires_at timestamptz;
alter table public.birthday_grants add column if not exists claimed_at timestamptz;
alter table public.birthday_grants add column if not exists branch text;
alter table public.birthday_grants add column if not exists receipt_number text;
alter table public.birthday_grants add column if not exists email_status text not null default 'pending';
alter table public.birthday_grants add column if not exists email_attempts integer not null default 0;
alter table public.birthday_grants add column if not exists emailed_at timestamptz;
alter table public.redemptions add column if not exists channel text not null default 'online';
alter table public.redemptions add column if not exists branch text;
alter table public.redemptions add column if not exists receipt_number text;
alter table public.redemptions add column if not exists egp_value integer;
alter table public.redemptions add column if not exists request_key text;
create unique index if not exists redemptions_request_key_uk on public.redemptions(request_key) where request_key is not null;
create unique index if not exists redemptions_store_receipt_uk on public.redemptions(lower(branch),lower(receipt_number)) where channel='store';
update public.redemptions set channel='store' where discount_code like 'SOFIE-REDEEM-%';
alter table public.customers enable row level security;
alter table public.birthday_grants enable row level security;
alter table public.redemptions enable row level security;

create or replace function public.sofie_save_birthday(p_customer_id text,p_birthday date,p_consent boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.customers%rowtype;
begin
  insert into public.customers(shopify_customer_id) values(p_customer_id) on conflict do nothing;
  select * into c from public.customers where shopify_customer_id=p_customer_id for update;
  if p_consent then
    if p_birthday is null or extract(year from p_birthday)<>2000 then raise exception 'invalid_birthday'; end if;
    if c.birthday is not null and to_char(c.birthday,'MM-DD')<>to_char(p_birthday,'MM-DD') then raise exception 'birthday_locked'; end if;
    update public.customers set birthday=p_birthday,birthday_opt_in=true,birthday_consent_at=now(),birthday_saved_at=coalesce(birthday_saved_at,now()) where shopify_customer_id=p_customer_id;
  else
    update public.customers set birthday_opt_in=false where shopify_customer_id=p_customer_id;
  end if;
  return jsonb_build_object('ok',true,'birthday',coalesce(p_birthday,c.birthday),'optIn',p_consent);
end $$;
revoke all on function public.sofie_save_birthday(text,date,boolean) from public,anon,authenticated;
grant execute on function public.sofie_save_birthday(text,date,boolean) to service_role;

create or replace function public.sofie_birthday_grant(p_customer_id text,p_channel text default null,p_branch text default null,p_receipt text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.customers%rowtype; g public.birthday_grants%rowtype; today date:=(now() at time zone 'Africa/Cairo')::date; bd date; yr integer; m integer; d integer; value integer;
begin
  if p_channel='store' then
    perform pg_advisory_xact_lock(hashtextextended('sofie-receipt:'||lower(p_branch)||':'||lower(p_receipt),0));
    if exists(select 1 from public.redemptions where channel='store' and lower(branch)=lower(p_branch) and lower(receipt_number)=lower(p_receipt) and status='issued') then raise exception 'receipt_already_used'; end if;
  end if;
  select * into c from public.customers where shopify_customer_id=p_customer_id for update;
  if not found or c.birthday is null or not c.birthday_opt_in then raise exception 'birthday_not_enrolled'; end if;
  m:=extract(month from c.birthday); d:=extract(day from c.birthday); yr:=extract(year from today);
  bd:=make_date(yr,m,least(d,extract(day from (make_date(yr,m,1)+interval '1 month - 1 day'))::int));
  if today<bd then
    yr:=yr-1;
    bd:=make_date(yr,m,least(d,extract(day from (make_date(yr,m,1)+interval '1 month - 1 day'))::int));
  end if;
  if today<bd or today>=bd+45 then raise exception 'birthday_not_available'; end if;
  value:=case c.tier::text when 'icon' then 750 when 'vip' then 300 else 50 end;
  insert into public.birthday_grants(customer_id,year,tier,egp_value,expires_at)
    values(p_customer_id,yr,c.tier,value,(bd+45)::timestamp at time zone 'Africa/Cairo') on conflict(customer_id,year) do nothing;
  select * into g from public.birthday_grants where customer_id=p_customer_id and year=yr for update;
  if g.expires_at<now() then raise exception 'birthday_expired'; end if;
  if p_channel is not null then
    if p_channel not in ('online','store') then raise exception 'invalid_channel'; end if;
    if p_channel='store' and (coalesce(length(trim(p_branch)),0)=0 or coalesce(length(trim(p_receipt)),0)=0) then raise exception 'receipt_required'; end if;
    if g.status='available' then
      update public.birthday_grants set channel=p_channel,status=case when p_channel='online' then 'processing_online' else 'issued_store' end,
        claimed_at=now(),branch=p_branch,receipt_number=p_receipt where id=g.id returning * into g;
    elsif g.status='used_online' then raise exception 'birthday_already_claimed';
    elsif not (g.channel='online' and p_channel='online') then
      if g.channel='store' and p_channel='store' and g.branch=p_branch and g.receipt_number=p_receipt then
        return to_jsonb(g)||jsonb_build_object('ok',true,'replayed',true);
      end if;
      raise exception 'birthday_already_claimed';
    end if;
  end if;
  return to_jsonb(g)||jsonb_build_object('ok',true);
end $$;
revoke all on function public.sofie_birthday_grant(text,text,text,text) from public,anon,authenticated;
grant execute on function public.sofie_birthday_grant(text,text,text,text) to service_role;

create or replace function public.sofie_staff_redeem(p_customer_id text,p_cost integer,p_branch text,p_receipt text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.redemptions%rowtype; entry record; val integer;
begin
  if length(trim(p_branch)) not between 1 and 60 or length(p_receipt) not between 1 and 80 then raise exception 'receipt_required'; end if;
  val:=case p_cost when 100 then 50 when 500 then 250 when 1000 then 550 when 2000 then 1200 else null end;
  if val is null then raise exception 'invalid_reward'; end if;
  perform pg_advisory_xact_lock(hashtextextended('sofie-receipt:'||lower(p_branch)||':'||lower(p_receipt),0));
  if exists(select 1 from public.birthday_grants where channel='store' and lower(branch)=lower(p_branch) and lower(receipt_number)=lower(p_receipt) and status='issued_store') then raise exception 'receipt_already_used'; end if;
  select * into r from public.redemptions where channel='store' and lower(branch)=lower(p_branch) and lower(receipt_number)=lower(p_receipt);
  if found then
    if r.customer_id<>p_customer_id or r.points_spent<>p_cost then raise exception 'receipt_already_used'; end if;
    return jsonb_build_object('ok',true,'reference',r.discount_code,'egp_value',r.egp_value,'points_spent',r.points_spent,'balance',(select points_balance from public.customers where shopify_customer_id=p_customer_id),'replayed',true);
  end if;
  insert into public.redemptions(customer_id,points_spent,status,channel,branch,receipt_number,egp_value)
    values(p_customer_id,p_cost,'pending','store',p_branch,p_receipt,val) returning * into r;
  select * into entry from public.apply_ledger_entry(p_customer_id,-p_cost,'redemption','redemption',r.id::text,'redemption:'||r.id);
  update public.redemptions set status='issued',discount_code='SOFIE-STORE-'||r.id,ledger_id=entry.ledger_id where id=r.id;
  return jsonb_build_object('ok',true,'reference','SOFIE-STORE-'||r.id,'egp_value',val,'points_spent',p_cost,'balance',entry.balance_after,'replayed',false);
end $$;
revoke all on function public.sofie_staff_redeem(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.sofie_staff_redeem(text,integer,text,text) to service_role;

create or replace function public.sofie_take_birthday_email(p_id bigint)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  update public.birthday_grants set email_status='sending',email_attempts=email_attempts+1 where id=p_id and email_status='pending' and email_attempts<5;
  return found;
end $$;
revoke all on function public.sofie_take_birthday_email(bigint) from public,anon,authenticated;
grant execute on function public.sofie_take_birthday_email(bigint) to service_role;
create or replace function public.sofie_reserve_redemption(p_customer_id text,p_cost integer,p_request_key text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.redemptions%rowtype; entry record; val integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('sofie-online:'||p_request_key,0));
  select * into r from public.redemptions where request_key=p_request_key;
  if found then
    if r.customer_id<>p_customer_id or r.points_spent<>p_cost then raise exception 'request_conflict'; end if;
    return to_jsonb(r)||jsonb_build_object('ok',true,'balance',(select points_balance from public.customers where shopify_customer_id=p_customer_id));
  end if;
  val:=case p_cost when 100 then 50 when 500 then 250 when 1000 then 550 when 2000 then 1200 else null end;
  if val is null then raise exception 'invalid_reward'; end if;
  insert into public.redemptions(customer_id,points_spent,status,channel,egp_value,request_key)
    values(p_customer_id,p_cost,'pending','online',val,p_request_key) returning * into r;
  select * into entry from public.apply_ledger_entry(p_customer_id,-p_cost,'redemption','redemption',r.id::text,'redemption:'||r.id);
  update public.redemptions set ledger_id=entry.ledger_id where id=r.id returning * into r;
  return to_jsonb(r)||jsonb_build_object('ok',true,'balance',entry.balance_after);
end $$;
revoke all on function public.sofie_reserve_redemption(text,integer,text) from public,anon,authenticated;
grant execute on function public.sofie_reserve_redemption(text,integer,text) to service_role;

create or replace function public.sofie_staff_award(p_customer_id text,p_amount integer,p_branch text,p_receipt text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.customers%rowtype; prior public.points_ledger%rowtype; entry record; mult numeric; pts integer; tier_name text; ref text;
begin
  if p_amount not between 1 and 10000000 or length(trim(p_branch)) not between 1 and 60 or length(p_receipt) not between 1 and 80 then raise exception 'bad_input'; end if;
  ref:=lower(p_branch)||':'||lower(p_receipt);
  perform pg_advisory_xact_lock(hashtextextended('sofie-award:'||ref,0));
  select * into prior from public.points_ledger where idempotency_key='staff:receipt:'||ref;
  if found then
    if prior.customer_id<>p_customer_id or prior.reference_id<>ref||':'||p_amount then raise exception 'receipt_already_used'; end if;
    return jsonb_build_object('ok',true,'awarded',prior.delta,'balance',(select points_balance from public.customers where shopify_customer_id=p_customer_id),'tier',(select tier from public.customers where shopify_customer_id=p_customer_id),'replayed',true);
  end if;
  select * into c from public.customers where shopify_customer_id=p_customer_id for update;
  if not found then raise exception 'bad_customer'; end if;
  mult:=case c.tier::text when 'icon' then 1.5 when 'vip' then 1.25 else 1 end;
  if c.tier::text<>'insider' and c.birthday_opt_in and extract(month from c.birthday)=extract(month from now() at time zone 'Africa/Cairo') then mult:=mult*2; end if;
  pts:=floor(floor(p_amount/10.0)*mult);
  if pts<=0 then raise exception 'zero_points'; end if;
  select * into entry from public.apply_ledger_entry(p_customer_id,pts,'purchase','pos_manual',ref||':'||p_amount,'staff:receipt:'||ref);
  tier_name:=case when c.rolling_spend_egp+p_amount>=120000 then 'icon' when c.rolling_spend_egp+p_amount>=40000 then 'vip' else 'insider' end;
  if c.tier::text='icon' or (c.tier::text='vip' and tier_name='insider') then tier_name:=c.tier::text; end if;
  update public.customers set lifetime_spend_egp=lifetime_spend_egp+p_amount,rolling_spend_egp=rolling_spend_egp+p_amount,tier=tier_name::public.loyalty_tier,
    tier_locked_until=greatest(coalesce(tier_locked_until,current_date),current_date+365),updated_at=now() where shopify_customer_id=p_customer_id;
  return jsonb_build_object('ok',true,'awarded',pts,'balance',entry.balance_after,'tier',tier_name,'replayed',false);
end $$;
revoke all on function public.sofie_staff_award(text,integer,text,text) from public,anon,authenticated;
grant execute on function public.sofie_staff_award(text,integer,text,text) to service_role;
commit;
