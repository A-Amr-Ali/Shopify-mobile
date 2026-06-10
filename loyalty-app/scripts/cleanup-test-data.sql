-- Remove rows created by scripts/verify-lifecycle.js (all keyed to TEST-* ids).
-- The points_ledger is append-only (a trigger blocks DELETE), so we disable that
-- trigger for the length of this transaction only. Run in the Supabase SQL editor.
begin;

alter table points_ledger disable trigger points_ledger_no_update;

delete from points_ledger   where customer_id   like 'gid://shopify/Customer/TEST-%';
delete from redemptions     where customer_id   like 'gid://shopify/Customer/TEST-%';
delete from referrals       where referrer_id   like 'gid://shopify/Customer/TEST-%'
                               or referred_customer_id like 'gid://shopify/Customer/TEST-%';
delete from social_grants   where customer_id   like 'gid://shopify/Customer/TEST-%';
delete from birthday_grants where customer_id   like 'gid://shopify/Customer/TEST-%';
delete from profiles        where customer_id   like 'gid://shopify/Customer/TEST-%';
delete from customers       where shopify_customer_id like 'gid://shopify/Customer/TEST-%';

alter table points_ledger enable trigger points_ledger_no_update;

commit;
