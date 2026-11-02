import { json } from '@remix-run/node';
import { createHash } from 'node:crypto';
import { supabase } from '../db.server.js';
import { cleanPassport, verifyPassportRequest } from '../lib/passport-core.js';

const reply = (data, status = 200) => json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function loader({ request }) {
  const auth = verifyPassportRequest(request);
  if (!auth.ok) return reply({ error: 'unauthorized' }, 401);
  if (!auth.customerId) return reply({ error: 'not_logged_in' }, 401);
  const [saved, profile] = await Promise.all([
    supabase.from('beauty_passports').select('data,version,updated_at').eq('customer_id', auth.customerId).maybeSingle(),
    supabase.from('profiles').select('skin_type,undertone,foundation_brand,foundation_shade,current_products,completion_pct').eq('customer_id', auth.customerId).maybeSingle()
  ]);
  if (saved.error || profile.error) return reply({ error: 'temporarily_unavailable' }, 503);
  return reply({ passport: saved.data?.data || null, version: saved.data?.version || 0, updatedAt: saved.data?.updated_at || null, beautyProfile: profile.data || null });
}

export async function action({ request }) {
  if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  const auth = verifyPassportRequest(request);
  if (!auth.ok) return reply({ error: 'unauthorized' }, 401);
  if (!auth.customerId) return reply({ error: 'not_logged_in' }, 401);
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 32768) return reply({ error: 'too_large' }, 413);
    const body = JSON.parse(raw);
    if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0 || body.consent !== true) return reply({ error: 'invalid_save' }, 400);
    const data = body.clear === true ? {} : cleanPassport(body.passport);
    const budget = await supabase.rpc('growth_take_budget', { p_scope: 'passport', p_actor: createHash('sha256').update(auth.customerId).digest('hex'), p_cap: 60, p_seconds: 3600 });
    if (budget.error) return reply({ error: 'temporarily_unavailable' }, 503);
    if (!budget.data) return reply({ error: 'too_many_requests' }, 429);
    const customer = await supabase.from('customers').upsert({ shopify_customer_id: auth.customerId }, { onConflict: 'shopify_customer_id', ignoreDuplicates: true });
    if (customer.error) return reply({ error: 'temporarily_unavailable' }, 503);
    const saved = await supabase.rpc('sofie_save_passport', { p_customer_id: auth.customerId, p_expected_version: body.expectedVersion, p_data: data });
    if (saved.error) return reply({ error: 'temporarily_unavailable' }, 503);
    if (!saved.data?.ok) return reply({ error: 'version_conflict', version: saved.data?.version }, 409);
    return reply(saved.data);
  } catch (error) {
    return reply({ error: error instanceof SyntaxError || /^invalid_/.test(error.message) ? 'invalid_passport' : 'temporarily_unavailable' }, error instanceof SyntaxError || /^invalid_/.test(error.message) ? 400 : 503);
  }
}
