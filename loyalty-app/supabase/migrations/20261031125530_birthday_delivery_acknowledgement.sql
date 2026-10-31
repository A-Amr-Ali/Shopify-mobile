-- Email delivery is independent from annual reward entitlement.
alter table public.birthday_grants add column if not exists email_claimed_at timestamptz;
alter table public.birthday_grants add column if not exists email_last_error text;

create or replace function public.sofie_take_birthday_email(p_id bigint)
returns boolean language plpgsql set search_path = public, pg_temp as $$
begin
  -- A process can terminate after the provider accepted an email. Quarantine
  -- stale claims instead of replaying them outside the provider dedupe window.
  update public.birthday_grants
    set email_status='needs_review',email_last_error='delivery_acknowledgement_unknown'
    where id=p_id and email_status='sending'
      and (email_claimed_at is null or email_claimed_at < now()-interval '15 minutes');
  update public.birthday_grants
    set email_status='failed',email_last_error='delivery_attempts_exhausted'
    where id=p_id and email_status='pending' and email_attempts>=5;
  update public.birthday_grants
    set email_status='sending',email_attempts=email_attempts+1,
        email_claimed_at=now(),email_last_error=null
    where id=p_id and email_status='pending' and email_attempts<5
      and status='available' and expires_at>now();
  return found;
end $$;
revoke all on function public.sofie_take_birthday_email(bigint) from public,anon,authenticated;
grant execute on function public.sofie_take_birthday_email(bigint) to service_role;

-- Keep the ledger's unqualified table references pinned to its intended schema.
alter function public.apply_ledger_entry(text,integer,public.ledger_reason,text,text,text)
  set search_path = public, pg_temp;
alter function public.forbid_mutation() set search_path = public, pg_temp;
