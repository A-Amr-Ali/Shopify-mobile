import test from 'node:test';
import assert from 'node:assert/strict';
import {researchProduct,researchDue,compareResearchPriority,SOURCING_VERSION,SOURCE_STAGES} from '../src/source-research.mjs';
import {allowedSource,chooseSource,validSource} from '../src/procurement.mjs';
import {discoverSephora,discoverOfficialStore,structuredRetailOffers,titleMatches,marketStoreBases,verifyPurchaseLink} from '../src/supplier-checks.mjs';

const bubble={variantId:'gid://shopify/ProductVariant/42519330029639',brand:'BUBBLE',title:'Tell All - Juicy Secrets Berry Lip Balm',handle:'tell-all-juicy-secrets-berry-lip-balm',option:'4.4g',options:[{name:'Size',value:'4.4g'}]};
const response=body=>({ok:true,status:200,headers:new Headers(),text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const at=new Date().toISOString();
const offer=(region,url,patch={})=>({variant_id:bubble.variantId,region,url,currency:{AE:'AED',US:'USD',UK:'GBP'}[region],price:10,exact_match:true,stock_status:'in_stock',verified_at:at,...patch});

test('supplier-class preference is Sephora AE/US/UK, official AE/US/UK, then Ulta US',()=>{
  const official=offer('AE','https://hellobubble.com/products/tell-all-juicy-secret');
  const us=offer('US','https://www.sephora.com/product/example');
  assert.equal(chooseSource([official,us],bubble.brand).url,us.url);
  assert.equal(chooseSource([offer('US','https://www.ulta.com/p/example'),offer('US','https://hellobubble.com/products/example')],bubble.brand).url,'https://hellobubble.com/products/example');
  assert.equal(allowedSource('https://hellobubble.com/products/tell-all-juicy-secret','BUBBLE','US'),true);
  assert.equal(allowedSource('https://sincerely-yours.com/products/sugarcoat-duo','Sincerely Yours','US'),true);
  assert.equal(allowedSource('https://www.ulta.com/p/example','BUBBLE','US'),true);
  assert.equal(allowedSource('https://www.ulta.com/p/example','BUBBLE','UK'),false);
  for(const url of ['https://ulta.com.attacker.test/p/example','https://amazon.com/products/example','https://hellobubble.com:444/products/example','https://u:p@hellobubble.com/products/example'])assert.equal(allowedSource(url,'BUBBLE','US'),false);
  assert.equal(validSource({...us,verified_at:null}),false);
  assert.equal(validSource({...us,stock_status:'unverified',exact_match:false,verified_at:null}),false);
});

test('known Bubble Sephora URL is fetched live without a failing search request',async()=>{
  const product={id:'P10062586',name:bubble.title,currency:'AED',c_brand:{name:'BUBBLE'},c_variantsInfo:[{product_id:'783019',c_variation_attribute_name:'4.4g',c_price:45}]};
  const analytics={product_sku:'783019',product_currency:'AED',product_instock:'y',product_price_ati:45};
  const flight=JSON.stringify([1,'1:'+JSON.stringify({product,analytics})+'\n']);
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',offers:{availability:'InStock'}})+'</script><script>self.__next_f.push('+flight+')</script>';
  const calls=[];const sources=await discoverSephora(bubble,async url=>{calls.push(url);if(url.includes('/search'))throw new Error('supplier_http_403');return response(html);});
  assert.equal(calls.length,1);assert.equal(sources[0].stock_status,'in_stock');assert.equal(sources[0].supplier_variant_id,'783019');assert.equal(sources[0].price,45);
});

test('official catalogue finds a different supplier handle and verifies the exact live variant',async()=>{
  const line={variantId:'v',brand:'Sincerely Yours',title:'The Sweet Tooth Set Bundle',handle:'5-reasons-your-lip-gloss-should-care-for-your-barrier-too',options:[]};
  const p={title:'The Sweet Tooth Set',handle:'sugarcoat-duo',vendor:'SINCERELY YOURS',variants:[{id:48127739658484,title:'Default Title',price:2800,available:true,weight:68}]};
  const calls=[];const fetcher=async url=>{calls.push(url);if(url.endsWith('/cart.js'))return response({currency:'USD'});if(url.includes('/search/'))return response({});if(url.includes('/products.json'))return response({products:[p]});if(url.includes('/products/sugarcoat-duo.js'))return response(p);return {ok:false,status:404,headers:new Headers(),text:async()=>''};};
  const found=await discoverOfficialStore(line,'https://sincerely-yours.com','US',fetcher);
  assert.equal(found[0].exact_match,true);assert.equal(found[0].stock_status,'in_stock');assert.equal(found[0].price,28);assert.equal(found[0].supplier_weight_kg,.068);assert.match(found[0].url,/sugarcoat-duo/);assert.ok(calls.some(u=>u.includes('/products.json')));
  assert.equal(titleMatches('The Sweet Tooth Set Bundle','The Sweet Tooth Set'),true);
  assert.equal(titleMatches('Mini Example Powder','Example Powder'),false);
});

test('official Bubble barcode binds documented net size but never becomes shipping weight',async()=>{
  const p={title:'Tell All Juicy Secret',handle:'tell-all-juicy-secret',vendor:'Bubble Skincare',variants:[{id:44291634036889,title:'Default Title',price:900,available:true,weight:0,barcode:'850020056828'}]};
  const fetcher=async url=>response(url.endsWith('/cart.js')?{currency:'USD'}:url.includes('/search/')?{}:p);
  const found=await discoverOfficialStore(bubble,'https://hellobubble.com','US',fetcher);
  assert.equal(found[0].exact_match,true);assert.equal(found[0].price,9);assert.equal(found[0].supplier_weight_kg,undefined);assert.match(found[0].evidence,/barcode 850020056828/);
});

test('regional store discovery uses advertised official locales, not an arbitrary external link',async()=>{
  const html='<link rel="alternate" hreflang="en-GB" href="https://hellobubble.com/en-gb"><link rel="alternate" hreflang="en-GB" href="https://evil.test/en-gb">';
  const bases=await marketStoreBases(bubble,'UK',async()=>response(html));assert.deepEqual(bases,['https://hellobubble.com/en-gb']);
});

test('Ulta stock is bound to the exact rendered SKU, scent, price and currency',()=>{
  const p={'@type':'Product',name:'Tell All Lip Balm',brand:'Bubble',sku:'2627110',Scent:'Juicy Secret Berry',gtin12:'00850020056828',offers:{'@type':'Offer',price:'9',priceCurrency:'USD',availability:'https://schema.org/InStock',url:'https://www.ulta.com/p/tell-all-lip-balm-pimprod2046769?sku=2627110'}};
  const html=v=>'<script type="application/ld+json">'+JSON.stringify(v)+'</script>';
  const url=p.offers.url;
  const found=structuredRetailOffers(html(p),bubble,url,'US','Ulta Beauty','2627110');assert.equal(found[0].stock_status,'in_stock');assert.equal(found[0].supplier_variant_id,'2627110');
  assert.deepEqual(structuredRetailOffers(html(p),bubble,url,'US','Ulta Beauty','2634631'),[]);
  assert.deepEqual(structuredRetailOffers(html({...p,Scent:'Mint Message Minty',gtin12:'different'}),bubble,url,'US','Ulta Beauty','2627110'),[]);
  assert.deepEqual(structuredRetailOffers(html({...p,offers:{...p.offers,priceCurrency:'CAD'}}),bubble,url,'US','Ulta Beauty','2627110'),[]);
  assert.deepEqual(structuredRetailOffers(html({...p,offers:{...p.offers,'@type':'AggregateOffer'}}),bubble,url,'US','Ulta Beauty','2627110'),[]);
});

test('blocked and sold-out suppliers do not stop the ordered fallbacks',async()=>{
  const calls=[];const ready=offer('US','https://hellobubble.com/products/tell-all-juicy-secret');
  const stages=SOURCE_STAGES.map((s,i)=>({...s,official:false,discover:async()=>{calls.push(s.id);if(i===0)throw new Error('supplier_http_403');if(i===1)return [offer('US','https://www.sephora.com/product/example',{stock_status:'out_of_stock'})];return i===4?[ready]:[];}}));
  const result=await researchProduct(bubble,{stages,isVerified:o=>validSource(o)});
  assert.deepEqual(calls,['sephora_ae','sephora_us','sephora_uk','official_ae','official_us']);assert.equal(result.summary.state,'ready');assert.equal(result.summary.attempts[0].status,'blocked');assert.equal(result.summary.attempts[1].status,'out_of_stock');assert.equal(result.summary.verified,1);
});

test('unresolved research covers every stage, retries, and invalidates the old 24-hour skip',async()=>{
  const stages=SOURCE_STAGES.map(s=>({...s,official:false,discover:async()=>[]}));
  const {summary}=await researchProduct(bubble,{stages});assert.equal(summary.attempts.length,7);assert.equal(summary.state,'research_needed');assert.equal(summary.version,SOURCING_VERSION);assert.ok(Date.parse(summary.nextRetryAt)-Date.now()<61*60000);
  assert.equal(researchDue({summary:{version:'old',nextRetryAt:new Date(Date.now()+24*3600000).toISOString()}}),true);
  assert.equal(researchDue({summary}),false);assert.equal(researchDue({summary:{...summary,nextRetryAt:new Date(Date.now()-1).toISOString()}}),true);
});

test('a known unavailable option survives a blocked supplier search',async()=>{
  const unavailable=offer('AE','https://www.sephora.me/ae-en/p/example/P1',{stock_status:'out_of_stock'});
  const result=await researchProduct(bubble,{stages:[{id:'sephora_ae',label:'Sephora UAE',region:'AE',discover:async()=>{throw new Error('supplier_http_403');}}],knownSources:[unavailable],recheck:async()=>({stock_status:'out_of_stock',checked_at:at}),isVerified:o=>validSource(o)});
  assert.equal(result.offers.length,1);assert.equal(result.offers[0].stock_status,'out_of_stock');assert.equal(result.summary.attempts[0].status,'blocked');
});

test('new demand is first, and repeated blocked retries do not starve older research',()=>{
  const rows=[{id:'recent-retry',newestOrderAt:300,research:{version:SOURCING_VERSION,finishedAt:'2026-10-31T11:00:00Z'}},{id:'older-unchecked',newestOrderAt:100},{id:'new-unchecked',newestOrderAt:400},{id:'older-retry',newestOrderAt:50,research:{version:SOURCING_VERSION,finishedAt:'2026-10-31T09:00:00Z'}}];
  assert.deepEqual(rows.sort(compareResearchPriority).map(r=>r.id),['new-unchecked','older-unchecked','older-retry','recent-retry']);
});

test('known official non-Shopify pages use exact product schema, without working around denied access',async()=>{
  const line={variantId:'v',brand:'Vacation',title:'Classic Lotion',options:[{name:'Size',value:'100 ml'}]};
  const url='https://vacation.inc/products/classic-lotion';
  const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'Classic Lotion',brand:'Vacation',sku:'CL-100',size:'100 ml',offers:{price:20,priceCurrency:'USD',availability:'https://schema.org/InStock',url}})+'</script>';
  const found=await verifyPurchaseLink(line,url,'US',async u=>u.endsWith('/cart.js')?{ok:false,status:404,headers:new Headers()}:response(html));
  assert.equal(found[0].stock_status,'in_stock');assert.equal(found[0].price,20);
  const calls=[];await assert.rejects(verifyPurchaseLink(line,url,'US',async u=>{calls.push(u);return {ok:false,status:403,headers:new Headers()};}),/403/);assert.equal(calls.length,1);
});
