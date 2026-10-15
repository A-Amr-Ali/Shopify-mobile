import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProfile, normalizeFeed, chooseRoutine, routineSteps, medicalQuestion, campaignUrl } from '../src/engine.mjs';
import { markExactNow, boundCandidates } from '../src/catalog.mjs';
const card = (id,price,step,extra={}) => ({variantId:String(id),handle:'product-'+id,title:'Product '+id,price,step,rank:0,text:'hydrating ceramide gentle fragrance-free',now:false,...extra});
test('total budget applies to the basket, not separately to each product',()=>{
 const p=cleanProfile({goal:'prep',budget:6000,skin:'dry'});
 const r=chooseRoutine([card(1,4000,'prep'),card(2,5500,'primer'),card(3,1800,'primer')],p);
 assert.deepEqual(r.items.map(i=>i.variantId),['1','3']);assert.equal(r.total,5800);assert.ok(r.total<=p.budget);
});
test('a product with an available variant does not make sold-out shades selectable',()=>{
 const r=normalizeFeed([{h:'lip',t:'Lip',s:[{id:1,a:0,p:100000},{id:2,a:1,p:200000}]}],'lip');
 assert.deepEqual(r.map(x=>x.variantId),['2']);assert.equal(r[0].price,2000);
});
test('SOFIE NOW uses the exact variant allowlist, not a product-level badge',()=>{
 const r=markExactNow([card(1,4000,'prep',{handle:'milk',now:true}),card(2,3000,'prep',{handle:'milk',now:true})],new Map([['milk',new Set(['1'])]]));
 assert.equal(r[0].now,true);assert.equal(r[1].now,false);
 const p=cleanProfile({today:true,budget:10000});assert.deepEqual(chooseRoutine(r,p).items.map(x=>x.variantId),['1']);
});
test('missing fast-delivery evidence fails closed',()=>{
 assert.equal(markExactNow([card(1,500,'prep',{now:true})],new Map())[0].now,false);
});
test('sensitive skin excludes exfoliating actives and unsubstantiated gentle claims',()=>{
 const p=cleanProfile({skin:'sensitive'});const r=chooseRoutine([card(1,1000,'prep',{text:'glycolic exfoliating hydrating'}),card(2,1000,'prep',{text:'glow booster'}),card(3,1500,'prep')],p);
 assert.deepEqual(r.items.map(x=>x.variantId),['3']);
});
test('no affordable option returns no invented fallback',()=>assert.equal(chooseRoutine([card(1,6001,'prep')],cleanProfile({budget:6000})).items.length,0));
test('a large first category cannot crowd the next routine step out of the catalogue',()=>{
 const cards=[...Array.from({length:200},(_,i)=>card(i+10,2000,'prep')),card(1,1000,'primer')];
 const r=chooseRoutine(boundCandidates(cards),cleanProfile({budget:6000}));
 assert.equal(r.items.length,2);assert.ok(r.items.some(c=>c.step==='primer'));
});
test('negative and non-numeric budgets and unknown goals are rejected',()=>{
 for(const budget of [-1,'NaN',0,100001])assert.throws(()=>cleanProfile({budget}));assert.throws(()=>cleanProfile({goal:'cure_acne'}));
});
test('medical questions route to a specialist instead of a cosmetic basket',()=>{
 assert.equal(medicalQuestion('I am pregnant and want a retinol'),true);assert.equal(medicalQuestion('أنا حامل ومحتاجة روتين'),true);assert.equal(medicalQuestion('I prefer a light finish'),false);
});
test('campaign links carry content and source attribution',()=>{
 const u=new URL(campaignUrl('W01-R1','store','prep'));assert.equal(u.searchParams.get('utm_content'),'W01-R1');assert.equal(u.searchParams.get('utm_medium'),'qr');assert.equal(u.pathname,'/pages/sofie-knows');
});

test('budget is optional and an unrestricted routine includes matches priced above 6000 EGP', () => {
 const p=cleanProfile({goal:'prep',budget:null,skin:'normal'});
 assert.equal(p.budget,null);
 const r=chooseRoutine([card(1,8900,'prep'),card(2,7800,'primer')],p);
 assert.deepEqual(r.items.map(c=>c.variantId),['1','2']);
 assert.equal(r.total,16700);
 assert.equal(cleanProfile({budget:''}).budget,null);
});
test('eye-area concern selects eye-safe category rather than generic face primer', () => {
 const p=cleanProfile({goal:'prep',faceAreas:['under_eyes'],concerns:['dark_circles']});
 assert.deepEqual(routineSteps(p),[['eye','eye-care']]);
 const r=chooseRoutine([card(1,1000,'prep'),card(2,3000,'eye',{text:'under eye brightening dark circles'})],p);
 assert.deepEqual(r.items.map(c=>c.variantId),['2']);
 assert.match(r.items[0].reasons.join(' '),/العين|eye/i);
});
test('lip-only concern chooses lip care and mixed face areas include the eye category', () => {
 const lip=cleanProfile({goal:'hydration',faceAreas:['lips'],concerns:['dry_lips']});
 assert.deepEqual(routineSteps(lip),[['lip','lip-balms-treatments-1']]);
 const both=cleanProfile({goal:'prep',faceAreas:['cheeks','under_eyes']});
 assert.ok(routineSteps(both).some(([step])=>step==='eye'));
});
test('rejects unexpected concern identifiers and excessive selections',()=>{
 assert.throws(()=>cleanProfile({faceAreas:['unknown']}),/invalid_face_areas/);
 assert.throws(()=>cleanProfile({concerns:['unknown']}),/invalid_concerns/);
 assert.throws(()=>cleanProfile({faceAreas:['forehead','cheeks','nose','lips']}),/invalid_face_areas/);
});
