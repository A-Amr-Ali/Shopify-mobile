import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildIndex, cleanArrival, retrieve, terms, interestQuery } from '../src/reco-intent.mjs';
import { issueIdentity,readIdentity } from '../src/reco-identity.mjs';
import { fitRanker,matureLabels,predict } from '../src/reco-learning.mjs';
import { syncRecoCatalog,packCatalog,unpackCatalog } from '../src/reco-catalog.mjs';
import { rankCards,issueVisitor,trainModel } from '../src/recommender.mjs';
import { makeRecoRoutes } from '../src/reco-service.mjs';
const card=(variantId,handle,title,brand,productType,description='')=>({variantId,handle,title,brand,productType,description,tags:[],available:true,price:2000,variantTitle:'Default Title'});
const catalog=[
 card('1','blush','Pocket Blush','Rhode','Blush','Cream blush for cheeks'),
 card('2','hair','Anti Frizz Hair Spray','Color Wow','Hair Care','Hair styling and frizz control'),
 card('3','tint','Peptide Lip Tint','Rhode','Lips','Tinted lip colour'),
 card('4','mug','Christmas Coffee Mug','Lenox','Home','Ceramic cup for coffee')
];
test('Arabic product intent retrieves the actual matching product across brands',()=>{
 const index=buildIndex(catalog);
 assert.equal(retrieve(index,'بلاشر رود')[0].variantId,'1');
 assert.equal(retrieve(index,'هيشان شعر')[0].variantId,'2');
 assert.equal(retrieve(index,'rhode lip tint')[0].variantId,'3');
});
test('brand new products with no interaction history are retrievable',()=>{
 const index=buildIndex([...catalog,card('5','new-hair','New Hydrating Shampoo','New Brand','Shampoo')]);
 assert.equal(retrieve(index,'new brand shampoo')[0].variantId,'5');
});
test('incoming terms never keep email, raw URLs or phone numbers',()=>{
 for(const value of ['private@example.com','https://google.com/search?q=anything','01012345678'])assert.deepEqual(terms(value),[]);
 const index=buildIndex(catalog);const arrival=cleanArrival({query:'blush privateunrecognizedword',source:'unknown',campaign:'not-real'},index.vocabulary);
 assert.deepEqual(arrival.terms,['blush']);assert.equal(arrival.source,'direct');assert.equal(arrival.campaign,null);
});
test('known campaign conveys context, not a claim about private search history',()=>{
 const c=cleanArrival({campaign:'sofie-rhode-lips',source:'instagram'});
 assert.ok(c.terms.includes('rhode'));assert.ok(c.terms.includes('tint'));assert.equal(c.query,undefined);
});
test('explicit new search overrides old interest in a different category',()=>{
 const index=buildIndex(catalog),history=[{event:'click',variant_id:'1',created_at:new Date().toISOString()}];
 const arrival=cleanArrival({query:'hair frizz',onsite:true},index.vocabulary);
 assert.deepEqual(interestQuery(index,history,arrival,['rhode']),['hair','frizz']);
 const retrieved=retrieve(index,arrival.terms), scores=new Map(retrieved.map(c=>[c.variantId,c.semanticScore]));
 const pool=catalog.map(c=>({...c,semanticScore:scores.get(c.variantId)||0}));
 const result=rankCards(pool,{popularity:{'1':100,'2':1},neighbors:{}},history,{visitorId:'test',arm:'personalized',arrival,limit:3});
 assert.equal(result[0].variantId,'2');
});
test('identity tickets are encrypted, short-lived and shop-bound',()=>{
 const now=Date.now(),cid='gid://shopify/Customer/123',shop='a45545-2.myshopify.com';
 const ticket=issueIdentity(cid,shop,'test',now);
 assert.equal(ticket.includes('123'),false);assert.equal(readIdentity(ticket,shop,'test',now).customerId,cid);
 assert.equal(readIdentity(ticket+'x',shop,'test',now),null);
 assert.equal(readIdentity(ticket,shop,'wrong',now),null);
 assert.equal(readIdentity(ticket,'other.myshopify.com','test',now),null);
 assert.equal(readIdentity(ticket,shop,'test',now+120001),null);
});
test('sparse labels cannot activate an allegedly learned conversion model',()=>{
 assert.equal(fitRanker([]).active,false);
 assert.equal(fitRanker(Array.from({length:100},(_,i)=>({at:new Date(i*1000).toISOString(),x:[0,0,1,0,1],y:i%2}))).active,false);
});
test('a learned click ranker must beat held-out constant predictions',()=>{
 const rows=Array.from({length:1600},(_,i)=>{
  const x=((i*73)%101)/100;
  return {at:new Date(1700000000000+i*1000).toISOString(),x:[0.2,0.1,x,0.5,1],y:x>0.6?1:0};
 });
 const m=fitRanker(rows);assert.equal(m.active,true);assert.ok(m.candidateLoss<m.baseLoss);
 assert.ok(predict(m,{semantic:0.9})>predict(m,{semantic:0.1}));
});
test('invisible, too-recent, and late-click labels do not train as positive exposures',()=>{
 const now=Date.now(),request_id=randomUUID(),base={request_id,visitor_id:'a',variant_id:'1'};
 assert.equal(matureLabels([{...base,event:'served',features:{semantic:1},created_at:new Date(now-2*86400000).toISOString()}],now).length,0);
 const impression={...base,event:'impression',features:{semantic:1},created_at:new Date(now-2*86400000).toISOString()};
 const late={...base,event:'click',created_at:new Date(now).toISOString()};
 assert.equal(matureLabels([impression,late],now)[0].y,0);
 assert.equal(matureLabels([{...impression,created_at:new Date(now).toISOString()}],now).length,0);
});
test('compact catalog preserves exact variants and avoids duplicating product metadata',()=>{
 const cards=[...catalog,{...catalog[0],variantId:'100',variantTitle:'Second option'}];
 const packed=packCatalog(cards);
 assert.equal(Object.keys(packed.products).length,new Set(cards.map(c=>c.handle)).size);
 assert.equal(packed.variants.length,cards.length);
 assert.ok(packed.variants.every(v=>!('description' in v)&&!('image' in v)));
 for(const c of unpackCatalog(JSON.parse(JSON.stringify(packed))))assert.deepEqual(c,cards.find(v=>v.variantId===c.variantId));
 assert.deepEqual(unpackCatalog({cards}),cards);
});
test('catalog pagination publishes only after completion and excludes unavailable options',async()=>{
 const writes=[],pages=[{nodes:[{id:'gid://shopify/ProductVariant/1',title:'Default Title',price:'2000',inventoryQuantity:2,product:{handle:'ok',title:'Valid',vendor:'Brand',status:'ACTIVE',onlineStoreUrl:'https://sofiestore.net/products/ok'}}],pageInfo:{hasNextPage:true,endCursor:'next'}},{nodes:[{id:'gid://shopify/ProductVariant/2',price:'2000',inventoryQuantity:0,product:{status:'ACTIVE',onlineStoreUrl:'x'}}],pageInfo:{hasNextPage:false}}];
 const result=await syncRecoCatalog(async(path,options)=>{writes.push(options.body);return[];},async()=>({productVariants:pages.shift()}));
 assert.equal(result.variants,1);assert.equal(writes.length,1);
 let wrote=false;
 await assert.rejects(()=>syncRecoCatalog(async()=>{wrote=true;},async()=>({productVariants:{nodes:[],pageInfo:{hasNextPage:true,endCursor:null}}})));
 assert.equal(wrote,false);
});
test('catalog retries transient read and snapshot timeouts without publishing an incomplete snapshot',async()=>{
 let reads=0,writes=0;const pauses=[];
 const result=await syncRecoCatalog(async()=>{if(++writes===1)throw Error('The operation was aborted due to timeout');},async()=>{
  if(++reads===1)throw Error('The operation was aborted due to timeout');
  return {productVariants:{nodes:[{id:'gid://shopify/ProductVariant/1',price:'2000',inventoryQuantity:1,product:{handle:'ok',title:'Valid',status:'ACTIVE',onlineStoreUrl:'https://sofiestore.net/products/ok'}}],pageInfo:{hasNextPage:false}}};
 },async ms=>pauses.push(ms));
 assert.equal(result.variants,1);assert.equal(reads,2);assert.equal(writes,2);assert.deepEqual(pauses,[2000,2000]);
});
test('a forged customer ID cannot select another account; a signed account ticket scopes history',async()=>{
 const accesses=[],profileCalls=[];
 const account={customerId:'gid://shopify/Customer/123',subject:'a'.repeat(64)};
 const route=makeRecoRoutes({store:async(path)=>{accesses.push(path);return[];},budget:async()=>true,key:()=> 'test',
  resolveAccount:t=>t==='valid'?account:null,profile:async a=>{profileCalls.push(a);return{history:[],terms:['hair'],handles:[]};},
  getIndex:async()=>buildIndex(catalog),getModel:async()=>trainModel([]),cards:async ids=>catalog.filter(c=>ids.includes(c.variantId)),fallback:async()=>[]});
 async function call(data){let result;await route({method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'}},{},new URL('https://api.test/api/for-you/recommend'),{bodyJSON:async()=>({consent:true,token:issueVisitor('test'),sessionId:randomUUID(),...data}),send:(_,status,body)=>result={status,body}});return result;}
 const bad=await call({identityTicket:'forged',customerId:'999'});assert.equal(bad.status,401);assert.equal(profileCalls.length,0);
 const good=await call({identityTicket:'valid',customerId:'999'});assert.equal(good.status,200);assert.equal(profileCalls[0].customerId,account.customerId);
 assert.ok(accesses.some(p=>p.includes('subject_id=eq.'+account.subject)));
});
