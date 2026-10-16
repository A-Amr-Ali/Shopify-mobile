import test from 'node:test';
import assert from 'node:assert/strict';
import {costEstimate,kilograms,routeLine,normalizeOrder,allowedSource,chooseSource,validSource,recheckSource,exportCsv} from '../src/procurement.mjs';
import {sessionToken,checkSession,procurementRoutes} from '../src/procurement-routes.mjs';

test('requested market formulas include fee before conversion and margin on every piece',()=>{
  assert.equal(costEstimate('AE',100,0.2,3).targetEgp,2225);
  assert.equal(costEstimate('AE',100,0.2,3).totalTargetEgp,6675);
  assert.equal(costEstimate('US',100,0.2).targetEgp,6665);
  assert.equal(costEstimate('UK',100,0.2).targetEgp,8725);
  assert.equal(costEstimate('US',100,null).targetEgp,null);
  assert.equal(costEstimate('UK',100,0).landedEgp,null);
  assert.equal(costEstimate('AE',-1,0.1),null);
  assert.equal(costEstimate('CA',10,0.2),null);
});
test('shipping weights are normalized from Shopify units; zero is missing',()=>{
  assert.equal(kilograms({value:250,unit:'GRAMS'}),0.25);
  assert.equal(kilograms({value:1,unit:'POUNDS'}),0.4536);
  assert.equal(kilograms({value:0,unit:'KILOGRAMS'}),null);
});
const item=()=>({id:'fo-line',productTitle:'Example',variantTitle:'Pink / 10 ml',vendor:'Rhode',remainingQuantity:2,totalQuantity:3,
  weight:{value:0,unit:'KILOGRAMS'},variant:{id:'gid://shopify/ProductVariant/10',selectedOptions:[]},lineItem:{id:'gid://shopify/LineItem/20',unfulfilledQuantity:2,customAttributes:[],
    product:{id:'p',handle:'example',tags:[],collections:{nodes:[],pageInfo:{hasNextPage:false}}},discountedUnitPriceAfterAllDiscountsSet:{shopMoney:{amount:'2000',currencyCode:'EGP'}}}});
test('explicit source and staff override take priority; exact options prevent product-level stock assumptions',()=>{
  const line=item();assert.equal(routeLine(line,'Reglare Store').kind,'regular');assert.equal(routeLine(line,'Sofie').kind,'sofie');
  assert.equal(routeLine(line,'Sofie','regular').kind,'regular');
  line.lineItem.product.nowVariants={jsonValue:['gid://shopify/ProductVariant/99']};assert.equal(routeLine(line,'New Cairo City').kind,'regular');
  line.lineItem.product.nowVariants.jsonValue.push(line.variant.id);assert.equal(routeLine(line,'New Cairo City').kind,'sofie');
  line.lineItem.product.nowVariants={jsonValue:[]};line.lineItem.product.collections.nodes=[{handle:'sofie-hours'}];assert.equal(routeLine(line,'New Cairo City').kind,'review');
});
test('remaining quantities exclude fulfilled pieces, cancelled fulfillment orders and completed orders',()=>{
  const order={id:'o',name:'#1',createdAt:'2026-10-16T00:00:00Z',updatedAt:'2026-10-16T00:00:00Z',displayFulfillmentStatus:'PARTIALLY_FULFILLED',
    fulfillmentOrders:{nodes:[{id:'fo',status:'OPEN',assignedLocation:{name:'New Cairo City'},lineItems:{nodes:[item(),{...item(),remainingQuantity:0}]}},{id:'closed',status:'CLOSED',lineItems:{nodes:[item()]}}]}};
  const n=normalizeOrder(order);assert.equal(n.active,true);assert.equal(n.lines.length,1);assert.equal(n.lines[0].quantity,2);
  assert.equal(normalizeOrder({...order,displayFulfillmentStatus:'FULFILLED'}).active,false);
  assert.equal(normalizeOrder({...order,cancelledAt:'2026-10-16'}).active,false);
  assert.equal(normalizeOrder({...order,test:true}).active,false);
  assert.equal(n.lines[0].weightKg,null);
});
const now=Date.now();
const source=(region,patch={})=>({region,currency:{AE:'AED',US:'USD',UK:'GBP'}[region],url:{AE:'https://www.sephora.me/ae-en/p/test',US:'https://www.sephora.com/product/test',UK:'https://www.sephora.co.uk/p/test'}[region],price:20,exact_match:true,stock_status:'in_stock',verified_at:new Date(now).toISOString(),...patch});
test('country priority is UAE, US, UK; stale, wrong-currency and approximate matches never qualify',()=>{
  assert.equal(chooseSource([source('US'),source('UK'),source('AE')],'Rhode',now).region,'AE');
  assert.equal(chooseSource([source('US'),source('AE',{stock_status:'out_of_stock'})],'Rhode',now).region,'US');
  assert.equal(chooseSource([source('US',{exact_match:false}),source('UK')],'Rhode',now).region,'UK');
  assert.equal(validSource(source('AE',{currency:'USD'}),now),false);
  assert.equal(validSource(source('AE',{verified_at:new Date(now-13*3600000).toISOString()}),now),false);
  assert.equal(validSource(source('AE',{verified_at:new Date(now+3600000).toISOString()}),now),false);
});
test('only official hosts for the actual brand and correct Sephora market are allowed',()=>{
  assert.equal(allowedSource('https://www.rhodeskin.com/products/test','Rhode','US'),true);
  for(const url of ['https://rhodeskin.com.attacker.com/p','http://rhodeskin.com/p','https://u:p@rhodeskin.com/p','https://127.0.0.1/p','https://amazon.com/p'])assert.equal(allowedSource(url,'Rhode','US'),false);
  assert.equal(allowedSource('https://www.sephora.me/sa-en/p/a','Rhode','AE'),false);
  assert.equal(allowedSource('https://www.sephora.com/ca/en/product/a','Rhode','US'),false);
  assert.equal(allowedSource('https://www.dior.com/p','Rhode','AE'),false);
});
test('exact supplier variant is rechecked against official product JSON and market currency',async()=>{
  const base=source('US',{url:'https://www.rhodeskin.com/products/pocket-blush?variant=23',supplier_variant_id:'23'});
  const fetcher=async url=>({ok:true,json:async()=>url.endsWith('/cart.js')?{currency:'USD'}:{variants:[{id:23,title:'Piggy',available:false,price:2400,weight:37},{id:24,available:true,price:2400}]}});
  const checked=await recheckSource(base,'Rhode',fetcher);assert.equal(checked.stock_status,'out_of_stock');assert.equal(checked.supplier_weight_kg,0.037);
  const wrongCurrency=async url=>({ok:true,json:async()=>url.endsWith('/cart.js')?{currency:'GBP'}:{variants:[{id:23,available:true,price:2400}]}});
  assert.equal((await recheckSource(base,'Rhode',wrongCurrency)).stock_status,'unverified');
  const blocked=async()=>{throw new Error('blocked');};assert.equal((await recheckSource(base,'Rhode',blocked)).stock_status,'unverified');
});
test('session cookies expire, reject tampering and contain no password',()=>{
  const token=sessionToken('long-secret',now);assert.equal(checkSession(token,'long-secret',now),true);
  assert.equal(checkSession(token,'wrong',now),false);assert.equal(checkSession(token,'long-secret',now+9*3600000),false);
  assert.equal(checkSession(token+'x','long-secret',now),false);assert.equal(token.includes('long-secret'),false);
});
test('private APIs deny anonymous requests and cross-origin mutations',async()=>{
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(s){this.status=s;},end(s){this.body=s;}};
  await procurementRoutes({method:'GET',headers:{}},res,new URL('https://ops.example/ops/procurement/data'));assert.equal(res.status,401);assert.equal(res.body.includes('summary'),false);
  await procurementRoutes({method:'POST',headers:{origin:'https://attacker.example'}},res,new URL('https://ops.example/ops/procurement/purchase'));assert.equal(res.status,403);
});
test('CSV blocks spreadsheet formula injection',()=>{assert.match(exportCsv({demand:[{title:'=HYPERLINK(1)',orders:[]}]}),/"'=HYPERLINK\(1\)"/);});
