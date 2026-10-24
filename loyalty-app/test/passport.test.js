import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { cleanPassport, verifyPassportRequest } from '../app/lib/passport-core.js';

function request(overrides = {}) {
  const params = new URLSearchParams({ shop: 'a45545-2.myshopify.com', logged_in_customer_id: '123', timestamp: '1792144800', ...overrides });
  const message = [...params.keys()].sort().map(k => k + '=' + params.getAll(k).join(',')).join('');
  params.set('signature', createHmac('sha256','test-secret').update(message).digest('hex'));
  return new Request('https://app.example/apps/loyalty/passport?' + params);
}
const check = r => verifyPassportRequest(r, 'test-secret', 'a45545-2.myshopify.com', 1792144800000);
test('Passport uses the signed owner, shop and a fresh proxy timestamp', () => {
  assert.equal(check(request()).customerId, 'gid://shopify/Customer/123');
  assert.equal(check(request({ timestamp:'1' })).ok, false);
  assert.equal(check(request({ shop:'someone-else.myshopify.com' })).ok, false);
  assert.equal(check(request({ logged_in_customer_id:'1&admin=true' })).ok, false);
  assert.equal(verifyPassportRequest(request(), '', 'a45545-2.myshopify.com', 1792144800000).ok, false);
  const tampered = request(); const url = new URL(tampered.url); url.searchParams.set('logged_in_customer_id','456');
  assert.equal(check(new Request(url)).ok, false);
});
test('Passport keeps exact options but drops prices, customer IDs and unstructured notes', () => {
  const p = cleanPassport({ customerId:'someone-else',preferences:{skin:'dry',note:'private text',budget:null},saved:[{handle:'lip-tint',variantId:'42588307259463',price:1}],routine:[{handle:'lip-tint',variantId:'42588307259463',included:false}],match:{mode:'base',a:{skin:'dry',note:'private text',tone:'warm'}} });
  assert.equal(p.saved[0].variantId, '42588307259463'); assert.equal(p.saved[0].price, undefined);
  assert.equal(p.customerId, undefined); assert.equal(p.preferences.note, undefined); assert.equal(p.match.a.note, undefined);
  assert.equal(p.routine[0].included,false); assert.equal(p.preferences.budget,null);
  assert.throws(()=>cleanPassport({saved:[{handle:'../orders',variantId:'1'}]}),/invalid_item/);
  assert.throws(()=>cleanPassport({routine:[{handle:'valid',variantId:'bad'}]}),/invalid_item/);
  assert.throws(()=>cleanPassport({preferences:{budget:-1}}),/invalid_budget/);
});
