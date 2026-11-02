import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../storefront/assets/sofie-journey.js',import.meta.url),'utf8');
const deviceKey = 'sofie-passport-v1';
const item = (handle, variantId) => ({handle,variantId,title:handle,included:true});

function client({device,account=null,version=0,loggedIn=true,reject=false,conflict=false}={}) {
  const values = new Map(device ? [[deviceKey,JSON.stringify(device)]] : []);
  const storage = {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
  const writes = [];
  let reads = 0;
  const document = {
    getElementById:()=>({textContent:JSON.stringify({loggedIn,root:'/',proxy:'/apps/loyalty/passport',strings:{conflict:'reload',save_error:'save failed',import_limit:'too many options'}})}),
    createElement:()=>({set innerHTML(value){this.value=value;}}),
    querySelector:()=>null,
    addEventListener:()=>{}
  };
  const window = {};
  vm.runInNewContext(source,{document,window,location:{search:''},URLSearchParams,localStorage:storage,sessionStorage:storage,crypto:{randomUUID:()=> 'qa'},fetch:async(_url,init={})=>{
    if (init.method !== 'POST') {
      reads++;
      return new Response(JSON.stringify({passport:account,version:conflict && reads > 1 ? version + 1 : version}));
    }
    const body = JSON.parse(init.body); writes.push(body);
    return new Response(JSON.stringify(reject ? {error:'temporarily_unavailable'} : {passport:body.passport,version:version+1}),{status:reject ? 503 : 200});
  }});
  return {passport:window.SofiePassport,values,writes};
}

test('guest Passport moves to an empty account only after an explicit import succeeds',async()=>{
  const device={preferences:{skin:'dry',budget:null},saved:[item('mini','123')],routine:[item('cream','456')],match:{mode:'base',a:{skin:'dry'}}};
  const c=client({device});
  assert.equal(c.writes.length,0);
  const saved=await c.passport.importDevice({expectedVersion:0});
  assert.equal(saved.passport.preferences.skin,'dry');
  assert.equal(saved.passport.routine[0].variantId,'456');
  assert.equal(saved.passport.match.mode,'base');
  assert.equal(c.writes[0].consent,true);
  assert.equal(c.values.has(deviceKey),false);
});

test('import preserves account choices and distinct exact options while deduplicating saves',async()=>{
  const c=client({version:4,account:{preferences:{skin:'oily',budget:null},routine:[item('account-routine','300')],saved:[item('same','100')],match:{mode:'lips',a:{finish:'matte'}}},device:{preferences:{skin:'dry',budget:5000,area:'new_cairo'},routine:[item('device-routine','400')],saved:[item('same','100'),item('same','200')],match:{mode:'base',a:{skin:'dry'}}}});
  const saved=await c.passport.importDevice({expectedVersion:4});
  assert.equal(saved.passport.preferences.skin,'oily');
  assert.equal(saved.passport.preferences.budget,null);
  assert.equal(saved.passport.preferences.area,'new_cairo');
  assert.equal(saved.passport.routine[0].handle,'account-routine');
  assert.equal(saved.passport.match.mode,'lips');
  assert.deepEqual(saved.passport.saved.map(x=>x.variantId),['100','200']);
  assert.equal(c.writes[0].expectedVersion,4);
});

test('a failed save or concurrent account edit retains the device copy for retry',async()=>{
  const device={saved:[item('mini','123')]};
  const failed=client({device,reject:true});
  await assert.rejects(failed.passport.importDevice(),/save failed/);
  assert.equal(failed.values.has(deviceKey),true);
  const stale=client({device,version:5,conflict:true});
  await assert.rejects(stale.passport.importDevice({expectedVersion:5}),/reload/);
  assert.equal(stale.writes.length,0);
  assert.equal(stale.values.has(deviceKey),true);
});

test('guest sessions cannot invoke an account import',async()=>{
  const c=client({device:{saved:[item('mini','123')]},loggedIn:false});
  await assert.rejects(c.passport.importDevice(),/save failed/);
  assert.equal(c.writes.length,0);
  assert.equal(c.values.has(deviceKey),true);
});

test('combined saves over the limit are retained on the device without a partial import',async()=>{
  const c=client({account:{saved:Array.from({length:100},(_,i)=>item('saved-'+i,String(i+1)))},device:{saved:[item('another','999')]}});
  await assert.rejects(c.passport.importDevice(),/too many options/);
  assert.equal(c.writes.length,0);
  assert.equal(c.values.has(deviceKey),true);
});
