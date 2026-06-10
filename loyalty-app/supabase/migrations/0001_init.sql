-- Sofie's Loyalty — initial schema.
-- Source of truth = append-only points_ledger. customers.points_balance is a
-- cached mirror kept correct by the apply_ledger_entry() function below.
-- Money is stored in whole EGP (integers). Points are integers.

begin;

-- ── enums ───────────────────────────────────────────────────────────────
do $$ begin
  create type loyalty_tier as enum ('insider', 'vip', 'icon');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_reason as enum (
    'purchase', 'review', 'quiz', 'signup', 'referral', 'social',
    'birthday', 'redemption', 'refund_reversal', 'adjustment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type reward_type as enum ('discount', 'product', 'experience');
exception when duplicate_object then null; end $$;

-- ── customers ───────────────────────────────────────────────────────────
create table if not exists customers (
  shopify_customer_id text primary key,        -- Shopify GID, e.g. gid://shopify/Customer/123
  email               text,
  phone               text,
  birthday            date,
  tier                loyalty_tier not null default 'insider',
  lifetime_spend_egp  integer      not null default 0,
  rolling_spend_egp   integer      not null default 0,   -- trailing 12 months
  tier_locked_until   date,                              -- status hold expiry
  points_balance      integer      not null default 0,   -- cached; ledger is truth
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- ── points_ledger (APPEND-ONLY) ─────────────────────────────────────────
create table if not exists points_ledger (
  id              bigserial primary key,
  customer_id     text not null references customers(shopify_customer_id),
  delta           integer not null,                 -- signed
  reason          ledger_reason not null,
  reference_type  text,                              -- 'order' | 'refund' | 'review' | 'redemption' | ...
  reference_id    text,
  balance_after   integer not null,
  idempotency_key text not null,
  created_at      timestamptz not null default now()
);

-- Idempotency: a given key may only ever produce one ledger row.
create unique index if not exists points_ledger_idem_uk on points_ledger (idempotency_key);
create index if not exists points_ledger_customer_idx on points_ledger (customer_id, created_at desc);
create index if not exists points_ledger_ref_idx on points_ledger (reference_type, reference_id);

-- Hard guard: ledger is append-only. Block UPDATE/DELETE at the DB level.
create or replace function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'points_ledger is append-only; use a compensating row';
end $$;

drop trigger if exists points_ledger_no_update on points_ledger;
create trigger points_ledger_no_update before update or delete on points_ledger
  for each row execute function forbid_mutation();

-- ── rewards_catalog ─────────────────────────────────────────────────────
create table if not exists rewards_catalog (
  id           bigserial primary key,
  type         reward_type not null,
  title        text not null,
  points_cost  integer not null,
  egp_value    integer,           -- for type='discount'
  sku          text,              -- for type='product'
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── redemptions ─────────────────────────────────────────────────────────
create table if not exists redemptions (
  id            bigserial primary key,
  customer_id   text not null references customers(shopify_customer_id),
  reward_id     bigint references rewards_catalog(id),
  points_spent  integer not null,
  discount_code text,
  status        text not null default 'issued',   -- issued | used | revoked
  ledger_id     bigint references points_ledger(id),
  created_at    timestamptz not null default now()
);

-- ── profiles (beauty profile) ───────────────────────────────────────────
create table if not exists profiles (
  customer_id        text primary key references customers(shopify_customer_id),
  foundation_shade   text,
  foundation_brand   text,
  highlighter_shade  text,
  lip_shades         text[]  default '{}',
  lip_finish_pref    text,
  skin_type          text,           -- dry | oily | combo | normal | sensitive
  skin_concerns      text[]  default '{}',
  skincare_routine   jsonb   default '{}'::jsonb,   -- {am:[...], pm:[...]}
  current_products   jsonb   default '[]'::jsonb,   -- [{brand,product,shade}]
  undertone          text,           -- warm | cool | neutral
  source             text,           -- quiz | inferred | manual
  updated_at         timestamptz not null default now()
);

-- ── referrals ───────────────────────────────────────────────────────────
create table if not exists referrals (
  id                   bigserial primary key,
  referrer_id          text not null references customers(shopify_customer_id),
  referred_email       text,
  referred_customer_id text,
  status               text not null default 'pending',  -- pending | qualified | rewarded
  created_at           timestamptz not null default now()
);

-- ── atomic ledger application ───────────────────────────────────────────
-- Locks the customer row, enforces idempotency, inserts the ledger row, and
-- updates the cached balance — all in one transaction. Returns the outcome.
-- If the idempotency key already exists, it is a no-op and returns the
-- previously recorded balance (applied = false).
create or replace function apply_ledger_entry(
  p_customer_id    text,
  p_delta          integer,
  p_reason         ledger_reason,
  p_reference_type text,
  p_reference_id   text,
  p_idempotency_key text
) returns table(applied boolean, balance_after integer, ledger_id bigint)
language plpgsql as $$
declare
  v_existing points_ledger%rowtype;
  v_balance  integer;
  v_new_id   bigint;
begin
  -- Idempotency short-circuit.
  select * into v_existing from points_ledger where idempotency_key = p_idempotency_key;
  if found then
    return query select false, v_existing.balance_after, v_existing.id;
    return;
  end if;

  -- Lock the customer row so concurrent webhooks can't race the balance.
  select points_balance into v_balance from customers
    where shopify_customer_id = p_customer_id for update;
  if not found then
    raise exception 'unknown customer %', p_customer_id;
  end if;

  v_balance := v_balance + p_delta;
  if v_balance < 0 then
    raise exception 'insufficient_points: balance would go negative (%).', v_balance;
  end if;

  insert into points_ledger
    (customer_id, delta, reason, reference_type, reference_id, balance_after, idempotency_key)
  values
    (p_customer_id, p_delta, p_reason, p_reference_type, p_reference_id, v_balance, p_idempotency_key)
  returning id into v_new_id;

  update customers
    set points_balance = v_balance, updated_at = now()
    where shopify_customer_id = p_customer_id;

  return query select true, v_balance, v_new_id;
end $$;

-- ── seed the default reward catalog (non-linear redemption tiers) ────────
insert into rewards_catalog (type, title, points_cost, egp_value, active)
values
  ('discount', '50 EGP off',    100,   50, true),
  ('discount', '250 EGP off',   500,  250, true),
  ('discount', '550 EGP off',  1000,  550, true),
  ('discount', '1,200 EGP off',2000, 1200, true)
on conflict do nothing;

commit;
