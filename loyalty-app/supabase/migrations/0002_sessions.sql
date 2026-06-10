-- Shopify OAuth session storage (offline + online tokens). The loyalty app is
-- an OAuth app, so tokens must persist across restarts — Railway containers are
-- ephemeral. One row per Shopify session id.
begin;

create table if not exists shopify_sessions (
  id           text primary key,
  shop         text not null,
  state        text,
  is_online    boolean not null default false,
  scope        text,
  expires      timestamptz,
  access_token text,
  data         jsonb not null,        -- full Session.toObject() for faithful reload
  updated_at   timestamptz not null default now()
);

create index if not exists shopify_sessions_shop_idx on shopify_sessions (shop);

commit;
