import { getAdmin } from '../lib/admin.server.js';
import { supabase } from '../db.server.js';
import { rewardsReply,rewardsBody,staffAuthorized } from '../lib/rewards.server.js';
import { birthdayWindow,rewardsRules } from '../lib/rewards-core.server.js';
import { SHOP_DOMAIN } from '../config/loyalty.js';

export async function action({request}) {
  if (request.method!=='POST') return rewardsReply({error:'method_not_allowed'},405);
  try {
    const body=await rewardsBody(request);
    if (!staffAuthorized(body)) return rewardsReply({error:'unauthorized'},401);
    const identity=String(body.identity||body.email||'').trim().toLowerCase();
    const numeric=/^\d{1,20}$/.test(identity);
    if (!numeric && !/^[^\s@"\\]+@[^\s@"\\]+\.[^\s@"\\]+$/.test(identity)) return rewardsReply({error:'bad_identity'},400);
    const admin=await getAdmin(SHOP_DOMAIN);
    const response=numeric
      ? await admin.graphql('query StoreRewardMember($id:ID!){customer(id:$id){id firstName lastName email}}',{variables:{id:`gid://shopify/Customer/${identity}`}})
      : await admin.graphql('query StoreRewardEmail($q:String!){customers(first:2,query:$q){nodes{id firstName lastName email} pageInfo{hasNextPage endCursor}}}',{variables:{q:`email:"${identity}"`}});
    const data=await response.json();
    if (!response.ok || data.errors) throw new Error('lookup_failed');
    const customer=numeric?data.data?.customer:data.data?.customers?.nodes?.find(c=>c.email?.toLowerCase()===identity);
    if (!customer) return rewardsReply({found:false});
    const saved=await supabase.from('customers').upsert({shopify_customer_id:customer.id,email:customer.email,first_name:customer.firstName},{onConflict:'shopify_customer_id'});
    if (saved.error) throw new Error('save_failed');
    const [result,gift]=await Promise.all([
      supabase.from('customers').select('tier,points_balance,lifetime_spend_egp,birthday,birthday_opt_in').eq('shopify_customer_id',customer.id).single(),
      supabase.from('birthday_grants').select('year,status,channel,egp_value').eq('customer_id',customer.id).order('year',{ascending:false}).limit(1)
    ]);
    if (result.error||gift.error) throw new Error('lookup_failed');
    const rules=rewardsRules(result.data);
    const window=birthdayWindow(result.data);
    const grant=gift.data?.find(g=>g.year===window.year)||null;
    return rewardsReply({found:true,customerId:customer.id,memberId:customer.id.split('/').pop(),name:[customer.firstName,customer.lastName].filter(Boolean).join(' ')||customer.email,email:customer.email,points:result.data.points_balance,tier:result.data.tier,lifetime:result.data.lifetime_spend_egp,rewards:rules.rewards,multiplier:rules.multiplier,birthday:{enrolled:result.data.birthday_opt_in,date:result.data.birthday?.slice(5)||null,eligible:window.eligible && (!grant||grant.status==='available'),value:grant?.egp_value||rules.birthdayValues[result.data.tier],status:grant?.status||null}});
  } catch {return rewardsReply({error:'lookup_failed'},503);}
}
