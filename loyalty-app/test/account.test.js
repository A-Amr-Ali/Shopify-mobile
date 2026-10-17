import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountPagination, deliveryFromOrder, orderForCustomer, safeHttps } from '../app/lib/account-core.js';
import { customerOrders, customerOrderItems, customerPoints } from '../app/lib/account.server.js';

const customerId = 'gid://shopify/Customer/123';
const fee = { title: 'SOFIE NOW Express Delivery', variantTitle: '60 minutes', product: { handle: 'sofie-now-express-delivery' } };
const order = overrides => ({ id: 'gid://shopify/Order/456', name: '#1001', displayFinancialStatus: 'PAID', displayFulfillmentStatus: 'UNFULFILLED', customAttributes: [], lineItems: {nodes:[]}, shippingLines: {nodes:[]}, fulfillments: [], ...overrides });
const admin = data => async () => ({ graphql: async () => ({ ok: true, json: async () => ({ data }) }) });

test('NOW delivery uses checkout evidence, never current product eligibility or area alone', () => {
  const standard = order({ customAttributes: [{ key: 'SOFIE NOW area', value: 'New Cairo' }], lineItems: { nodes: [{ title: 'Blush', product: {handle:'blush', tags:['SOFIE NOW']} }] } });
  assert.equal(deliveryFromOrder(standard).mode, 'standard');
  const requested = deliveryFromOrder(order({ customAttributes: [{ key: 'SOFIE NOW requested', value: 'Yes' }] }));
  assert.equal(requested.mode, 'standard');
  assert.equal(requested.requested, true);
  assert.equal(deliveryFromOrder(order({lineItems:{nodes:[fee]}})).mode, 'now');
});

test('mixed NOW delivery and pickup retain their own service records', () => {
  const mixed=deliveryFromOrder(order({lineItems:{nodes:[fee]},customAttributes:[{key:'SOFIE NOW fee',value:'60 min (standard for other items)'},{key:'SOFIE NOW area',value:'Nasr City'}]}));
  assert.equal(mixed.mixed,true);
  assert.equal(mixed.area,'Nasr City');
  assert.equal(deliveryFromOrder(order({lineItems:{nodes:[{...fee,variantTitle:'Store pickup'}]}})).mode,'pickup');
});

test('a successful fulfillment is not reported as delivered without delivery evidence', () => {
  const result=orderForCustomer(order({displayFulfillmentStatus:'FULFILLED',fulfillments:[{status:'SUCCESS',displayStatus:'IN_TRANSIT',events:{nodes:[]}}]}));
  assert.equal(result.stage,'dispatched');
  assert.equal(orderForCustomer(order({displayFulfillmentStatus:'FULFILLED',fulfillments:[{status:'SUCCESS',displayStatus:'DELIVERED',events:{nodes:[]}}]})).stage,'delivered');
});

test('one delivered parcel does not mark a partially fulfilled order delivered', () => {
  const result=orderForCustomer(order({displayFulfillmentStatus:'PARTIALLY_FULFILLED',fulfillments:[{status:'SUCCESS',displayStatus:'DELIVERED',events:{nodes:[]}}]}));
  assert.equal(result.stage,'partially_dispatched');
  assert.equal(orderForCustomer(order({cancelledAt:'2026-10-17T12:00:00Z'})).stage,'cancelled');
});

test('customer order payload excludes internal tags, notes, and attributes', () => {
  const result=orderForCustomer(order({tags:['private'],customAttributes:[{key:'staff-note',value:'private'}],note:'private',lineItems:{nodes:[fee,{id:'line2',title:'Blush',quantity:1}]}}));
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].title,'Blush');
  assert.ok(!JSON.stringify(result).includes('private'));
});

test('carrier and image links reject scripts, unsafe protocols and embedded credentials', () => {
  for(const url of ['javascript:alert(1)','data:text/html,hello','http://carrier.test','https://user:pass@carrier.test']) assert.equal(safeHttps(url),null);
  assert.equal(safeHttps('https://carrier.test/track?id=1'),'https://carrier.test/track?id=1');
});

test('pagination rejects duplicated controls and invalid order identifiers', () => {
  for(const query of ['view=orders&view=points','before=-1','after=%3Cscript%3E','view=items&orderId=123']) assert.throws(()=>accountPagination(new URL('https://store.test/?'+query)));
  assert.deepEqual(accountPagination(new URL('https://store.test/?view=points&before=20')), {view:'points',after:null,before:'20',orderId:null});
});

test('order history query takes its owner exclusively from verified server input', async () => {
  let variables;
  const result=await customerOrders(customerId,'cursor',async()=>({graphql:async(q,opts)=>{
    variables=opts.variables;
    assert.match(q,/customer\(id: \$customerId\)/);
    return {ok:true,json:async()=>({data:{customer:{id:customerId,firstName:'Test',numberOfOrders:'0',orders:{nodes:[],pageInfo:{hasNextPage:false}}},currentAppInstallation:{accessScopes:[]}}})};
  }}));
  assert.deepEqual(variables,{customerId,after:'cursor'});
  assert.equal(result.fullHistory,false);
  await assert.rejects(()=>customerOrders(customerId,null,admin({customer:{id:'gid://shopify/Customer/999'}})),/customer_unavailable/);
});

test('order detail pagination never returns another customer’s items', async () => {
  await assert.rejects(()=>customerOrderItems(customerId,'gid://shopify/Order/456',null,admin({order:{id:'gid://shopify/Order/456',customer:{id:'gid://shopify/Customer/999'},lineItems:{nodes:[{title:'Private item'}]}}})),/order_unavailable/);
  const owned=await customerOrderItems(customerId,'gid://shopify/Order/456',null,admin({order:{customer:{id:customerId},lineItems:{nodes:[{title:'Owned item',quantity:1}],pageInfo:{hasNextPage:false}}}}));
  assert.equal(owned.items[0].title,'Owned item');
});

test('points pagination stays customer scoped and returns a continuation without losing rows', async () => {
  const calls=[];
  const query={select(v){calls.push(['select',v]);return this;},eq(k,v){calls.push(['eq',k,v]);return this;},order(){return this;},limit(){return this;},lt(k,v){calls.push(['lt',k,v]);return this;},then(resolve){return Promise.resolve({data:Array.from({length:21},(_,i)=>({id:100-i,delta:5})),error:null}).then(resolve);}};
  const result=await customerPoints(customerId,'101',{from:()=>query});
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='customer_id'&&c[2]===customerId));
  assert.ok(calls.some(c=>c[0]==='lt'&&c[1]==='id'&&c[2]==='101'));
  assert.equal(result.rows.length,20);
  assert.equal(result.hasMore,true);
  assert.equal(result.before,'81');
});
