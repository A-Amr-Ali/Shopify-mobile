import test from 'node:test';
import assert from 'node:assert/strict';
import {planPersonalizedEmail,canQueueMarketingEmail} from '../src/sofie-email-intelligence.mjs';
const time='2026-10-15T13:00:00Z';
const campaign={category:'lip',kind:'seasonal',treatment:'campaign'};
const prof={emailMarketingConsent:'SUBSCRIBED',preferredCategories:['lip'],recentlyPurchasedHandles:['a']};
const product=(h,q=10)=>({handle:h,title:h,category:'lip',brand:'SOFIE',published:true,availableForSale:true,priceEGP:3450,sellableVariantQuantity:q,url:'https://sofiestore.net/products/'+h});
test('only recommends stocked, unpurchased products',()=>{
 const d=planPersonalizedEmail({profile:prof,products:[product('a'),product('b'),product('c',0)],campaign,now:time});
 assert.deepEqual(d.recommendations.map(x=>x.handle),['b']);assert.equal(d.sendAutomatically,false);
});
test('never targets a never-subscribed shopper',()=>{
 const d=planPersonalizedEmail({profile:{...prof,emailMarketingConsent:'NEVER_SUBSCRIBED'},products:[product('b')],campaign,now:time});
 assert.ok(d.blockers.includes('no_explicit_marketing_consent'));
});
test('respects the weekly and 72h limits',()=>{
 const history=[{status:'sent',sentAt:'2026-10-14T13:00:00Z'},{status:'sent',sentAt:'2026-10-12T13:00:00Z'}];
 const d=planPersonalizedEmail({profile:prof,products:[product('b')],campaign,sentHistory:history,now:time});
 assert.ok(d.blockers.includes('weekly_promotional_cap'));assert.ok(d.blockers.includes('promotional_spacing_72h'));
});
test('unverified viral trends and lunar holiday dates cannot send',()=>{
 const t=planPersonalizedEmail({profile:prof,products:[product('b')],campaign:{...campaign,kind:'trend'},now:time});
 const h=planPersonalizedEmail({profile:prof,products:[product('b')],campaign:{...campaign,timingConfidence:'lunar_tentative'},now:time});
 assert.ok(t.blockers.includes('insufficient_trend_evidence'));assert.ok(h.blockers.includes('holiday_date_not_confirmed'));
});
test('auto-send requires independent campaign approval and QA',()=>{
 const d=planPersonalizedEmail({profile:prof,products:[product('b')],campaign,now:time});
 assert.equal(canQueueMarketingEmail({decision:d,campaign,profile:prof}),false);
 assert.equal(canQueueMarketingEmail({decision:d,campaign:{...campaign,approved:true,qualityAssurancePassed:true,autoSendEnabled:true},profile:prof}),true);
});
test('does not infer professions from email',()=>{
 const d=planPersonalizedEmail({profile:{...prof,email:'artist@example.com'},products:[product('b')],campaign,now:time});
 assert.equal(d.professionInferred,false);
});
