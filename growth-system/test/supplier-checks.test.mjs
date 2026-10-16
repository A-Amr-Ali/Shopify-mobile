import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSephora,sephoraVerification,exactOption,titleMatches} from '../src/supplier-checks.mjs';
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
});
test('trademarks do not break exact names; different sizes and products remain different',()=>{
  assert.equal(titleMatches('Chubby Stick™ Sculpting Contour','chubby-stick-sculpting-contour'),true);
  assert.equal(titleMatches('FutureIQ™ biomimetic hair longevity serum','Future IQ Biomimetic Hair Longevity Serum'),true);
  assert.equal(titleMatches('Mini Example Powder','Example Powder'),false);
});
