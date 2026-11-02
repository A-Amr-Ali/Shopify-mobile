import { json } from '@remix-run/node';
import { verifyPassportRequest } from '../lib/passport-core.js';
import { issueIdentity } from '../lib/reco-identity.js';
import { supabase } from '../db.server.js';
const reply=(body,status=200)=>json(body,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export const loader=()=>reply({error:'method_not_allowed'},405);
export async function action({request}) {
 if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
 const auth=verifyPassportRequest(request);
 if(!auth.ok||!auth.customerId)return reply({error:'not_logged_in'},401);
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>1000)return reply({error:'invalid_body'},400);
  if(JSON.parse(raw).consent!==true)return reply({error:'consent_required'},400);
  const budget=await supabase.rpc('growth_take_budget',{p_scope:'reco_identity',p_actor:auth.customerId,p_cap:90,p_seconds:3600});
  if(budget.error)return reply({error:'temporarily_unavailable'},503);
  if(!budget.data)return reply({error:'too_many_requests'},429);
  const ticket=issueIdentity(auth.customerId,process.env.SHOP_DOMAIN||'a45545-2.myshopify.com',process.env.SUPABASE_SERVICE_ROLE_KEY);
  return reply({ticket,expiresIn:120});
 }catch{return reply({error:'temporarily_unavailable'},503);}
}
