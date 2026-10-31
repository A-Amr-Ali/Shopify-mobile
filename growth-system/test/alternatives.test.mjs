import test from 'node:test';
import assert from 'node:assert/strict';
import { routineAlternatives,cleanProfile } from '../src/engine.mjs';
const base={step:'prep',variantId:'1',handle:'selected',title:'Selected',price:100,rank:0,text:'gentle sensitive skin hydration',variantTitle:'50 ml'};
test('routine swaps retain sensitive-skin filters and omit catalogue text',()=>{
 const p=cleanProfile({skin:'sensitive',lang:'en'});
 const out=routineAlternatives([{...base,handle:'acid',variantId:'2',text:'salicylic exfoliating gentle'},{...base,handle:'gentle',variantId:'3'},{...base,handle:'unknown',variantId:'4',text:'luxury glow'}],p,[base]);
 assert.deepEqual(out.map(p=>p.handle),['gentle']);assert.equal(out[0].text,undefined);assert.ok(out[0].reasons.length);
});
test('routine swaps respect the total remaining budget and deduplicate product options',()=>{
 const p=cleanProfile({budget:400,lang:'en'});const other={...base,step:'primer',price:200};
 const out=routineAlternatives([{...base,handle:'fits',variantId:'2',price:200},{...base,handle:'fits',variantId:'3',price:150},{...base,handle:'too-much',variantId:'4',price:201}],p,[base,other]);
 assert.equal(out.length,1);assert.equal(out[0].handle,'fits');assert.ok(out[0].price+other.price<=400);
});
