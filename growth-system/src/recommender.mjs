import { createHash, createHmac, randomUUID } from 'node:crypto';
import { secretMatches } from './security.mjs';

export const ALGORITHM = 'sofie-item-cosine-v1';
export const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const variant = v => typeof v === 'string' && /^\d{1,20}$/.test(v);
const weights = { view: 1, click: 2, save: 3, cart: 4, purchase: 6 };
const hash = s => createHash('sha256').update(s).digest('hex');
export const armFor = id => parseInt(hash('for-you-v1:' + id).slice(0,8),16) % 5 === 0 ? 'control' : 'personalized';

export function issueVisitor(secret, now = Date.now()) {
  if (!secret) throw Error('recommendations_unconfigured');
  const payload = Buffer.from(JSON.stringify({ id:randomUUID(), exp:now + 90*86400000 })).toString('base64url');
  return payload + '.' + createHmac('sha256',secret).update('reco:' + payload).digest('base64url');
}
export function visitorFrom(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 500) return null;
  const [payload,sig,...extra] = token.split('.');
  if (extra.length || !payload || !secretMatches(sig,createHmac('sha256',secret).update('reco:' + payload).digest('base64url'))) return null;
  try { const v=JSON.parse(Buffer.from(payload,'base64url')); return uuid(v.id) && v.exp>now && v.exp<=now+91*86400000 ? hash(v.id) : null; } catch { return null; }
}

// Fit item relationships from distinct sessions, capped to prevent refreshes
// and very long sessions from dominating. No individual histories in the model.
export function trainModel(events, now = Date.now()) {
  const sessions = new Map();
  for (const e of events) {
    if (!uuid(e.session_id) || !variant(e.variant_id) || !weights[e.event]) continue;
    const age=(now-Date.parse(e.created_at))/86400000;
    if (!Number.isFinite(age) || age<0 || age>30) continue;
    const key=e.session_id + ':' + String(e.created_at).slice(0,10);
    const items=sessions.get(key) || new Map();
    const score=weights[e.event]*Math.exp(-age/14);
    items.set(e.variant_id,Math.max(items.get(e.variant_id)||0,score));
    sessions.set(key,items);
  }
  const popularity=Object.create(null), support=Object.create(null), pairs=new Map();
  for (const items of sessions.values()) {
    const ids=[...items].sort((a,b)=>b[1]-a[1]).slice(0,20);
    for (const [id,w] of ids) { popularity[id]=(popularity[id]||0)+w; support[id]=(support[id]||0)+1; }
    for(let i=0;i<ids.length;i++) for(let j=i+1;j<ids.length;j++) {
      const key=[ids[i][0],ids[j][0]].sort().join(':'); pairs.set(key,(pairs.get(key)||0)+1);
    }
  }
  const neighbors=Object.create(null);
  for(const [key,n] of pairs) {
    if(n<2) continue;
    const [a,b]=key.split(':'); const score=n/Math.sqrt(support[a]*support[b]) * n/(n+3);
    (neighbors[a] ||= []).push({id:b,score,support:n});
    (neighbors[b] ||= []).push({id:a,score,support:n});
  }
  for(const id of Object.keys(neighbors)) neighbors[id].sort((a,b)=>b.score-a.score).splice(30);
  return { algorithm:ALGORITHM, version:ALGORITHM + ':' + new Date(now).toISOString(), popularity, neighbors,
    metrics:{sessions:sessions.size,items:Object.keys(popularity).length,pairs:Object.values(neighbors).reduce((n,a)=>n+a.length,0)/2},
    trainedAt:new Date(now).toISOString() };
}

const tokens = c => new Set(String(c.text || [c.title,c.brand,c.variantTitle].join(' ')).toLowerCase().match(/[a-z]{3,}/g) || []);
function similarity(a,b) { const x=tokens(a),y=tokens(b); let n=0; for(const t of x) if(y.has(t)) n++; return n/Math.max(1,Math.sqrt(x.size*y.size)); }
export function candidateIds(model, history, limit=80) {
  const recent=history.filter(e=>weights[e.event]).slice(0,20).map(e=>e.variant_id);
  const related=recent.flatMap(id=>(model.neighbors[id]||[]).slice(0,8).map(x=>x.id));
  const popular=Object.keys(model.popularity).sort((a,b)=>model.popularity[b]-model.popularity[a]);
  return [...new Set([...recent,...related,...popular])].filter(variant).slice(0,limit);
}
export function rankCards(cards, model, history, {visitorId, arm=armFor(visitorId), now=Date.now(), limit=8, current=null}={}) {
  const byId=new Map(cards.map(c=>[c.variantId,c]));
  const dismissed=new Set(history.filter(e=>e.event==='dismiss').map(e=>e.variant_id));
  const byInterest=new Map();
  for(const e of history.filter(e=>weights[e.event]).slice(0,100)) {
    const strength=weights[e.event]*Math.exp(-Math.max(0,(now-Date.parse(e.created_at))/86400000)/7);
    if(strength>(byInterest.get(e.variant_id)?.strength||0))byInterest.set(e.variant_id,{...e,strength});
  }
  const recent=[...byInterest.values()].sort((a,b)=>b.strength-a.strength).slice(0,20);
  const seen=new Set(recent.map(e=>e.variant_id));
  const maxPop=Math.max(1,...Object.values(model.popularity));
  const ranked=cards.filter(c=>c.available===true && !dismissed.has(c.variantId) && c.variantId!==current).map(c=>{
    let score=Math.log1p(model.popularity[c.variantId]||0)/Math.log1p(maxPop), personal=0;
    if(arm==='personalized') for(const e of recent) {
      const age=Math.max(0,(now-Date.parse(e.created_at))/86400000);
      const w=weights[e.event]*Math.exp(-age/7);
      const relation=(model.neighbors[e.variant_id]||[]).find(x=>x.id===c.variantId)?.score||0;
      const content=byId.has(e.variant_id)?similarity(byId.get(e.variant_id),c):0;
      personal+=w*(relation+0.15*content);
    }
    return {...c, score:score+personal, reason:personal>0.2?'Based on your recent interests':'Discover at SOFIE'};
  }).sort((a,b)=>b.score-a.score || a.variantId.localeCompare(b.variantId));
  const distinct=[]; const handles=new Set();
  for(const c of ranked) if(!handles.has(c.handle)) { handles.add(c.handle); distinct.push(c); }
  const out=distinct.slice(0,limit);
  if(arm==='personalized' && out.length===limit) {
    const novel=distinct.slice(limit).filter(c=>!seen.has(c.variantId));
    if(novel.length) { const i=parseInt(hash(visitorId+new Date(now).toISOString().slice(0,10)).slice(0,8),16)%novel.length; out[limit-1]={...novel[i],reason:'Something new to explore',exploration:true}; }
  }
  return out.map(({score,text,...c})=>c);
}
