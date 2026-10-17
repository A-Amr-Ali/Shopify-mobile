import { supabase } from '../db.server.js';
import { CRON_KEY, BIRTHDAY } from '../config/loyalty.js';
import { birthdayWindow, cairoDate } from '../lib/rewards-core.js';
import { rewardsReply } from '../lib/rewards.server.js';
import { mailerConfigured, sendEmail } from '../lib/agent/mailer.server.js';
import { renderBirthdayEmail } from '../lib/agent/email.server.js';

export async function action({ request }) {
  if (request.method !== 'POST') return rewardsReply({ error:'method_not_allowed' },405);
  if (!CRON_KEY || request.headers.get('x-cron-key') !== CRON_KEY) return rewardsReply({error:'unauthorized'},401);
  const body=await request.json().catch(()=>({}));
  if (cairoDate().hour<9 && !body.dryRun) return rewardsReply({ok:true,waitingForCairoMorning:true});
  if (!body.dryRun && !mailerConfigured()) return rewardsReply({error:'birthday_mail_provider_unavailable'},503);
  let eligible=0,granted=0,sent=0,failed=0;
  for (let from=0;from<100000;from+=500) {
    const result=await supabase.from('customers').select('shopify_customer_id,email,first_name,tier,birthday,birthday_opt_in').eq('birthday_opt_in',true).not('birthday','is',null).order('shopify_customer_id').range(from,from+499);
    if (result.error) return rewardsReply({error:'temporarily_unavailable'},503);
    for (const c of result.data || []) {
      if (!birthdayWindow(c).eligible) continue;
      eligible++;
      if (body.dryRun) continue;
      const gift=await supabase.rpc('sofie_birthday_grant',{p_customer_id:c.shopify_customer_id});
      if (gift.error) { failed++;continue; }
      granted++;
      if (gift.data.status!=='available') continue;
      if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) continue;
      const claim=await supabase.rpc('sofie_take_birthday_email',{p_id:gift.data.id});
      if (claim.error || !claim.data) continue;
      const html=renderBirthdayEmail({firstName:c.first_name,egp:gift.data.egp_value,note:BIRTHDAY[c.tier]?.note,expiresAt:gift.data.expires_at});
      const email=await sendEmail({to:c.email,subject:'Your SOFIE birthday gift is waiting',html});
      const update=await supabase.from('birthday_grants').update({email_status:email.ok?'sent':'pending',...(email.ok?{emailed_at:new Date().toISOString()}:{})}).eq('id',gift.data.id);
      if (email.ok && !update.error) sent++;else failed++;
    }
    if ((result.data || []).length<500) break;
  }
  return rewardsReply({ok:true,dryRun:body.dryRun===true,eligible,granted,sent,failed});
}
