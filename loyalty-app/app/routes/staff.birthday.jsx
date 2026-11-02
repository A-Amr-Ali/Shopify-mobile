import { supabase } from '../db.server.js';
import { staffReceipt } from '../lib/rewards-core.server.js';
import { rewardsReply,rewardsBody,staffAuthorized } from '../lib/rewards.server.js';

export async function action({ request }) {
  if (request.method!=='POST') return rewardsReply({error:'method_not_allowed'},405);
  try {
    const body=await rewardsBody(request);
    if (!staffAuthorized(body)) return rewardsReply({error:'unauthorized'},401);
    if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(body.customerId || '')) return rewardsReply({error:'bad_customer'},400);
    const {branch,receipt}=staffReceipt(body);
    const preview=await supabase.rpc('sofie_birthday_grant',{p_customer_id:body.customerId});
    if (preview.error) return rewardsReply({error:'birthday_not_available'},409);
    if (!Number.isFinite(Number(body.purchaseTotalEgp)) || Number(body.purchaseTotalEgp)<preview.data.egp_value) return rewardsReply({error:'purchase_too_small'},400);
    const result=await supabase.rpc('sofie_birthday_grant',{p_customer_id:body.customerId,p_channel:'store',p_branch:branch,p_receipt:receipt});
    if (result.error) return rewardsReply({error:'birthday_already_claimed'},409);
    return rewardsReply({ok:true,reference:`SOFIE-BDAY-STORE-${result.data.id}`,egp_value:result.data.egp_value,apply:`${result.data.egp_value} EGP birthday credit on this receipt`,replayed:result.data.replayed===true});
  } catch { return rewardsReply({error:'receipt_required'},400); }
}
