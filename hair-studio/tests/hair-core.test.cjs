const test=require('node:test');const assert=require('node:assert/strict');const core=require('../theme/assets/sofie-hair-core.js');
const v=(id,price=250000,available=true,ready=false)=>({id,title:'Full size',price,available,ready});
const p=(id,title,tags=[],description='',variants=[v(id)])=>({id,handle:'item-'+id,title,tags,description,vendor:'Brand',variants});
const base={texture:'wavy',strand:'fine',scalp:'balanced',concerns:['dryness'],colour:'natural',heat:'never',budget:'500000',speed:'all'};
test('unavailable, over-budget, perfume, supplement and dry shampoo are excluded',()=>{
 const products=[p(1,'Hydrating Shampoo',[], '',[v(1)]),p(2,'Hydrating Shampoo',[], '',[v(2,900000)]),p(3,'Hydrating Shampoo',[], '',[v(3,200000,false)]),p(4,'Hair and Body Perfume Mist',['Hair']),p(5,'Hair Gummies',['Hair']),p(6,'Dry Shampoo',['Hair'])];
 assert.deepEqual(core.rank(products,base,'cleanse').map(x=>x.id),[1]);assert.equal(core.describe(products[3]),null);assert.equal(core.describe(products[4]),null);assert.equal(core.describe(products[5]),null);
});
test('NOW is selected-variant specific and does not relax budget',()=>{
 const product=p(1,'Hydrating Shampoo',[], '',[v(1,250000,true,false),v(2,400000,true,true),v(3,600000,true,true)]);
 const out=core.rank([product],{...base,speed:'now'},'cleanse');assert.deepEqual(out[0].eligible.map(x=>x.id),[2]);assert.equal(out[0].variant.id,2);
});
test('pattern and strand thickness both affect the result',()=>{
 const items=[p(1,'Rich Curl Cream',[],'For thick coarse hair, curl definition and frizz.'),p(2,'Weightless Curl Cream',[],'For fine hair, curl definition and frizz.')];
 assert.equal(core.rank(items,{...base,concerns:['curls'],strand:'fine'},'style')[0].id,2);
 assert.equal(core.rank(items,{...base,concerns:['curls'],strand:'coarse'},'style')[0].id,1);
});
test('sensitive scalp does not receive an unverified or clarifying cleanser',()=>{
 const items=[p(1,'Hydrating Shampoo'),p(2,'Fragrance-Free Gentle Shampoo'),p(3,'Fragrance-Free Detox Shampoo')];
 assert.deepEqual(core.rank(items,{...base,scalp:'sensitive',concerns:['buildup']},'cleanse').map(x=>x.id),[2]);
});
test('toning requires both the concern and appropriate colour answer',()=>{
 const items=[p(1,'Purple Toning Shampoo')];assert.equal(core.rank(items,base,'cleanse').length,0);
 assert.equal(core.rank(items,{...base,colour:'lightened'},'cleanse').length,0);
 assert.equal(core.rank(items,{...base,colour:'lightened',concerns:['tone']},'cleanse').length,1);
});
test('K18 is a treatment and OLAPLEX 3 is a prewash, not a conditioner',()=>{
 const mask={...p(1,'leave-in molecular repair hair mask'),vendor:'K18 Biomimetic Hairscience'};
 const no3={...p(2,'Nº.3 HAIR PERFECTOR'),vendor:'Olaplex'};
 assert.equal(core.describe(mask).k18,true);assert.equal(core.describe(mask).category,'repair');assert.equal(core.describe(no3).no3,true);
 assert.equal(core.rank([mask,no3],base,'repair').length,0);assert.equal(core.rank([mask,no3],{...base,concerns:['damage']},'repair').length,2);
});
test('scalp red flags stop product recommendations',()=>{assert.deepEqual(core.routine([p(1,'Shampoo')],{...base,scalp:'seek_help'}),[]);});
test('a missing match remains empty rather than relaxing limits',()=>{assert.equal(core.rank([p(1,'Shampoo',[], '',[v(1,600000)])],{...base,speed:'now'},'cleanse').length,0);});
