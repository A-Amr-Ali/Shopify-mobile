import crypto from 'node:crypto';
import { supabase } from '../db.server.js';
import { normalizeBirthday } from '../lib/rewards-core.js';
import { rewardsReply, rewardsAuth, rewardsBody, syncRewardCustomer } from '../lib/rewards.server.js';
import { getAdmin } from '../lib/admin.server.js';
import { mintDiscountCode } from '../lib/discounts.server.js';
import { SHOP_DOMAIN, CRON_KEY } from '../config/loyalty.js';

export async function action({ request }) {
  if (request.method !== 'POST') return rewardsReply({ error: 'method_not_allowed' }, 405);
  const auth = rewardsAuth(request);
  if (!auth.ok || !auth.customerId) return rewardsReply({ error: 'not_logged_in' }, 401);
  try {
    const body = await rewardsBody(request);
    if (body.action === 'claim_online') {
      const result = await supabase.rpc('sofie_birthday_grant', { p_customer_id: auth.customerId, p_channel: 'online' });
      if (result.error) return rewardsReply({ error: result.error.message.includes('already_claimed') ? 'birthday_already_claimed' : 'birthday_not_available' }, 409);
      const grant = result.data;
      if (grant.status === 'issued_online' && grant.code) return rewardsReply({ ok: true, code: grant.code, egp: grant.egp_value, expiresAt: grant.expires_at });
      if (!CRON_KEY) throw new Error('configuration_unavailable');
      const code = 'SOFIE-BDAY-' + crypto.createHmac('sha256', CRON_KEY).update(`${auth.customerId}:${grant.year}`).digest('hex').slice(0, 24).toUpperCase();
      const admin = await getAdmin(SHOP_DOMAIN);
      const existing = await admin.graphql('query BirthdayCode($code:String!){ codeDiscountNodeByCode(code:$code){ id } }', { variables: { code } });
      const data = await existing.json();
      if (!existing.ok || data.errors) throw new Error('code_unavailable');
      if (!data.data?.codeDiscountNodeByCode) await mintDiscountCode(admin, { amountEgp: grant.egp_value, customerId: auth.customerId, code, endsAt: grant.expires_at });
      const saved = await supabase.from('birthday_grants').update({ code, status: 'issued_online' }).eq('id', grant.id).eq('channel', 'online');
      if (saved.error) throw new Error('code_unavailable');
      return rewardsReply({ ok: true, code, egp: grant.egp_value, expiresAt: grant.expires_at });
    }
    if (body.consent !== true && body.action !== 'opt_out') return rewardsReply({ error: 'consent_required' }, 400);
    const birthday = body.action === 'opt_out' ? null : normalizeBirthday(body);
    if (birthday) await syncRewardCustomer(auth.customerId);
    const saved = await supabase.rpc('sofie_save_birthday', { p_customer_id: auth.customerId, p_birthday: birthday, p_consent: body.action !== 'opt_out' });
    if (saved.error) return rewardsReply({ error: saved.error.message.includes('birthday_locked') ? 'birthday_locked' : 'save_failed' }, 409);
    return rewardsReply(saved.data);
  } catch (e) {
    if (e.message === 'email_required') return rewardsReply({ error: 'email_required' }, 409);
    return rewardsReply({ error: e instanceof SyntaxError || e.message === 'invalid_birthday' ? 'invalid_birthday' : 'temporarily_unavailable' }, e instanceof SyntaxError || e.message === 'invalid_birthday' ? 400 : 503);
  }
}
