import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const source=await readFile(new URL('../../storefront/assets/sofie-for-you.js',import.meta.url),'utf8');
function browser({consent=false,storage={},fetcher}={}) {
 const calls=[],listeners={},timers=[],local=new Map(Object.entries(storage));
 const store={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const document={hidden:false,getElementById:()=>({textContent:JSON.stringify({api:'https://api.test',root:'/',strings:{},variant:'123'})}),querySelector:()=>null,
  addEventListener:(k,fn)=>listeners[k]=fn};
 const p={analyticsProcessingAllowed:()=>consent,preferencesProcessingAllowed:()=>consent};
 const window={Shopify:{customerPrivacy:p,loadFeatures:(_,fn)=>fn()},addEventListener:(k,fn)=>listeners[k]=fn};
 const context={window,document,localStorage:store,sessionStorage:{...store},crypto:{randomUUID},AbortSignal,
  setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},fetch:async(url,options)=>{
   const data=JSON.parse(options.body);calls.push({url,data});
   if(fetcher)return fetcher(url,data);
   return{ok:true,json:async()=>url.endsWith('/visitor')?{token:'issued-token',expiresIn:1000}:{recorded:true}};
  }};
 vm.runInNewContext(source,context);
 return {calls,listeners,timers,local,p,window,settle:()=>new Promise(r=>setImmediate(r))};
}
test('browser sends and stores no identity before permitted analytics and preferences',async()=>{
 const b=browser();await b.settle();assert.equal(b.calls.length,0);assert.equal(b.local.size,0);
});
test('returning consented browser reuses its visitor identity, never a customer ID',async()=>{
 const b=browser({consent:true,storage:{'sofie-for-you-v1':JSON.stringify({token:'existing',expires:Date.now()+100000})}});
 await b.settle();assert.equal(b.calls.length,0);
 b.timers[0]();await b.settle();
 assert.equal(b.calls[0].data.token,'existing');assert.equal(b.calls[0].data.events[0].variantId,'123');
 assert.equal(b.calls[0].data.customerId,undefined);
});
test('an in-flight visitor response cannot recreate identity after consent withdrawal',async()=>{
 let resolve;
 const b=browser({consent:true,fetcher:async(url)=>url.endsWith('/visitor')?new Promise(r=>resolve=r):{ok:true,json:async()=>({forgotten:true})}});
 await b.settle();b.listeners['sofie:measurement']({detail:{allowed:false}});
 resolve({ok:true,json:async()=>({token:'late-token',expiresIn:1000})});await b.settle();
 assert.equal(JSON.parse(b.local.get('sofie-for-you-v1')),null);
 assert.equal(b.calls.some(x=>x.url.endsWith('/events')),false);
});
