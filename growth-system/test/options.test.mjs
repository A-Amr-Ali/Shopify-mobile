import test from 'node:test';
import assert from 'node:assert/strict';
import { checkOptions } from '../src/catalog.mjs';

test('routine checks reject malformed or excessive option lists before any API call',async()=>{
  await assert.rejects(checkOptions([]),/invalid_options/);
  await assert.rejects(checkOptions(['bad']),/invalid_options/);
  await assert.rejects(checkOptions(Array(11).fill('1')),/invalid_options/);
});
test('routine checks use live prices, publication and exact existing NOW options; missing evidence is unknown',async()=>{
  const original=globalThis.fetch;const token=process.env.SHOPIFY_ADMIN_TOKEN;const shop=process.env.SHOP_DOMAIN;
  process.env.SHOPIFY_ADMIN_TOKEN='test-token';process.env.SHOP_DOMAIN='test.myshopify.com';
  const p={handle:'test-product',title:'Live product',vendor:'Brand',status:'ACTIVE',onlineStoreUrl:'https://sofiestore.net/products/test-product',featuredImage:{url:'https://cdn.shopify.com/image.jpg'}};
  let broken=false;
  globalThis.fetch=async url=>{
    if(String(url).includes('graphql'))return new Response(JSON.stringify({data:{nodes:[{id:'gid://shopify/ProductVariant/1',title:'Small',price:'200.00',inventoryQuantity:2,product:p},{id:'gid://shopify/ProductVariant/2',title:'Large',price:'300.00',inventoryQuantity:0,product:p},{id:'gid://shopify/ProductVariant/3',title:'Hidden',price:'400.00',inventoryQuantity:4,product:{...p,status:'DRAFT'}},{id:'gid://shopify/ProductVariant/4',title:'Other',price:'500.00',inventoryQuantity:3,product:{...p,handle:'no-evidence'}}]}}));
    if(String(url).includes('no-evidence') || broken)throw Error('unavailable');
    return new Response('<script type="application/json" data-nowp-data>{"ready":[1]}</script>');
  };
  try{
    const out=await checkOptions(['1','2','3','4']);
    assert.equal(out.items[0].price,200);assert.equal(out.items[0].now,true);
    assert.equal(out.items[1].available,false);assert.equal(out.items[1].now,false);
    assert.equal(out.items[2].available,false);assert.equal(out.items[2].title,undefined);
    assert.equal(out.items[3].now,null);assert.ok(out.checkedAt);
  }finally{globalThis.fetch=original;if(token===undefined)delete process.env.SHOPIFY_ADMIN_TOKEN;else process.env.SHOPIFY_ADMIN_TOKEN=token;if(shop===undefined)delete process.env.SHOP_DOMAIN;else process.env.SHOP_DOMAIN=shop;}
});
