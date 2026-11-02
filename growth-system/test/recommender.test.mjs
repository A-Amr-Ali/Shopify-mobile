import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { trainModel, rankCards, issueVisitor, visitorFrom, armFor } from '../src/recommender.mjs';
import { makeRecoRoutes, recordRecoOrder } from '../src/reco-service.mjs';
const now=Date.parse('2026-11-02T12:00:00Z');
const event=(session,id,type='click',age=0)=>({session_id:session,variant_id:id,event:type,created_at:new Date(now-age*86400000).toISOString()});
const card=(id,handle=id,title='Lip oil')=>({variantId:id,handle,title,brand:'Test',available:true,price:2000});
test('learns cross-product relationships from independent sessions, not refresh volume',()=>{
 const s1=randomUUID(),s2=randomUUID(),one=randomUUID();
 const rows=[event(s1,'1'),event(s1,'2'),event(s2,'1'),event(s2,'2'),...Array.from({length:100},()=>event(one,'3')),event(one,'4')];
 const m=trainModel(rows,now);
 assert.equal(m.metrics.sessions,3);assert.equal(m.neighbors['1'][0].id,'2');assert.equal(m.neighbors['3'],undefined);
 assert.ok(m.popularity['1']>m.popularity['3']);
});
test('excludes passive impressions, malformed identifiers, stale and future data',()=>{
 const s=randomUUID();const m=trainModel([event(s,'1','impression'),event(s,'2','click',31),event(s,'3','click',-1),event(s,'x'),event('bad','4')],now);
 assert.equal(m.metrics.items,0);
});
test('personal ranking finds unseen related products; control stays popular',()=>{
 const model={popularity:{'1':1,'2':2,'3':100},neighbors:{'1':[{id:'2',score:1}]}};
 const history=[event(randomUUID(),'1','cart')];
 const pool=[card('1'),card('2'),card('3')];
 assert.equal(rankCards(pool,model,history,{visitorId:'test',arm:'personalized',now,limit:2,current:'1'})[0].variantId,'2');
 assert.equal(rankCards(pool,model,history,{visitorId:'test',arm:'control',now,limit:2,current:'1'})[0].variantId,'3');
});
test('dismissal, duplicate product shades, unavailable variants and current option are excluded',()=>{
 const out=rankCards([card('1','same'),card('2','same'),card('3'),{...card('4'),available:false},card('5')],{popularity:{},neighbors:{}},
 [event(randomUUID(),'3','dismiss')],{visitorId:'x',arm:'control',now,current:'5'});
 assert.deepEqual(out.map(c=>c.variantId),['1']);
});
test('visitor capabilities reject tampering, expiry and absent secrets; assignment is stable',()=>{
 const token=issueVisitor('secret',now);assert.ok(visitorFrom(token,'secret',now));
 assert.equal(visitorFrom(token+'x','secret',now),null);assert.equal(visitorFrom(token,'wrong',now),null);
 assert.equal(visitorFrom(token,'secret',now+91*86400000),null);assert.equal(visitorFrom(token,'',now),null);
 assert.equal(armFor('a'),armFor('a'));assert.throws(()=>issueVisitor(''));
});
async function call(route,path,data) {
 let result;
 await route({method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'}},{},new URL('http://local'+path),{bodyJSON:async()=>data,send:(_,status,body)=>{result={status,body};}});
 return result;
}
test('no consent means no storage, model queries or visitor issuance',async()=>{
 const route=makeRecoRoutes({store:async()=>{throw Error('must not access database');},key:()=> 'test'});
 assert.deepEqual((await call(route,'/api/for-you/recommend',{consent:false})).body,{recorded:false,items:[]});
});
test('feedback cannot claim impressions from another visitor or fabricate a served request',async()=>{
 const route=makeRecoRoutes({store:async()=>[],budget:async()=>true,key:()=> 'test'});
 const result=await call(route,'/api/for-you/events',{consent:true,token:issueVisitor('test'),sessionId:randomUUID(),
 events:[{eventId:randomUUID(),event:'impression',variantId:'1',requestId:randomUUID()}]});
 assert.equal(result.status,400);assert.equal(result.body.error,'invalid_attribution');
});
test('records server-issued positions and model before returning recommendations',async()=>{
 const writes=[];const m={...trainModel([]),popularity:{'1':3}};
 const route=makeRecoRoutes({store:async(path,options)=>{if(options?.method==='POST')writes.push(options.body);return[];},budget:async()=>true,key:()=> 'test',
 cards:async()=>[card('1')],fallback:async()=>[],getModel:async()=>m});
 const result=await call(route,'/api/for-you/recommend',{consent:true,token:issueVisitor('test'),sessionId:randomUUID()});
 assert.equal(result.status,200);assert.equal(result.body.items.length,1);
 assert.equal(writes[0][0].event,'served');assert.equal(writes[0][0].request_id,result.body.requestId);assert.equal(writes[0][0].position,0);
});
test('client cannot submit purchases or another customer identity',async()=>{
 const route=makeRecoRoutes({store:async()=>[],budget:async()=>true,key:()=> 'test'});
 const result=await call(route,'/api/for-you/events',{consent:true,token:issueVisitor('test'),sessionId:randomUUID(),
 events:[{eventId:randomUUID(),event:'purchase',variantId:'1'}]});
 assert.equal(result.status,400);
});
test('orders attribute only actually purchased served variants, and late updates are conditional',async()=>{
 const request=randomUUID(), visitor='a'.repeat(64), session=randomUUID(), writes=[];
 const store=async(path,options)=>{
   if(options){writes.push({path,...options});return [];}
   if(path.startsWith('sofie_reco_events'))return [{variant_id:'1',visitor_id:visitor,session_id:session},{variant_id:'2',visitor_id:visitor,session_id:session}];
   return [];
 };
 await recordRecoOrder({id:123,created_at:'2026-11-02T12:00:00Z',updated_at:'2026-11-02T13:00:00Z',financial_status:'paid',
  note_attributes:[{name:'sofie_reco_request',value:request}],line_items:[{variant_id:2},{variant_id:99}],email:'private'},store);
 assert.deepEqual(writes[0].body.variant_ids,['2']);assert.equal(writes[0].body.paid,true);
 assert.equal(writes[0].body.email,undefined);assert.match(writes[1].path,/shopify_updated_at=lte/);
});
test('refunds and test orders cannot remain positive purchase outcomes',async()=>{
 for(const extra of [{financial_status:'refunded'},{cancelled_at:'2026-11-02T00:00:00Z'},{test:true}]) {
  const writes=[];const store=async(path,options)=>{if(options){writes.push(options);return[];}return[{order_id:'123',variant_ids:['1'],visitor_id:'a'.repeat(64),session_id:randomUUID(),request_id:randomUUID(),occurred_at:'2026-11-02T12:00:00Z'}];};
  await recordRecoOrder({id:123,updated_at:'2026-11-02T13:00:00Z',financial_status:'paid',...extra},store);
  assert.equal(writes[1].body.paid,false);
 }
});
test('forget removes device events and attributed order outcomes',async()=>{
 const paths=[];const route=makeRecoRoutes({store:async(path,options)=>{if(options?.method==='DELETE')paths.push(path);return[];},budget:async()=>true,key:()=> 'test'});
 assert.equal((await call(route,'/api/for-you/forget',{consent:true,token:issueVisitor('test')})).status,200);
 assert.equal(paths.length,2);assert.ok(paths.every(p=>p.includes('visitor_id=eq.')));
});
