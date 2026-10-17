import crypto from 'node:crypto';
import { supabase } from '../db.server.js';
import { rewardsReply,rewardsAuth,rewardsBody } from '../lib/rewards.server.js';
import { redemptionByCost } from '../lib/points.server.js';
import { getAdmin } from '../lib/admin.server.js';
import { mintDiscountCode } from '../lib/discounts.server.js';
import { SHOP_DOMAIN,CRON_KEY } from '../config/loyalty.js';

export async function action({request}) {
  if (request.method!=='POST') return rewardsReply({error:'method_not_allowed'},405);
  const auth=rewardsAuth(request);
  if (!auth.ok || !auth.customerId) return rewardsReply({error:'not_logged_in'},401);
  let requestId;
  try {
    const body=await rewardsBody(request);
    requestId=body.requestId || crypto.randomUUID();
    if (!/^[0-9a-f-]{36}$/i.test(requestId)) return rewardsReply({error:'invalid_request'},400);
    const reward=redemptionByCost(Number(body.pointsCost));
    if (!reward) return rewardsReply({error:'invalid_reward'},400);
    if (!CRON_KEY) return rewardsReply({error:'temporarily_unavailable'},503);
    const reserved=await supabase.rpc('sofie_reserve_redemption',{p_customer_id:auth.customerId,p_cost:reward.pointsCost,p_request_key:`${auth.customerId}:${requestId}`});
    if (reserved.error) return rewardsReply({error:reserved.error.message.includes('insufficient_points')?'insufficient_points':'redemption_failed'},409);
    const r=reserved.data;
    if (r.status==='issued' && r.discount_code) return rewardsReply({ok:true,kind:'discount',code:r.discount_code,egp_value:r.egp_value,points_spent:r.points_spent,balance:r.balance,requestId});
    const code='SOFIE-PTS-'+crypto.createHmac('sha256',CRON_KEY).update(`reward:${r.id}`).digest('hex').slice(0,24).toUpperCase();
    const admin=await getAdmin(SHOP_DOMAIN);
    const check=await admin.graphql('query ExistingRewardCode($code:String!){ codeDiscountNodeByCode(code:$code){ id } }',{variables:{code}});
    const data=await check.json();
    if (!check.ok || data.errors) throw new Error('code_unavailable');
    if (!data.data?.codeDiscountNodeByCode) await mintDiscountCode(admin,{amountEgp:reward.egpValue,customerId:auth.customerId,code});
    const saved=await supabase.from('redemptions').update({status:'issued',discount_code:code}).eq('id',r.id);
    if (saved.error) throw new Error('code_unavailable');
    return rewardsReply({ok:true,kind:'discount',code,egp_value:reward.egpValue,points_spent:reward.pointsCost,balance:r.balance,requestId});
  } catch { return rewardsReply({error:'redemption_pending',requestId},503); }
}
