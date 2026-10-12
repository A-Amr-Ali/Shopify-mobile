import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validWebhook, secretMatches, orderRecord } from '../src/security.mjs';
test('webhooks require a matching signature over the raw bytes',()=>{
 const raw=Buffer.from('{"id":1}');const sig=createHmac('sha256','secret').update(raw).digest('base64');
 assert.equal(validWebhook(raw,sig,'secret'),true);assert.equal(validWebhook(Buffer.from('{"id":2}'),sig,'secret'),false);assert.equal(validWebhook(raw,'','secret'),false);
});
test('missing admin/cron secrets never authorize',()=>{assert.equal(secretMatches('',''),false);assert.equal(secretMatches('x','secret'),false);});
test('attribution captures no customer names, contact details or addresses',()=>{
 const r=orderRecord({id:1,currency:'EGP',current_subtotal_price:'7000',financial_status:'paid',fulfillment_status:'fulfilled',email:'private@example.com',customer:{first_name:'Private'},shipping_address:{address1:'Private'},note_attributes:[{name:'sofie_campaign',value:'campaign'}]});
 assert.equal(r.net_value,7000);assert.equal(r.delivered_at,undefined);assert.equal(r.email,undefined);assert.equal(r.customer,undefined);assert.equal(r.shipping_address,undefined);
});
test('cancelled/refunded orders contribute zero net value',()=>{
 for(const x of [{cancelled_at:'2026-10-12T00:00:00Z'},{financial_status:'refunded'}])assert.equal(orderRecord({id:1,subtotal_price:'7000',note_attributes:[{name:'sofie_campaign',value:'campaign'}],...x}).net_value,0);
});
