import { supabase } from '../db.server.js';
import { CRON_KEY, BIRTHDAY } from '../config/loyalty.js';
import { birthdayWindow, cairoDate } from '../lib/rewards-core.server.js';
import { rewardsReply } from '../lib/rewards.server.js';
import { mailerConfigured, sendEmail } from '../lib/agent/mailer.server.js';
import { renderBirthdayEmail } from '../lib/agent/email.server.js';
import { deliverBirthdayGift } from '../lib/birthday-delivery.server.js';

export async function action({ request }) {
  if (request.method !== 'POST') return rewardsReply({ error:'method_not_allowed' },405);
  if (!CRON_KEY || request.headers.get('x-cron-key') !== CRON_KEY) return rewardsReply({error:'unauthorized'},401);
  const parsed=await request.json().catch(()=>({}));
  const body=parsed && typeof parsed==='object' && !Array.isArray(parsed) ? parsed : {};
  if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') return rewardsReply({error:'invalid_dry_run'},400);
  const dryRun=body.dryRun===true;
  if (cairoDate().hour<9 && !dryRun) return rewardsReply({ok:true,waitingForCairoMorning:true});
  if (!dryRun && !mailerConfigured()) return rewardsReply({error:'birthday_mail_provider_unavailable'},503);
  let eligible=0,granted=0,sent=0,failed=0;
  for (let from=0;from<100000;from+=500) {
    const result=await supabase.from('customers').select('shopify_customer_id,email,first_name,tier,birthday,birthday_opt_in').eq('birthday_opt_in',true).not('birthday','is',null).order('shopify_customer_id').range(from,from+499);
    if (result.error) return rewardsReply({error:'temporarily_unavailable'},503);
    for (const c of result.data || []) {
      if (!birthdayWindow(c).eligible) continue;
      eligible++;
      if (dryRun) continue;
      const gift=await supabase.rpc('sofie_birthday_grant',{p_customer_id:c.shopify_customer_id});
      if (gift.error || !gift.data?.id) { failed++;continue; }
      granted++;
      if (gift.data.status!=='available') continue;
      if (!c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) continue;
      const delivery=await deliverBirthdayGift({db:supabase,gift:gift.data,customer:c,note:BIRTHDAY[c.tier]?.note,render:renderBirthdayEmail,send:sendEmail});
      if (delivery.outcome==='sent') sent++;
      if (delivery.outcome==='failed') failed++;
    }
    if ((result.data || []).length<500) break;
  }
  return rewardsReply({ok:failed===0,dryRun,eligible,granted,sent,failed},failed ? 503 : 200);
}
