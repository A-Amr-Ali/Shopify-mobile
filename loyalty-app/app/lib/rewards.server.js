import { json } from '@remix-run/node';
import crypto from 'node:crypto';
import { supabase } from '../db.server.js';
import { verifyPassportRequest } from './passport-core.js';
import { getAdmin } from './admin.server.js';
import { SHOP_DOMAIN, STAFF_KEY } from '../config/loyalty.js';

export const rewardsReply = (data, status = 200) => json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export function rewardsAuth(request) { return verifyPassportRequest(request); }
export function staffAuthorized(body) {
  const a = Buffer.from(String(body.key || '').trim()), b = Buffer.from(STAFF_KEY.trim());
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
export async function rewardsBody(request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 8192) throw new Error('invalid_input');
  const body = JSON.parse(raw);
  if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('invalid_input');
  return body;
}
export async function syncRewardCustomer(customerId) {
  const admin = await getAdmin(SHOP_DOMAIN);
  const result = await admin.graphql('query RewardCustomer($id:ID!){ customer(id:$id){ id email firstName } }', { variables: { id: customerId } });
  const data = await result.json();
  const customer = data.data?.customer;
  if (!customer || data.errors) throw new Error('customer_unavailable');
  if (!customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error('email_required');
  const saved = await supabase.from('customers').upsert({ shopify_customer_id: customerId, email: customer.email, first_name: customer.firstName }, { onConflict: 'shopify_customer_id' });
  if (saved.error) throw new Error('customer_unavailable');
}
