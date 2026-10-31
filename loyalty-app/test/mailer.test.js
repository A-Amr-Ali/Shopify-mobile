import test from 'node:test';
import assert from 'node:assert/strict';
process.env.EMAIL_FROM='review@example.invalid';
const {sendEmail}=await import('../app/lib/agent/mailer.server.js');

async function withProvider(provider,fetcher,run){
 const previous={fetch:global.fetch,resend:process.env.RESEND_API_KEY,brevo:process.env.BREVO_API_KEY};
 delete process.env.RESEND_API_KEY;delete process.env.BREVO_API_KEY;
 process.env[provider==='resend'?'RESEND_API_KEY':'BREVO_API_KEY']='test-only';global.fetch=fetcher;
 try{await run();}finally{global.fetch=previous.fetch;for(const [k,v]of [['RESEND_API_KEY',previous.resend],['BREVO_API_KEY',previous.brevo]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
const message={to:'review@example.invalid',subject:'Test',html:'<p>Test</p>',idempotencyKey:'birthday-gift/7'};
test('Resend receives a stable idempotency key and a bounded request',async()=>{
 await withProvider('resend',async(url,options)=>{assert.equal(options.headers['Idempotency-Key'],message.idempotencyKey);assert.ok(options.signal instanceof AbortSignal);return {ok:true};},async()=>assert.equal((await sendEmail(message)).ok,true));
});
test('Brevo receives its idempotency key in the documented payload headers',async()=>{
 await withProvider('brevo',async(url,options)=>{assert.equal(JSON.parse(options.body).headers.IdempotencyKey,message.idempotencyKey);return {ok:true};},async()=>assert.equal((await sendEmail(message)).ok,true));
});
test('explicit provider rejection can retry but server ambiguity cannot be blindly replayed',async()=>{
 for(const status of [400,429,500])await withProvider('brevo',async()=>({ok:false,status}),async()=>{const r=await sendEmail(message);assert.equal(r.ok,false);assert.equal(r.ambiguous,status>=500);});
});
test('transport failures are reported as ambiguous rather than delivery success',async()=>{
 await withProvider('brevo',async()=>{throw Error('network');},async()=>{const r=await sendEmail(message);assert.equal(r.ok,false);assert.equal(r.ambiguous,true);});
});
