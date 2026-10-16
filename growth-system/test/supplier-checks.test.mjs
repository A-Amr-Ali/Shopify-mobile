import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSephora,sephoraVerification,exactOption,titleMatches,parseSephoraUS,discoverSephoraUS,checkSephoraSource} from '../src/supplier-checks.mjs';
const product={id:'P1',name:'Example',currency:'AED',c_default_variant_id:'11',c_variantsInfo:[{product_id:'11',c_variation_attribute_name:'Pink'},{product_id:'12',c_variation_attribute_name:'Red'}]};
const analytics={product_sku:'11',product_currency:'AED',product_instock:'y',product_price_ati:100};
function html(){const flight='1:'+JSON.stringify({product,analytics})+'\n';return '<script type="application/ld+json">'+JSON.stringify({'@type':'Product',offers:{availability:'InStock'}})+'</script><script>self.__next_f.push('+JSON.stringify([1,flight])+')</script>';}
test('Sephora stock data is bound to the actual rendered SKU, not the requested query parameter',()=>{
  const parsed=parseSephora(html());assert.equal(parsed.product.id,'P1');assert.equal(parsed.analytics.product_sku,'11');
  assert.equal(sephoraVerification(parsed,'11').stock_status,'in_stock');assert.equal(sephoraVerification(parsed,'12').stock_status,'unverified');
});
test('option verification requires both the exact shade and size',()=>{
  const line={options:[{name:'Color',value:'Piggy - baby pink'},{name:'Size',value:'5.3g / 0.18 oz'}]};
  assert.equal(exactOption(line,'pocket blush piggy','Size: 5.3 g / 0.18 oz.'),true);
  assert.equal(exactOption(line,'pocket blush sleepy girl','Size: 5.3g'),false);
  assert.equal(exactOption(line,'pocket blush piggy','Size: 2g'),false);
  assert.equal(exactOption({options:[{name:'Size',value:'8.8 oz / 291ml'}]},'8.8 oz / 234ml'),false);
});
test('trademarks do not break exact names; different sizes and products remain different',()=>{
  assert.equal(titleMatches('Chubby Stick™ Sculpting Contour','chubby-stick-sculpting-contour'),true);
  assert.equal(titleMatches('FutureIQ™ biomimetic hair longevity serum','Future IQ Biomimetic Hair Longevity Serum'),true);
  assert.equal(titleMatches('Mini Example Powder','Example Powder'),false);
  assert.equal(titleMatches('24Bottles Clima Stainless Steel Insulated Bottle 500ml(50\'s Style)','Clima 500ml Insulated Water Bottle'),true);
  assert.equal(titleMatches('Barrier+ Treatment Repair & Rebuild','Barrier+ Treatment'),true);
});
test('US sourcing uses the matching SKU stock flag and exact option, never search availability',async()=>{
  const p={currentSku:{skuId:'11',variationValue:'Pink',size:'5g',isOutOfStock:false,listPrice:'$20.00'},regularChildSkus:[{skuId:'12',variationValue:'Red',size:'5g',isOutOfStock:true,listPrice:'$20.00'}]};
  const html='<script id="linkStore" type="text/json">'+JSON.stringify({page:{product:p}})+'</script>';
  assert.equal(parseSephoraUS(html).currentSku.skuId,'11');
  const mock=async url=>({ok:true,headers:new Headers(),text:async()=>url.includes('/api/')?JSON.stringify({products:[{displayName:'Example',brandName:'Brand',targetUrl:'/product/example-P1?skuId=11'}]}):html});
  const offers=await discoverSephoraUS({variantId:'v',title:'Example',brand:'Brand',option:'Red 5g',options:[{name:'Color',value:'Red'},{name:'Size',value:'5g'}]},mock);
  assert.equal(offers[0].supplier_variant_id,'12');assert.equal(offers[0].stock_status,'out_of_stock');assert.equal(offers[0].price,20);
});
test('a live UI check of a non-default shade keeps its original expiry, never a fabricated refresh',async()=>{
  const mock=async()=>({ok:true,headers:new Headers(),text:async()=>html()});
  const result=await checkSephoraSource({url:'https://www.sephora.me/ae-en/p/example/P1?productVariantId=12',supplier_variant_id:'12',evidence:'Live Sephora UAE browser check: Red selected.'},mock);
  assert.equal(result.verified_at,undefined);assert.equal(result.stock_status,undefined);assert.ok(result.checked_at);
});
