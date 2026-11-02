import { TIERS, EARN_DIVISOR, REDEMPTION_TIERS, BIRTHDAY } from '../config/loyalty.js';
import { earnedPoints } from './points.server.js';

export function cairoDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour) };
}

export function normalizeBirthday(body) {
  const legacy = typeof body.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.birthday) ? body.birthday : null;
  const month = Number(body.month ?? legacy?.slice(5, 7));
  const day = Number(body.day ?? legacy?.slice(8, 10));
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(2000, month, 0)).getUTCDate()) throw new Error('invalid_birthday');
  return `2000-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function purchaseMultiplier(customer, now = new Date()) {
  const tier = TIERS.find(t => t.key === customer?.tier) || TIERS.find(t => t.key === 'insider');
  const birthdayMonth = Number(String(customer?.birthday || '').slice(5, 7));
  return tier.multiplier * (tier.key !== 'insider' && customer?.birthday_opt_in && birthdayMonth === cairoDate(now).month ? 2 : 1);
}

export function birthdayWindow(customer, now = new Date()) {
  if (!customer?.birthday || !customer.birthday_opt_in) return { eligible: false, year: null };
  const today = cairoDate(now);
  const month = Number(customer.birthday.slice(5, 7));
  const day = Number(customer.birthday.slice(8, 10));
  function observed(year) { return Date.UTC(year, month - 1, Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())); }
  const date = Date.UTC(today.year, today.month - 1, today.day);
  const year = date < observed(today.year) ? today.year - 1 : today.year;
  const since = (date - observed(year)) / 86400000;
  return { eligible: since >= 0 && since < 45, year, expiresAt: new Date(observed(year) + 45 * 86400000).toISOString() };
}

export function rewardsRules(customer, now = new Date()) {
  return { divisor: EARN_DIVISOR, multiplier: purchaseMultiplier(customer, now), tiers: [...TIERS].reverse(), rewards: REDEMPTION_TIERS, birthdayValues: Object.fromEntries(['insider', 'vip', 'icon'].map(k => [k, BIRTHDAY[k].egp])) };
}

export function estimatePoints(priceMinor, quantity, customer, now = new Date()) {
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9999) return 0;
  return earnedPoints(Math.round(priceMinor * quantity / 100), purchaseMultiplier(customer, now));
}

export function staffReceipt(body) {
  const branch = String(body.branch || '').trim();
  const receipt = String(body.receipt || '').trim();
  if (!branch || branch.length > 60 || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(receipt)) throw new Error('receipt_required');
  return { branch, receipt };
}
