import { supabase } from '../db.server.js';
import { rewardsReply, rewardsAuth } from '../lib/rewards.server.js';
import { rewardsRules, birthdayWindow } from '../lib/rewards-core.js';
import { tierProgress } from '../lib/tier.server.js';

export async function loader({ request }) {
  const auth = rewardsAuth(request);
  if (!auth.ok) return rewardsReply({ error: 'unauthorized' }, 401);
  if (!auth.customerId) return rewardsReply({ loggedIn: false, rules: rewardsRules(null) });
  const result = await supabase.from('customers').select('tier,points_balance,rolling_spend_egp,birthday,birthday_opt_in,birthday_consent_at').eq('shopify_customer_id', auth.customerId).maybeSingle();
  if (result.error) return rewardsReply({ error: 'temporarily_unavailable' }, 503);
  const c = result.data;
  const rules = rewardsRules(c);
  if (new URL(request.url).searchParams.get('view') === 'estimate') return rewardsReply({ loggedIn: true, tier: c?.tier || 'insider', rules });
  const [ledger, redemptions, birthday] = await Promise.all([
    supabase.from('points_ledger').select('delta,reason,created_at,balance_after').eq('customer_id', auth.customerId).order('id', { ascending: false }).limit(15),
    supabase.from('redemptions').select('id,points_spent,discount_code,status,channel,egp_value,request_key,created_at').eq('customer_id', auth.customerId).in('status',['issued','pending']).order('id', { ascending: false }).limit(15),
    supabase.from('birthday_grants').select('year,egp_value,code,status,channel,expires_at').eq('customer_id', auth.customerId).order('year', { ascending: false }).limit(1)
  ]);
  if (ledger.error || redemptions.error || birthday.error) return rewardsReply({ error: 'temporarily_unavailable' }, 503);
  return rewardsReply({ loggedIn: true, memberId: auth.customerId.split('/').pop(), balance: c?.points_balance || 0, tier: c?.tier || 'insider', rules, progress: tierProgress(c?.rolling_spend_egp || 0), birthday: c?.birthday?.slice(5) || null, birthdayOptIn: c?.birthday_opt_in || false, birthdayWindow: birthdayWindow(c), birthdayGrant: birthday.data?.[0] || null, activity: ledger.data || [], redemptions: redemptions.data || [] });
}
