import { randomUUID } from 'node:crypto';
import { db, takeBudget, configured } from './db.mjs';
import { adminQuery, OPTIONS_QUERY, discoveryCandidates } from './catalog.mjs';
import { privateActor, secretMatches } from './security.mjs';
import { issueVisitor, visitorFrom, armFor, uuid, variant, trainModel, candidateIds, rankCards } from './recommender.mjs';

const secret=()=>process.env.RECO_SIGNING_KEY || process.env.RATE_HASH_KEY;
const insert=(store,rows)=>store('sofie_reco_events?on_conflict=event_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:rows});
let cache=null, cachedAt=0, training=null;
export async function model(store=db) {
  if(cache && Date.now()-cachedAt<300000) return cache;
  const rows=await store('sofie_reco_models?id=eq.active&select=payload');
  cache=rows[0]?.payload || trainModel([]); cachedAt=Date.now(); return cache;
}

async function trainingEvents(store) {
  const since=new Date(Date.now()-30*86400000).toISOString();
  const out=[];
  // Bounded, deterministic pages. Legacy passive views are deliberately excluded.
  for(const [table,select,filter] of [
    ['growth_events','id,session_id,event,variant_ids,created_at','event=in.(product_click,cart_add)'],
    ['sofie_reco_events','event_id,session_id,event,variant_id,created_at','event=in.(view,click,save,cart,purchase)']
  ]) {
    let last=null;
    for(let page=0;page<40;page++) {
      const key=table==='growth_events'?'id':'event_id';
      const path=table+'?select='+select+'&'+filter+'&created_at=gte.'+since+'&order='+key+'.asc&limit=500'+(last?'&'+key+'=gt.'+last:'');
      const rows=await store(path);
      for(const row of rows) {
        const event=({product_click:'click',cart_add:'cart'})[row.event]||row.event;
        for(const id of row.variant_ids || [row.variant_id]) if(variant(String(id)))
          out.push({session_id:row.session_id,event,variant_id:String(id),created_at:row.created_at});
      }
      if(rows.length<500) break;
      if(page===39) throw Error('recommendation_training_window_exceeds_limit');
      last=rows.at(-1)[key];
    }
  }
  const orders=await store('sofie_reco_orders?paid=eq.true&occurred_at=gte.'+since+'&order=occurred_at.desc&limit=1000');
  for(const o of orders) for(const id of o.variant_ids) if(variant(id))
    out.push({session_id:o.session_id,variant_id:id,event:'purchase',created_at:o.occurred_at});
  return out;
}
export async function retrain(store=db) {
  if(training) return training;
  training=(async()=>{
    const next=trainModel(await trainingEvents(store));
    await store('sofie_reco_models?on_conflict=id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{id:'active',payload:next,trained_at:next.trainedAt}});
    cache=next; cachedAt=Date.now();
    await store('sofie_reco_events?created_at=lt.'+new Date(Date.now()-90*86400000).toISOString(),{method:'DELETE',prefer:'return=minimal'});
    await store('sofie_reco_orders?occurred_at=lt.'+new Date(Date.now()-90*86400000).toISOString(),{method:'DELETE',prefer:'return=minimal'});
    return {version:next.version,...next.metrics};
  })().finally(()=>{training=null;});
  return training;
}
const cardCache=new Map();
export async function catalogCards(ids) {
  const needed=ids.filter(id=>!cardCache.has(id) || Date.now()-cardCache.get(id).at>60000);
  for(let i=0;i<needed.length;i+=40) {
    const batch=needed.slice(i,i+40);
    const data=await adminQuery(OPTIONS_QUERY,{ids:batch.map(id=>'gid://shopify/ProductVariant/'+id)});
    for(const id of batch) cardCache.set(id,{at:Date.now(),card:null});
    for(const v of data.nodes.filter(Boolean)) {
      const id=v.id.split('/').pop(), p=v.product;
      const available=p?.status==='ACTIVE' && Boolean(p.onlineStoreUrl) && v.inventoryQuantity>0 && Number(v.price)>0;
      cardCache.set(id,{at:Date.now(),card:available?{variantId:id,handle:p.handle,title:p.title,brand:p.vendor,variantTitle:v.title,
        price:Number(v.price),available:true,image:p.featuredImage?.url||'',url:'https://sofiestore.net/products/'+p.handle+'?variant='+id}:null});
    }
  }
  if(cardCache.size>5000) for(const [id,v] of cardCache) if(Date.now()-v.at>60000) cardCache.delete(id);
  return ids.map(id=>cardCache.get(id)?.card).filter(Boolean);
}

export function makeRecoRoutes({store=db,budget=takeBudget,cards=catalogCards,getModel=model,key=secret,
  fallback=async()=>catalogCards((await discoveryCandidates()).map(x=>x.variantId))
}={}) {
  return async function recoRoutes(req,res,url,{bodyJSON,send}) {
    if(!url.pathname.startsWith('/api/for-you/') && url.pathname!=='/ops/for-you') return false;
    const reply=(status,value)=>{send(res,status,value);return true;};
    if(process.env.RECO_ENABLED==='false') return reply(503,{error:'recommendations_disabled'});
    if(url.pathname==='/ops/for-you') {
      if(!secretMatches(String(req.headers.authorization||'').replace(/^Bearer /,''),process.env.STAFF_KEY)) return reply(401,{error:'unauthorized'});
      const m=await getModel(store); return reply(200,{algorithm:m.algorithm,version:m.version,trainedAt:m.trainedAt,...m.metrics});
    }
    if(req.method!=='POST') return reply(405,{error:'method_not_allowed'});
    const data=await bodyJSON(req);
    if(data.consent!==true) return reply(200,{recorded:false,items:[]});
    if(!(await budget('for_you',privateActor(req),240,3600))) return reply(429,{error:'too_many_requests'});
    if(url.pathname==='/api/for-you/visitor') {
      const token=issueVisitor(key()); return reply(200,{token,expiresIn:90*86400});
    }
    const visitor=visitorFrom(data.token,key());
    if(!visitor) return reply(401,{error:'invalid_visitor'});
    const scope='visitor_id=eq.'+visitor;
    if(url.pathname==='/api/for-you/forget') {
      await store('sofie_reco_events?'+scope,{method:'DELETE',prefer:'return=minimal'});
      await store('sofie_reco_orders?'+scope,{method:'DELETE',prefer:'return=minimal'});
      // Clear the serving cache; scheduled retraining refreshes aggregates.
      cache=null; cachedAt=0;
      return reply(200,{forgotten:true});
    }
    if(!uuid(data.sessionId)) return reply(400,{error:'invalid_session'});
    if(!(await budget('for_you_visitor',visitor,180,3600))) return reply(429,{error:'too_many_requests'});
    if(url.pathname==='/api/for-you/events') {
      if(!Array.isArray(data.events)||!data.events.length||data.events.length>20) return reply(400,{error:'invalid_events'});
      const rows=[];
      for(const e of data.events) {
        if(!uuid(e.eventId)||!variant(e.variantId)||!['impression','view','click','save','cart','dismiss'].includes(e.event)) return reply(400,{error:'invalid_event'});
        let served=null;
        if(e.requestId) {
          if(!uuid(e.requestId)) return reply(400,{error:'invalid_request'});
          [served]=await store('sofie_reco_events?'+scope+'&event=eq.served&request_id=eq.'+e.requestId+'&variant_id=eq.'+e.variantId+'&limit=1');
          if(!served) return reply(400,{error:'invalid_attribution'});
        } else if(['impression','dismiss'].includes(e.event)) return reply(400,{error:'missing_attribution'});
        rows.push({event_id:e.eventId,visitor_id:visitor,session_id:data.sessionId,event:e.event,variant_id:e.variantId,
          request_id:served?.request_id||null,position:served?.position??null,arm:served?.arm||armFor(visitor),model_version:served?.model_version||null});
      }
      await insert(store,rows); return reply(200,{recorded:rows.length});
    }
    if(url.pathname==='/api/for-you/recommend') {
      const m=await getModel(store);
      const history=await store('sofie_reco_events?'+scope+'&event=in.(view,click,save,cart,dismiss,purchase)&order=created_at.desc&limit=200');
      const current=variant(data.current)?data.current:null;
      // Current page context is recorded separately by the client, then becomes
      // part of the next recommendation. Never accept a client's customer ID.
      const ids=candidateIds(m,history);
      let pool=ids.length?await cards(ids):[];
      try { const more=await fallback();const seen=new Set(pool.map(c=>c.variantId));pool.push(...more.filter(c=>!seen.has(c.variantId))); }
      catch(error) { if(!pool.length)throw error; }
      const arm=armFor(visitor), requestId=randomUUID();
      const items=rankCards(pool,m,history,{visitorId:visitor,arm,current});
      if(items.length) await insert(store,items.map((c,position)=>({event_id:randomUUID(),visitor_id:visitor,session_id:data.sessionId,
        event:'served',variant_id:c.variantId,request_id:requestId,position,arm,model_version:m.version})));
      return reply(200,{items,requestId,arm,modelVersion:m.version,currency:'EGP'});
    }
    return reply(404,{error:'not_found'});
  };
}
export const recoRoutes=makeRecoRoutes();
// Invoked only after the existing raw-body Shopify webhook signature check.
export async function recordRecoOrder(order,store=db) {
  if(!/^\d{1,20}$/.test(String(order.id)) || !Number.isFinite(Date.parse(order.updated_at))) return;
  const id=String(order.id);
  const attrs=Object.fromEntries((order.note_attributes||[]).map(x=>[x.name,x.value]));
  let [existing]=await store('sofie_reco_orders?order_id=eq.'+id+'&limit=1');
  let row=existing;
  if(!row) {
    if(!uuid(attrs.sofie_reco_request)) return;
    const served=await store('sofie_reco_events?event=eq.served&request_id=eq.'+attrs.sofie_reco_request+'&limit=8');
    if(!served.length) return;
    const bought=new Set((order.line_items||[]).map(x=>String(x.variant_id)));
    const ids=[...new Set(served.filter(x=>bought.has(x.variant_id)).map(x=>x.variant_id))];
    if(!ids.length)return;
    row={order_id:id,visitor_id:served[0].visitor_id,session_id:served[0].session_id,request_id:attrs.sofie_reco_request,
      variant_ids:ids,occurred_at:order.created_at};
  }
  row={...row,paid:!order.test && !order.cancelled_at && order.financial_status==='paid',
    shopify_updated_at:order.updated_at};
  await store('sofie_reco_orders?on_conflict=order_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:row});
  await store('sofie_reco_orders?order_id=eq.'+id+'&shopify_updated_at=lte.'+encodeURIComponent(order.updated_at),
    {method:'PATCH',prefer:'return=minimal',body:{paid:row.paid,shopify_updated_at:order.updated_at}});
}
export function startRecoJobs() {
  if(!configured||process.env.RECO_ENABLED==='false') return;
  const run=()=>retrain().then(x=>console.log('recommendation training',JSON.stringify(x))).catch(e=>console.warn('recommendation training:',e.message));
  setTimeout(run,30000).unref();
  setInterval(run,6*3600000).unref();
}
