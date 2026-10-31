import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverBirthdayGift } from '../app/lib/birthday-delivery.server.js';

function fixture() {
  const row={id:7,status:'available',email_status:'pending',email_attempts:0,egp_value:300};
  const state={sends:0,failWrite:false};
  const db={
    async rpc(){if(row.email_status!=='pending')return {data:false};row.email_status='sending';row.email_attempts++;return {data:true};},
    from(){return {update(patch){const q={eq(){return q;},async select(){if(state.failWrite)return {error:{message:'offline'}};Object.assign(row,patch);return {data:[{id:row.id}]};},then(resolve){Object.assign(row,patch);return Promise.resolve({}).then(resolve);}};return q;}};},
  };
  const args={db,gift:row,customer:{email:'review@example.invalid',first_name:'Review'},render:()=>'<p>Test</p>',send:async()=>{state.sends++;return {ok:true};}};
  return {row,state,args};
}
test('acknowledged delivery is recorded once and repeat runs do not send again',async()=>{
  const {row,state,args}=fixture();
  assert.equal((await deliverBirthdayGift(args)).outcome,'sent');
  assert.equal(row.email_status,'sent');assert.ok(row.emailed_at);
  assert.equal((await deliverBirthdayGift(args)).outcome,'skipped');assert.equal(state.sends,1);
});
test('a provider rejection remains retryable and is never reported as sent',async()=>{
  const {row,args}=fixture();args.send=async()=>({ok:false});
  assert.equal((await deliverBirthdayGift(args)).outcome,'failed');assert.equal(row.email_status,'pending');assert.equal(row.emailed_at,undefined);
  args.send=async()=>({ok:true});assert.equal((await deliverBirthdayGift(args)).outcome,'sent');assert.equal(row.email_attempts,2);
});
test('rendering failure releases the claim without contacting the provider',async()=>{
  const {row,state,args}=fixture();args.render=()=>{throw Error('template');};
  assert.equal((await deliverBirthdayGift(args)).outcome,'failed');assert.equal(row.email_status,'pending');assert.equal(state.sends,0);
});
test('an unknown provider outcome is quarantined instead of sending duplicates',async()=>{
  const {row,args}=fixture();args.send=async()=>{throw Error('timeout');};
  assert.equal((await deliverBirthdayGift(args)).outcome,'failed');assert.equal(row.email_status,'needs_review');
  assert.equal((await deliverBirthdayGift(args)).outcome,'skipped');
});
test('provider acceptance followed by database failure is not counted as sent',async()=>{
  const {row,state,args}=fixture();state.failWrite=true;
  assert.equal((await deliverBirthdayGift(args)).outcome,'failed');assert.equal(row.email_status,'sending');assert.equal(state.sends,1);
});
test('simultaneous workers cannot both deliver the same gift',async()=>{
  const {state,args}=fixture();const r=await Promise.all([deliverBirthdayGift(args),deliverBirthdayGift(args)]);
  assert.equal(r.filter(x=>x.outcome==='sent').length,1);assert.equal(state.sends,1);
});
test('a missing or unavailable entitlement cannot initiate a delivery',async()=>{
  const {state,args}=fixture();args.gift={id:7,status:'issued_store'};
  assert.equal((await deliverBirthdayGift(args)).outcome,'skipped');assert.equal(state.sends,0);
});
