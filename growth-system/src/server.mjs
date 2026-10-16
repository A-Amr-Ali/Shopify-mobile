import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { cleanProfile, chooseRoutine, ruleAdvice, medicalQuestion } from './engine.mjs';
import { loadCatalog, checkOptions } from './catalog.mjs';
import { explainRoutine } from './ai.mjs';
import { db, configured, takeBudget } from './db.mjs';
import { privateActor, secretMatches, validWebhook, orderRecord } from './security.mjs';
import { runGrowth } from './jobs.mjs';
import { ensureOrderWebhooks } from './webhooks.mjs';
import { GOALS } from './config.mjs';
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js','text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css','text/css; charset=utf-8'], '/routine-editor.js':['routine-editor.js','text/javascript; charset=utf-8'], '/nour.jpg': ['nour.jpg','image/jpeg'] };
for (let i=1;i<=5;i++) assets['/launch-0'+i+'.png'] = ['launch-0'+i+'.png','image/png'];
const allowedOrigins = new Set(['https://sofiestore.net', 'https://www.sofiestore.net']);
if (process.env.PUBLIC_ORIGIN) allowedOrigins.add(process.env.PUBLIC_ORIGIN.replace(/\/$/, ''));
function send(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control':'no-store' }); res.end(JSON.stringify(body)); }
async function bodyBytes(req, limit = 16384) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > limit) throw new Error('body_too_large'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function bodyJSON(req) { try { return JSON.parse((await bodyBytes(req)).toString('utf8')); } catch { throw new Error('invalid_json'); } }
const uuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v || '');
export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('x-content-type-options','nosniff'); res.setHeader('referrer-policy','strict-origin-when-cross-origin');
  const origin = req.headers.origin;
  const localOrigin = process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin || '');
  if (origin && (allowedOrigins.has(origin) || localOrigin)) {
    res.setHeader('access-control-allow-origin', origin); res.setHeader('vary','Origin');
    res.setHeader('access-control-allow-headers','content-type'); res.setHeader('access-control-allow-methods','POST,GET,OPTIONS');
  } else if (origin && url.pathname.startsWith('/api/')) return send(res,403,{error:'origin_not_allowed'});
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    if (req.method === 'GET' && assets[url.pathname]) {
      const [name, mime] = assets[url.pathname];
      res.writeHead(200, { 'content-type': mime, 'cache-control': name.endsWith('.jpg') ? 'public,max-age=86400' : 'public,max-age=300' });
      return res.end(await readFile(publicDir + name));
    }
    if (url.pathname === '/health') {
      let ready = false;
      try { if (configured) { await db('growth_campaigns?select=id&limit=1'); ready = true; } } catch { /* readiness reported */ }
      return send(res, 200, { status: 'ok', database: ready ? 'ready' : 'unavailable', version: '1.0.0' });
    }
    if (url.pathname === '/api/match' && req.method === 'POST') {
      const actor = privateActor(req);
      if (configured && !(await takeBudget('match', actor, 30, 3600))) return send(res,429,{error:'too_many_requests'});
      const profile = cleanProfile(await bodyJSON(req));
      if (medicalQuestion(profile.note)) return send(res,200,{items:[],total:0,currency:'EGP',advice:ruleAdvice(profile,[]),source:'referral',needsSpecialist:true});
      const catalog = await loadCatalog(profile.goal, { today: profile.today, budget: profile.budget, faceAreas: profile.faceAreas, concerns: profile.concerns });
      const routine = chooseRoutine(catalog.cards, profile);
      routine.alternatives = routine.items.flatMap(item => {
        const seen = new Set([item.handle]);
        return catalog.cards.filter(c => c.step === item.step && !seen.has(c.handle) && seen.add(c.handle)).slice(0,5).map(c => ({step:c.step,variantId:c.variantId,handle:c.handle,title:c.title,variantTitle:c.variantTitle,price:c.price,image:c.image,brand:c.brand,url:c.url}));
      });
      if (routine.items.length) {
        const checked = await checkOptions(routine.items.map(p => p.variantId));
        routine.items = routine.items.flatMap(p => { const current = checked.items.find(v => v.variantId === p.variantId); return current?.available ? [{ ...p, ...current }] : []; });
        routine.total = Math.round(routine.items.reduce((n,p) => n + p.price, 0) * 100) / 100;
      }
      const advice = await explainRoutine(profile, routine, actor);
      return send(res,200,{...routine,advice:advice.text,source:advice.source,verification:catalog.verification,checkedAt:new Date().toISOString()});
    }
    if (url.pathname === '/api/routine/check' && req.method === 'POST') {
      if (!(await takeBudget('routine_check', privateActor(req), 90, 3600))) return send(res,429,{error:'too_many_requests'});
      const data = await bodyJSON(req);
      return send(res,200,await checkOptions(data.variantIds));
    }
    if (url.pathname === '/api/events' && req.method === 'POST') {
      const data = await bodyJSON(req);
      if (data.consent !== true) return send(res,200,{recorded:false});
      if (!uuid(data.eventId) || !uuid(data.sessionId) || !['match_complete','product_click','cart_add','qr_scan','journey_view','product_view','cart_view','checkout_start','match_start','passport_save','routine_edit','routine_check','discovery_view'].includes(data.event)) return send(res,400,{error:'invalid_event'});
      if (!(await takeBudget('events', privateActor(req), 120, 3600))) return send(res,429,{error:'too_many_requests'});
      const ids = Array.isArray(data.variantIds) ? data.variantIds.filter(id => /^\d+$/.test(String(id))).slice(0,5).map(String) : [];
      await db('growth_events?on_conflict=event_id', {method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{
        event_id:data.eventId,session_id:data.sessionId,event:data.event,goal:GOALS[data.goal] ? data.goal : null,
        content_id:String(data.contentId||'adviser').slice(0,100),campaign:'sofie_knows_q4_2026',
        source:String(data.source||'direct').slice(0,30),variant_ids:ids }});
      return send(res,200,{recorded:true});
    }
    if (url.pathname === '/webhooks/orders' && req.method === 'POST') {
      const raw = await bodyBytes(req, 1048576);
      if (req.headers['x-shopify-shop-domain'] !== process.env.SHOP_DOMAIN || !validWebhook(raw, req.headers['x-shopify-hmac-sha256'], process.env.SHOPIFY_ADMIN_CLIENT_SECRET)) return send(res,401,{error:'unauthorized'});
      const row = orderRecord(JSON.parse(raw));
      if (row) {
        // Insert once, then conditionally update atomically. A delayed webhook
        // cannot overwrite a newer Shopify update, even with concurrent requests.
        await db('growth_orders?on_conflict=order_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:row});
        if (row.shopify_updated_at && Number.isFinite(Date.parse(row.shopify_updated_at)))
          await db('growth_orders?order_id=eq.' + encodeURIComponent(row.order_id) + '&or=' +
            encodeURIComponent('(shopify_updated_at.is.null,shopify_updated_at.lte.' + row.shopify_updated_at + ')'),
            {method:'PATCH',prefer:'return=minimal',body:row});
      }
      return send(res,200,{accepted:true});
    }
    if (url.pathname === '/jobs/run' && req.method === 'POST') {
      if (!secretMatches(req.headers['x-cron-key'], process.env.CRON_KEY)) return send(res,401,{error:'unauthorized'});
      return send(res,200,await runGrowth());
    }
    if (url.pathname === '/ops/status' && req.method === 'GET') {
      if (!secretMatches(String(req.headers.authorization || '').replace(/^Bearer /,''), process.env.STAFF_KEY)) return send(res,401,{error:'unauthorized'});
      const runs = await db('growth_runs?order=created_at.desc&limit=4');
      const queue = await db('growth_content?select=id,title,status,scheduled_for,blocker&order=scheduled_for.asc&limit=12');
      return send(res,200,{runs,queue});
    }
    return send(res,404,{error:'not_found'});
  } catch (error) {
    console.error('request failed:', url.pathname, error.message);
    const bad = /^invalid_/.test(error.message);
    return send(res,bad?400:503,{error:bad?error.message:'temporarily_unavailable'});
  }
}
if (process.env.NODE_ENV !== 'test') {
  http.createServer(handler).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('SOFIE Growth listening'));
  if (configured && process.env.RUN_JOBS === 'true') {
    ensureOrderWebhooks().then(s => console.log('order webhook setup', JSON.stringify(s))).catch(e=>console.warn('order webhook setup unavailable:', e.message));
    setTimeout(() => runGrowth().then(s => console.log('growth queue', JSON.stringify(s))), 15000);
    setInterval(() => runGrowth().then(s => console.log('growth queue', JSON.stringify(s))), 30 * 60000).unref();
  }
}
