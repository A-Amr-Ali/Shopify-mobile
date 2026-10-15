import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProfile, normalizeFeed, chooseRoutine, medicalQuestion, campaignUrl } from '../src/engine.mjs';
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

test('a missing or blank budget means no spending ceiling',()=>{
  for (const budget of [undefined, null, '']) {
    const p = cleanProfile({goal:'prep', budget});
    assert.equal(p.budget, null);
    const result = chooseRoutine([card(401, 125000, 'prep')], p);
    assert.deepEqual(result.items.map(c => c.variantId), ['401']);
    assert.equal(result.total, 125000);
  }
});
test('face areas and concerns are normalized and validated',()=>{
  const p = cleanProfile({faceAreas:['under-eyes','cheeks'],concerns:['dark-circles','dryness']});
  assert.deepEqual(p.faceAreas,['under-eyes','cheeks']);
  assert.deepEqual(p.concerns,['dark-circles','dryness']);
  assert.throws(()=>cleanProfile({faceAreas:['unknown']}),/invalid_face_areas/);
  assert.throws(()=>cleanProfile({concerns:['cure-disease']}),/invalid_concerns/);
  assert.throws(()=>cleanProfile({faceAreas:['nose','cheeks','lips','forehead']}),/invalid_face_areas/);
});
test('choosing under-eye adds relevant eye-care while keeping available general steps',()=>{
  const p=cleanProfile({goal:'prep',faceAreas:['under-eyes'],concerns:['dark-circles']});
  const cards=[card(2,2000,'prep'),card(3,1400,'eye',{text:'under eye cream for dark circles with caffeine'})];
  const result=chooseRoutine(cards,p);
  assert.ok(result.items.some(c=>c.step==='eye'));
  assert.ok(result.items.some(c=>c.step==='prep'));
  assert.ok(result.items.find(c=>c.step==='eye').reasons.some(x=>x.includes('المنطقة')||x.includes('اهتمامك')));
});
