import { supabase } from '../db.server.js';
import { staffReceipt } from '../lib/rewards-core.server.js';
import { rewardsReply,rewardsBody,staffAuthorized } from '../lib/rewards.server.js';
import { getAdmin } from '../lib/admin.server.js';
import { mirrorCustomer } from '../lib/metafields.server.js';
import { SHOP_DOMAIN } from '../config/loyalty.js';

export async function action({request}) {
  if (request.method!=='POST') return rewardsReply({error:'method_not_allowed'},405);
  try {
    const body=await rewardsBody(request);
    if (!staffAuthorized(body)) return rewardsReply({error:'unauthorized'},401);
    if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(body.customerId || '')) return rewardsReply({error:'bad_customer'},400);
    const {branch,receipt}=staffReceipt(body);
    const amount=Math.round(Number(body.amountEgp));
    if (!Number.isSafeInteger(amount)||amount<1||amount>10000000) return rewardsReply({error:'bad_amount'},400);
    const result=await supabase.rpc('sofie_staff_award',{p_customer_id:body.customerId,p_amount:amount,p_branch:branch,p_receipt:receipt});
    if (result.error) return rewardsReply({error:result.error.message.includes('receipt_already_used')?'receipt_already_used':'award_failed'},409);
    if (!result.data.replayed) {
      try {
        const c=await supabase.from('customers').select('lifetime_spend_egp').eq('shopify_customer_id',body.customerId).single();
        await mirrorCustomer(await getAdmin(SHOP_DOMAIN),body.customerId,{points:result.data.balance,tier:result.data.tier,spend:c.data.lifetime_spend_egp});
      } catch { console.warn('staff_award_mirror_unavailable'); }
    }
    return rewardsReply(result.data);
  } catch {return rewardsReply({error:'receipt_required'},400);}
}
