import { supabase } from '../db.server.js';
import { staffReceipt } from '../lib/rewards-core.server.js';
import { rewardsReply, rewardsBody, staffAuthorized } from '../lib/rewards.server.js';
import { redemptionByCost } from '../lib/points.server.js';

export async function action({ request }) {
  if (request.method !== 'POST') return rewardsReply({ error:'method_not_allowed' },405);
  try {
    const body = await rewardsBody(request);
    if (!staffAuthorized(body)) return rewardsReply({ error:'unauthorized' },401);
    if (!/^gid:\/\/shopify\/Customer\/\d+$/.test(body.customerId || '')) return rewardsReply({ error:'bad_customer' },400);
    const { branch, receipt } = staffReceipt(body);
    const reward = redemptionByCost(Number(body.pointsCost));
    if (!reward) return rewardsReply({ error:'invalid_reward' },400);
    if (!Number.isFinite(Number(body.purchaseTotalEgp)) || Number(body.purchaseTotalEgp)<reward.egpValue) return rewardsReply({ error:'purchase_too_small' },400);
    const result = await supabase.rpc('sofie_staff_redeem', { p_customer_id:body.customerId,p_cost:reward.pointsCost,p_branch:branch,p_receipt:receipt });
    if (result.error) return rewardsReply({ error: result.error.message.includes('insufficient_points') ? 'insufficient_points' : result.error.message.includes('receipt_already_used') ? 'receipt_already_used' : 'redeem_failed' },409);
    return rewardsReply({ ...result.data, apply:`${reward.egpValue} EGP off this receipt` });
  } catch { return rewardsReply({ error:'receipt_required' },400); }
}
