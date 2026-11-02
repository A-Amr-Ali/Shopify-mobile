import { verifyAppProxy } from './hmac.server.js';

const id = value => typeof value === 'string' && /^\d{1,20}$/.test(value);
const text = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const enums = (value, allowed, fallback = '') => allowed.includes(value) ? value : fallback;
const list = (value, allowed, max = 3) => Array.isArray(value) ? [...new Set(value.filter(v => allowed.includes(v)))].slice(0, max) : [];
const modes = ['base', 'skin', 'scent', 'lips', 'hair'];
const matchFields = ['skin','kind','finish','coverage','depth','tone','concerns','faceArea','budget','colour','families','format','hconcerns','intensity','lfinish','moment','prefs','size','type','want'];
const cleanItem = item => {
  if (!item || !/^[a-z0-9-]{1,200}$/.test(item.handle || '') || (item.variantId && !id(String(item.variantId)))) throw new Error('invalid_item');
  return { handle: item.handle, variantId: item.variantId ? String(item.variantId) : null, title: text(item.title, 250), variantTitle: text(item.variantTitle), step: text(item.step, 40), included: item.included !== false };
};

export function cleanPassport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_passport');
  const p = value.preferences || {};
  const budget = p.budget === '' || p.budget == null ? null : Number(p.budget);
  if (budget !== null && (!Number.isFinite(budget) || budget < 100 || budget > 100000)) throw new Error('invalid_budget');
  const preferences = {
    goal: enums(p.goal, ['prep','lasting','everyday','hydration','gift','scent'], 'prep'),
    skin: enums(p.skin, ['unsure','normal','dry','oily','combo','sensitive'], 'unsure'),
    finish: enums(p.finish, ['natural','radiant','matte'], 'natural'), budget,
    faceAreas: list(p.faceAreas, ['forehead','under-eyes','around-eyes','cheeks','nose','lips','chin-jaw','whole-face']),
    concerns: list(p.concerns, ['breakouts','dark-circles','dark-spots','dryness','fine-lines','pores','redness','texture','dullness','oiliness','puffiness']),
    area: enums(p.area, ['new_cairo','nasr_city','madinaty','giza','shorouk','obour','zayed','october','other']),
    today: p.today === true
  };
  const saved = (Array.isArray(value.saved) ? value.saved : []).slice(0, 100).map(cleanItem);
  const routine = (Array.isArray(value.routine) ? value.routine : []).slice(0, 10).map(cleanItem);
  let match = null;
  if (value.match && modes.includes(value.match.mode)) {
    const answers = {};
    for (const field of matchFields) {
      const v = value.match.a?.[field];
      if (typeof v === 'string') answers[field] = text(v, 80);
      else if (Array.isArray(v)) answers[field] = v.filter(v => typeof v === 'string').slice(0, 8).map(v => text(v, 80));
    }
    match = { mode: value.match.mode, a: answers };
  }
  return { preferences, saved, routine, match };
}

export function verifyPassportRequest(request, secret = process.env.SHOPIFY_API_SECRET, expectedShop = process.env.SHOP_DOMAIN || 'a45545-2.myshopify.com', now = Date.now()) {
  const url = new URL(request.url);
  const { ok, customerId, params } = verifyAppProxy(url, secret || '');
  const timestamp = Number(params.get('timestamp'));
  const unique = ['shop','timestamp','logged_in_customer_id','signature'].every(k => params.getAll(k).length === 1);
  if (!secret || !ok || !unique || params.get('shop') !== expectedShop || !Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return { ok: false, customerId: null };
  if (customerId && !/^gid:\/\/shopify\/Customer\/\d+$/.test(customerId)) return { ok: false, customerId: null };
  return { ok: true, customerId };
}
