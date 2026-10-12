import { createHmac, timingSafeEqual } from 'node:crypto';
export function secretMatches(candidate, secret) {
  if (!secret || typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate); const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validWebhook(raw, signature, secret) {
  if (!secret) return false;
  return secretMatches(signature, createHmac('sha256', secret).update(raw).digest('base64'));
}
export function privateActor(req) {
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',').at(-1).trim();
  return createHmac('sha256', process.env.RATE_HASH_KEY || process.env.CRON_KEY || 'local-dev-only').update(ip).digest('hex').slice(0, 40);
}
export function orderRecord(order) {
  if (!order?.id) return null;
  const attrs = Object.fromEntries((order.note_attributes || []).map(x => [String(x.name), String(x.value || '').slice(0, 100)]));
  if (attrs.sofie_campaign !== 'sofie_knows_q4_2026') return null;
  const money = Number(order.current_subtotal_price ?? order.subtotal_price ?? 0);
  return { order_id: String(order.id), campaign: attrs.sofie_campaign, content_id: attrs.sofie_content_id || null,
    session_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attrs.sofie_match_session || '') ? attrs.sofie_match_session : null, financial_status: String(order.financial_status || ''),
    fulfillment_status: order.fulfillment_status ? String(order.fulfillment_status) : null,
    currency: order.currency || 'EGP', net_value: order.cancelled_at || order.financial_status === 'refunded' ? 0 : (Number.isFinite(money) ? Math.max(0, money) : 0),
    cancelled_at: order.cancelled_at || null, shopify_updated_at: order.updated_at || null, updated_at: new Date().toISOString() };
}
