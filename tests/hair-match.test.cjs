const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../storefront/assets/sofie-hair-engine.js');
const answers={pattern:'curly',strand:'fine',scalp:'balanced',colour:'natural',concerns:['dryness','frizz'],heat:'never',wash:'few_days',size:'essential',budget:'any'};
const variant=(patch={})=>({id:101,title:'50 mL',price:200000,available:true,now:false,...patch});
const product=(patch={})=>({handle:'fine-hair-shampoo',title:'Fine Hair Shampoo',vendor:'OUAI',type:'Hair',tags:['Hair','Shampoo'],description:'Hair Type: Straight, Wavy, Curly, and CoilyHair Texture: FineHair Concerns: Dryness, Flatness, Breakage. Key Benefits: Adds volume and hydrates hair.',variants:[variant()],...patch});

test('parses the actual catalog format without confusing pattern and strand thickness',()=>{
  const k=E.classify(product());assert.deepEqual(k.strands,['fine']);assert.deepEqual(k.patterns,['straight','wavy','curly','coily']);
  const reverse=E.classify(product({description:'Hair Type: Fine, Medium, and ThickHair Texture: Straight, Wavy, Curly, and CoilyHair Concerns: Dryness'}));
  assert.deepEqual(reverse.strands,['fine','medium','thick']);assert.deepEqual(reverse.patterns,['straight','wavy','curly','coily']);
});
test('rejects incompatible explicit strand types and patterns',()=>{
  assert.equal(E.rankProduct(product(),{...answers,strand:'thick'},'cleanse'),null);
  assert.equal(E.rankProduct(product({description:'Hair Type: Curly and CoilyHair Texture: FineHair Concerns: Dryness'}),{...answers,pattern:'straight'},'cleanse'),null);
  assert.ok(E.rankProduct(product(),answers,'cleanse'));
});
test('does not infer fine hair compatibility from fine lines in unrelated copy',()=>{
  const k=E.classify(product({title:'Hydrating Shampoo',description:'Hair Type: Straight, Wavy, Curly, and CoilyHair Texture: ThickHair Concerns: Dryness. Key Benefits: Smooths lengths. Ingredients: Reduces fine lines.'}));
  assert.deepEqual(k.strands,['thick']);
});
test('excludes pet shampoo, fragrance, supplements and dry shampoo from cleansing',()=>{
  for(const title of ['Pet Shampoo','Hair & Body Fragrance Mist','Hair Growth Vitamin Gummies','Dry Shampoo','Dry Shampoo Powder','Dry Shampoo Mist'])assert.equal(E.classify(product({title})),null,title);
});
test('pre-shampoo treatments cannot fill the shampoo step',()=>{
  const p=product({title:'Snag-Free Pre-Shampoo Detangler For Curly Hair',description:'A pre-shampoo treatment. Hair Type: Curly and CoilyHair Texture: Fine, Medium, ThickHair Concerns: Dryness'});
  assert.equal(E.classify(p).slot,'treat');assert.equal(E.rankProduct(p,answers,'cleanse'),null);
});
test('uses a purchasable variant within budget even when the cheapest size is sold out',()=>{
  const p=product({variants:[variant({id:1,price:100000,available:false}),variant({id:2,price:250000}),variant({id:3,price:400000})]});
  const pick=E.rankProduct(p,{...answers,budget:'300000'},'cleanse');assert.equal(pick.variant.id,2);
  assert.equal(E.rankProduct(p,{...answers,budget:'200000'},'cleanse'),null);
});
test('SOFIE NOW filtering applies to the exact available option',()=>{
  const p=product({variants:[variant({id:1,now:false,price:150000}),variant({id:2,now:true,price:500000}),variant({id:3,now:true,available:false,price:100000})]});
  assert.equal(E.rankProduct(p,answers,'cleanse',true).variant.id,2);
  assert.equal(E.rankProduct(p,{...answers,budget:'300000'},'cleanse',true),null);
  assert.equal(E.rankProduct(p,answers,'cleanse',false).variant.id,1);
});
test('no budget answer leaves budget optional, without a minimum spend',()=>{
  const p=product({variants:[variant({price:900000})]});assert.ok(E.rankProduct(p,{...answers,budget:undefined},'cleanse'));
});
test('purple toning needs both suitable colour and an explicit brassiness concern',()=>{
  const p=product({title:'Purple Toning Shampoo',description:'Hair Type: Straight, Wavy, Curly, CoilyHair Texture: Fine, Medium, ThickHair Concerns: Brassiness and colour safe'});
  assert.equal(E.rankProduct(p,answers,'cleanse'),null);
  assert.equal(E.rankProduct(p,{...answers,colour:'blonde'},'cleanse'),null);
  assert.ok(E.rankProduct(p,{...answers,colour:'blonde',concerns:['brass']},'cleanse'));
  assert.equal(E.rankProduct(p,{...answers,colour:'natural',concerns:['brass']},'cleanse'),null);
});
test('an air-dry profile excludes heat-activated Dream Coat',()=>{
  const p=product({title:'Dream Coat Supernatural Spray',description:'All hair types. Anti-frizz treatment activated by heat.'});
  assert.equal(E.rankProduct(p,answers,'focus'),null);
  assert.ok(E.rankProduct(p,{...answers,heat:'sometimes'},'focus'));
});
test('sudden hair loss or a painful scalp stops product recommendations',()=>{
  for(const a of [{...answers,scalp:'pain'},{...answers,concerns:['sudden_loss']}]){
    const r=E.recommend([product()],a);assert.equal(r.safety,'refer');assert.deepEqual(r.rows,[]);
  }
});
test('sensitive scalp leaves cleanser choice open and excludes medicated products',()=>{
  const r=E.recommend([product()],{...answers,scalp:'sensitive'});assert.equal(r.safety,'caution');assert.ok(r.missing.includes('cleanse'));
  assert.equal(E.rankProduct(product({title:'Anti-Dandruff Shampoo'}),{...answers,scalp:'flakes'},'cleanse'),null);
});
test('clarifying shampoo is considered only for an oily scalp with buildup',()=>{
  const p=product({title:'Detox Clarifying Shampoo'});
  assert.equal(E.rankProduct(p,answers,'cleanse'),null);
  assert.equal(E.rankProduct(p,{...answers,scalp:'dry',concerns:['buildup']},'cleanse'),null);
  assert.ok(E.rankProduct(p,{...answers,scalp:'oily',concerns:['buildup']},'cleanse'));
});
test('K18 mask gets its own placement before conditioner and has no growth promise',()=>{
  const mask=product({handle:'leave-in-molecular-repair-hair-mask',title:'leave-in molecular repair hair mask',vendor:'K18 Biomimetic Hairscience',description:'Hair Type: Fine, Medium, ThickHair Texture: Straight, Wavy, Curly, CoilyHair Concerns: Damage and breakage. Key Benefits: Repair.'});
  const conditioner=product({handle:'fine-conditioner',title:'Fine Hair Conditioner'});
  const r=E.recommend([product(),conditioner,mask],{...answers,concerns:['damage']});
  assert.equal(r.rows[1].picks[0].knowledge.k18,true);assert.equal(r.rows[2].slot,'condition');
});
test('does not invent a fallback when stock, price or eligibility leaves a gap',()=>{
  const r=E.recommend([product({variants:[variant({available:false})]})],answers);
  assert.equal(r.count,0);assert.ok(r.missing.includes('cleanse'));
  assert.equal(E.recommend([product()],answers,{nowOnly:true}).count,0);
});
test('requires an explicit protection claim for the heat step',()=>{
  const oil=product({handle:'hair-oil',title:'Hair Oil',description:'Hair Type: Fine, Medium, ThickHair Texture: Straight, Wavy, Curly, CoilyHair Concerns: Frizz'});
  assert.equal(E.rankProduct(oil,{...answers,heat:'often'},'protect'),null);
  const protect=product({title:'Heat Protection Spray',description:'All hair types. Heat protection for styling.'});
  assert.ok(E.rankProduct(protect,{...answers,heat:'often'},'protect'));
});
