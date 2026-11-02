import { terms } from './reco-intent.mjs';
import { readIdentity } from './reco-identity.mjs';
import { db } from './db.mjs';
import { variant } from './recommender.mjs';
export const accountFrom=ticket=>readIdentity(ticket,process.env.SHOP_DOMAIN,process.env.SUPABASE_SERVICE_ROLE_KEY);
export async function accountSignals(account,store=db,now=Date.now()) {
 if(!account)return {history:[],terms:[],budget:null};
 const cid=encodeURIComponent(account.customerId);
 const [profiles,passports,events]=await Promise.all([
  store('profiles?customer_id=eq.'+cid+'&select=lip_finish_pref,current_products&limit=1'),
  store('beauty_passports?customer_id=eq.'+cid+'&select=data&limit=1'),
  store('customer_events?customer_id=eq.'+cid+'&type=in.(view,purchase)&order=created_at.desc&limit=80')
 ]);
 const p=profiles[0]||{},passport=passports[0]?.data||{};
 const saved=[...(passport.saved||[]),...(passport.routine||[])].slice(0,40);
 const history=saved.filter(x=>variant(String(x.variantId||''))).map(x=>({variant_id:String(x.variantId),event:'save',created_at:new Date(now-86400000).toISOString()}));
 const handles=[],purchasedTitles=[];
 for(const e of events) {
  if(e.type==='view'&&e.product_handle)handles.push(e.product_handle);
  if(e.type==='purchase')for(const item of e.data?.items||[]){
   const id=String(item.variant_id||item.variantId||'').split('/').pop();
   if(variant(id))history.push({variant_id:id,event:'purchase',created_at:e.created_at});
   if(item.handle)handles.push(item.handle);
   if(typeof item.title==='string')purchasedTitles.push(item.title);
  }
 }
 const words=terms([p.lip_finish_pref,passport.preferences?.goal,
  ...(p.current_products||[]).map(x=>x.brand),
  ...saved.map(x=>x.title||''),...purchasedTitles.slice(0,8)].filter(Boolean).join(' '),32);
 const amount=Number(passport.preferences?.budget);
 return {history,terms:words,handles:[...new Set(handles)].slice(0,20),budget:Number.isFinite(amount)&&amount>=100&&amount<=100000?amount:null};
}
