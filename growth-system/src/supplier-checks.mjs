// Read-only public retailer checks. No carts are modified and no purchases are placed.
import { officialStores, officialDomains, productHints, documentedOption } from './supplier-registry.mjs';
const norm=x=>String(x||'').replace(/[™®©]/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const text=x=>String(x||'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp);/g,' ').replace(/\s+/g,' ');
function objectAt(s,start){let depth=0,quoted=false,escaped=false;for(let i=start;i<s.length;i++){const c=s[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(s.slice(start,i+1));}catch{return null;}}}return null;}
function objectWith(s,key){const at=s.indexOf('"'+key+'":');if(at<0)return null;let pos=at,tries=0;while((pos=s.lastIndexOf('{',pos-1))>=0&&tries++<250){const d=objectAt(s,pos);if(d&&Object.hasOwn(d,key))return d;}return null;}
export function parseSephora(html){
  let flight='';for(const m of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g)){try{const d=JSON.parse(m[1]);if(typeof d[1]==='string')flight+=d[1]+'\n';}catch{}}
  const product=objectWith(flight,'c_variantsInfo');const analytics=objectWith(flight,'product_sku');
  let structured=null;for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(m[1].includes('ld+json')){try{const d=JSON.parse(m[2]);if(d['@type']==='Product')structured=d;}catch{}}
  return {product,analytics,structured};
}
async function read(url,fetcher=fetch){const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(14000),headers:{accept:'application/json,text/html','user-agent':'SOFIE-Order-Procurement/1.0'}});if(!r.ok)throw new Error('supplier_http_'+r.status);const length=Number(r.headers.get('content-length')||0);if(length>6000000)throw new Error('supplier_page_too_large');const s=await r.text();if(s.length>6000000)throw new Error('supplier_page_too_large');return s;}
const coreShade=x=>norm(String(x).split(/\s[-–—]\s/)[0].replace(/\s*\([^)]*\)\s*/g,''));
function sizes(s){return [...String(s||'').toLowerCase().matchAll(/(\d*\.?\d+)\s*(?:fl\.?\s*)?(ml|oz|grams?|g|litres?|liters?|l)\b/g)].map(m=>({n:Number(m[1]),u:/^gram/.test(m[2])?'g':/^(l|litre|liter)/.test(m[2])?'l':m[2]}));}
export function exactOption(line,attribute,description=''){
  const opts=(line.options||[]).filter(o=>norm(o.value)!=='default title');
  for(const o of opts){const kind=norm(o.name);if(['color','colour','shade','model','material','style'].includes(kind)){
    const a=norm(attribute),wanted=coreShade(o.value);if(!(a===wanted||a.startsWith(wanted+' ')||a.endsWith(' '+wanted)||a.includes(' '+wanted+' ')))return false;
  }}
  const size=opts.find(o=>norm(o.name)==='size');
  if(size){const wanted=sizes(size.value),direct=sizes(attribute),actual=direct.length?direct:sizes(text(description));
    if(wanted.length){const common=[...new Set(wanted.map(w=>w.u))].filter(u=>actual.some(a=>a.u===u));if(!common.length||common.some(u=>!wanted.filter(w=>w.u===u).some(w=>actual.some(a=>a.u===u&&Math.abs(w.n-a.n)<Math.max(.001,w.n*.01)))))return false;}
    else if(!norm(attribute+' '+description).includes(norm(size.value)))return false;
  }
  return true;
}
const TITLE_ALIASES={
  'tell all juicy secrets berry lip balm':'tell all juicy secret',
  'tell all lip balm juicy secret berry':'tell all juicy secret',
  'p s special delivery mini skincare essentials kit':'p s special delivery mini skincare essentials set',
  'sunny side up hydrating mineral sunscreen broad spectrum protection spf 30 pa':'sunny side up',
  'the sweet tooth set bundle':'the sweet tooth set',
  'face to face time whipped clay mask':'face to face time',
  'brow sculpt':'brow sculpt gel',
  'mini easy bake loose baking setting powder':'easy bake loose powder mini',
  'ultra facial cream with spf 30 sunscreen':'ultra facial cream sunscreen spf 30',
  'beautyblender nude makeup sponge':'beautyblender nude',
  'lip contour 2 0 automatic matte lip pencil':'lip contour 2 0',
  'diorshow on stage crayon kohl liner':'diorshow onstage crayon waterproof kohl eyeliner pencil intense color',
  'lip pulse glassy lip plumper':'lip pulse glassy lip plumper gloss',
  'lipsoftie lip treatment':'lipsoftie hydrating tinted lip treatment balm',
  'soft shimmer long wear cream eyeshadow':'soft shimmer long wearing cream shadow',
  'major dimension eye illusion eyeshadow duos':'major dimension eye illusion eyeshadow duo',
  'diorshow 5 couleurs couture eyeshadow palette':'diorshow 5 couleurs eye palette 5 eyeshadows high color and long wear',
  'travel size creaseless creamy concealer':'creaseless creamy full coverage concealer',
  'creaseless creamy concealer':'creaseless creamy full coverage concealer',
  'fauxfilter under eye color corrector':'fauxfilter color corrector',
  'mini fauxfilter luminous matte liquid concealer':'faux filter concealer mini',
  '24bottles clima stainless steel insulated bottle 500ml':'clima 500ml insulated water bottle',
  '24bottle urban stainless steel bottle 1000ml':'urban 1l water bottle',
  'barrier treatment repair rebuild':'barrier treatment'
};
function titleKey(s){const base=norm(s).replace(/^(rhode|smeg) /,'').replace(/ 50 s style$/,'').replace('futureiq','future iq').replace(' cream blush for cheeks lips','');return (TITLE_ALIASES[base]||base).replace(/[^a-z0-9]/g,'');}
export function titleMatches(wanted,actual){return titleKey(wanted)===titleKey(actual);}
function brandMatches(wanted,actual){const a=norm(wanted),b=norm(actual);return Boolean(a&&b&&(a===b||a.startsWith(b+' ')||b.startsWith(a+' ')));}
export function sephoraVerification(parsed,variantId){
  const {product:p,analytics:a,structured:s}=parsed;const at=new Date().toISOString();
  const v=p?.c_variantsInfo?.find(v=>String(v.product_id)===String(variantId));
  // Sephora's server page can ignore a requested shade parameter. The default
  // product's aggregate availability must NEVER verify a different shade.
  if(!v||String(a?.product_sku)!==String(variantId)||a.product_currency!=='AED'||p.currency!=='AED')return {stock_status:'unverified',checked_at:at};
  const availability=String(s?.offers?.availability||'').split('/').pop();
  const stock=a.product_instock==='y'&&availability==='InStock'?'in_stock':a.product_instock==='n'||availability==='OutOfStock'?'out_of_stock':'unverified';
  const price=Number(a.product_price_ati||a.product_price);
  if(!(price>0))return {stock_status:'unverified',checked_at:at};
  return {stock_status:stock,price,verified_at:at,checked_at:at,verification_method:'official_page',evidence:'Sephora UAE live page: exact SKU '+variantId+'; option '+v.c_variation_attribute_name+'; AED '+price+'; product_instock='+a.product_instock+'; structured availability='+availability};
}
export async function checkSephoraSource(source,fetcher=fetch){try{
  const parsed=parseSephora(await read(source.url,fetcher));
  if(parsed.product?.c_variantsInfo?.some(v=>String(v.product_id)===String(source.supplier_variant_id))&&String(parsed.analytics?.product_sku)!==String(source.supplier_variant_id)&&String(source.evidence).startsWith('Live Sephora UAE browser check:'))
    return {checked_at:new Date().toISOString()}; // Keep the original, expiring live UI evidence; never refresh its verification time from a different shade.
  return sephoraVerification(parsed,source.supplier_variant_id);
}catch{return {stock_status:'unverified',checked_at:new Date().toISOString()};}}
export async function discoverSephora(line,fetcher=fetch){
  const query=String(line.title).replace(/[™®]/g,'');
  const paths=new Set(productHints(line).filter(h=>h.region==='AE'&&new URL(h.url).hostname.endsWith('sephora.me')).map(h=>new URL(h.url).pathname));
  let searchError=null;
  // A known exact product URL is useful even when the public search service is
  // unavailable. It is still fetched and verified live, not trusted as stock.
  if(!paths.size)try{const html=await read('https://www.sephora.me/ae-en/search?q='+encodeURIComponent(query),fetcher);
    for(const m of html.matchAll(/href="(\/ae-en\/p\/[^"?]+)(?:\?[^"<]*)?"/g))paths.add(m[1]);
  }catch(error){searchError=error;}
  const links=[...paths].slice(0,12);
  const offers=[];
  for(const path of links){
    // The search endpoint may return related products. Only an exact product
    // title and official brand match can progress to option checks.
    const url='https://www.sephora.me'+path;const parsed=parseSephora(await read(url,fetcher));const p=parsed.product;
    if(!p||!titleMatches(line.title,p.name)||!brandMatches(line.brand,p.c_brand?.name))continue;
    const variants=p.c_variantsInfo.filter(v=>exactOption(line,p.name+' '+v.c_variation_attribute_name,p.longDescription));
    if(variants.length!==1)continue;
    const v=variants[0],check=sephoraVerification(parsed,v.product_id);
    offers.push({variant_id:line.variantId,region:'AE',retailer:'Sephora UAE',url:url+'?productVariantId='+v.product_id,supplier_variant_id:String(v.product_id),
      matched_title:line.title,matched_option:line.option,exact_match:true,currency:'AED',price:Number(v.c_salesPrice)>0?Number(v.c_salesPrice):Number(v.c_price),
      stock_status:'unverified',verified_at:new Date().toISOString(),checked_at:new Date().toISOString(),verification_method:'official_page',evidence:'Exact product and option found; selected-shade stock requires verification.',...check});
    break;
  }
  if(!offers.length&&searchError)throw searchError;
  return offers;
}
export function parseSephoraUS(html){const match=html.match(/<script[^>]*id="linkStore"[^>]*>([\s\S]*?)<\/script>/);if(!match)return null;try{return JSON.parse(match[1]).page?.product||null;}catch{return null;}}
export async function discoverSephoraUS(line,fetcher=fetch){
  const search=JSON.parse(await read('https://www.sephora.com/api/v2/catalog/search/?type=keyword&q='+encodeURIComponent(line.title.replace(/[™®]/g,''))+'&includeEDD=true',fetcher));
  for(const hit of (search.products||[]).filter(p=>titleMatches(line.title,p.displayName)&&brandMatches(line.brand,p.brandName)).slice(0,2)){
    if(typeof hit.targetUrl!=='string'||!hit.targetUrl.startsWith('/product/'))continue;
    const url='https://www.sephora.com'+hit.targetUrl;
    const product=parseSephoraUS(await read(url,fetcher));if(!product)continue;
    const skus=[product.currentSku,...(product.regularChildSkus||[])].filter(Boolean);
    const unique=[...new Map(skus.map(s=>[s.skuId,s])).values()];
    const matched=unique.filter(s=>typeof s.isOutOfStock==='boolean'&&exactOption(line,[s.variationValue,s.variationDesc,s.size].filter(Boolean).join(' '),s.size||''));
    if(matched.length!==1)continue;const sku=matched[0];
    const selected=new URL(url);selected.searchParams.set('skuId',sku.skuId);
    const price=Number(String(sku.salePrice||sku.listPrice||'').replace(/[^0-9.]/g,''));if(!(price>0))continue;
    const at=new Date().toISOString();
    return [{variant_id:line.variantId,region:'US',retailer:'Sephora US',url:selected.href,supplier_variant_id:String(sku.skuId),matched_title:line.title,matched_option:line.option,exact_match:true,
      price,currency:'USD',stock_status:sku.isOutOfStock?'out_of_stock':'in_stock',verified_at:at,checked_at:at,verification_method:'official_page',
      evidence:'Official Sephora US product data: exact SKU '+sku.skuId+'; '+[sku.variationValue,sku.variationDesc,sku.size].filter(Boolean).join(' / ')+'; isOutOfStock='+sku.isOutOfStock+'; USD '+price}];
  }
  return [];
}
export async function checkSephoraUSSource(source,fetcher=fetch){try{
  const p=parseSephoraUS(await read(source.url,fetcher));const sku=[p?.currentSku,...(p?.regularChildSkus||[])].find(s=>s&&String(s.skuId)===String(source.supplier_variant_id));
  if(!sku||typeof sku.isOutOfStock!=='boolean')return {stock_status:'unverified',checked_at:new Date().toISOString()};
  const price=Number(String(sku.salePrice||sku.listPrice||'').replace(/[^0-9.]/g,''));if(!(price>0))return {stock_status:'unverified',checked_at:new Date().toISOString()};
  const at=new Date().toISOString();return {stock_status:sku.isOutOfStock?'out_of_stock':'in_stock',price,verified_at:at,checked_at:at,verification_method:'official_page',evidence:'Official Sephora US exact SKU '+sku.skuId+'; isOutOfStock='+sku.isOutOfStock+'; USD '+price};
}catch{return {stock_status:'unverified',checked_at:new Date().toISOString()};}}
const catalogCache=new WeakMap();
async function officialCatalog(base,fetcher) {
  let cache=catalogCache.get(fetcher);if(!cache){cache=new Map();catalogCache.set(fetcher,cache);}
  const hit=cache.get(base);if(hit&&Date.now()-hit.at<5*60000)return hit.rows;
  const rows=[];
  for(let page=1;page<=2;page++){
    const parsed=JSON.parse(await read(base+'/products.json?limit=250&page='+page,fetcher));
    if(!Array.isArray(parsed.products))throw new Error('supplier_catalog_format_unavailable');
    rows.push(...parsed.products);if(parsed.products.length<250)break;
  }
  cache.set(base,{at:Date.now(),rows});return rows;
}
function candidateQueries(line) {
  const title=String(line.title||'').replace(/[™®]/g,'');
  const short=title.split(/\s[-–—]\s|,/)[0];
  return [...new Set([title,short,norm(title).split(' ').slice(0,4).join(' '),line.barcode].filter(Boolean))].slice(0,3);
}
function withoutBrand(name,brand) {
  const a=norm(name),b=norm(brand);return b&&a.startsWith(b+' ')?a.slice(b.length+1):a;
}
function productMatches(line,p) {
  return titleMatches(line.title,p.title||p.name)||titleMatches(line.title,withoutBrand(p.title||p.name,line.brand));
}
function shopifyOffer(line,p,base,region,variant) {
  const currency={AE:'AED',US:'USD',UK:'GBP'}[region],at=new Date().toISOString();
  const identity=documentedOption(line,variant);
  const optionDescription=[p.description||p.body_html||'',identity?.text||''].join(' ');
  const exact=exactOption(line,p.title+' '+variant.title,optionDescription);
  const price=Number(variant.price)/100;
  if(!(price>0))return null;
  return {variant_id:line.variantId,region,retailer:new URL(base).hostname.replace(/^www\./,''),url:base+'/products/'+p.handle+'?variant='+variant.id,
    supplier_variant_id:String(variant.id),matched_title:p.title,matched_option:variant.title,exact_match:exact,
    stock_status:!exact||typeof variant.available!=='boolean'?'unverified':variant.available?'in_stock':'out_of_stock',
    price,currency,verified_at:exact&&typeof variant.available==='boolean'?at:null,checked_at:at,verification_method:'official_json',
    ...(Number(variant.weight)>0&&Number(variant.weight)<=100000?{supplier_weight_kg:Number(variant.weight)/1000,weight_evidence:'Official Shopify product JSON exact variant weight: '+variant.weight+' grams (reported shipping-weight estimate).'}:{}),
    evidence:'Official '+region+' product JSON: '+p.title+'; variant '+variant.id+' '+variant.title+'; SKU '+variant.sku+'; availability='+variant.available+'; '+currency+' from official cart context. '+(exact?'Exact ordered option matched. ':'Product found; exact ordered size/shade needs confirmation. ')+(identity?.evidence||'')};
}
export async function discoverOfficialStore(line,base,region,fetcher=fetch,{urls=[]}={}) {
  if(!base)return [];const currency={AE:'AED',US:'USD',UK:'GBP'}[region];
  const cart=JSON.parse(await read(base+'/cart.js',fetcher));
  if(cart.currency!==currency)return [];
  const shade=(line.options||[]).find(o=>['color','colour','shade'].includes(norm(o.name)));
  const shadeSlug=shade?coreShade(shade.value).replaceAll(' ','-'):'';
  const basic=norm(line.title).replace(/^rhode /,'').replace(' cream blush for cheeks lips','').replaceAll(' ','-');
  const candidates=new Set();
  for(const hint of [...urls,...productHints(line).filter(h=>h.region===region).map(h=>h.url)]){
    try{const u=new URL(hint),b=new URL(base);if(u.hostname===b.hostname){const m=u.pathname.match(/\/products\/([^/]+)/);if(m)candidates.add(decodeURIComponent(m[1]).replace(/\.js$/,''));}}catch{}
  }
  for(const h of [line.handle,basic,...(shadeSlug?[basic+'-'+shadeSlug,line.handle+'-'+shadeSlug]:[])])if(h)candidates.add(h);
  for(const query of candidateQueries(line)){
    try{const s=JSON.parse(await read(base+'/search/suggest.json?q='+encodeURIComponent(query)+'&resources[type]=product&resources[limit]=10',fetcher));
      for(const p of s.resources?.results?.products||[])if(p.handle)candidates.add(p.handle);
    }catch(error){if(/supplier_http_(403|429)/.test(error.message))break;}
  }
  const checked=new Set(),partial=[];
  async function check(handle) {
    if(checked.has(handle))return null;checked.add(handle);
    let p;try{p=JSON.parse(await read(base+'/products/'+encodeURIComponent(handle)+'.js',fetcher));}
    catch(error){if(/supplier_http_(403|429)/.test(error.message))throw error;return null;}
    let name=p.title;if(shadeSlug)name=norm(name).replace(new RegExp(' '+coreShade(shade.value)+'$'),'');
    const model=String(line.title).match(/\b[A-Z]{3}\d{2}[A-Z0-9]*UK\b/i)?.[0];
    if(!model&&(!productMatches(line,{...p,title:name})||!brandMatches(line.brand,p.vendor||line.brand)))return null;
    const variants=(p.variants||[]).filter(v=>model?String(v.sku).toUpperCase()===model.toUpperCase():
      exactOption(line,p.title+' '+v.title,[p.description||'',documentedOption(line,v)?.text||''].join(' ')));
    if(variants.length===1)return shopifyOffer(line,p,base,region,variants[0]);
    if(p.variants?.length===1){const candidate=shopifyOffer(line,p,base,region,p.variants[0]);if(candidate)partial.push(candidate);}
    return null;
  }
  for(const handle of [...candidates].slice(0,16)){const offer=await check(handle);if(offer)return [offer];}
  // A SOFIE handle can be unrelated to the supplier's URL. The official product
  // catalogue finds the real handle; live variant JSON still decides stock.
  try{
    const catalog=await officialCatalog(base,fetcher);
    for(const p of catalog.filter(p=>productMatches(line,p)&&brandMatches(line.brand,p.vendor||line.brand)).slice(0,10)){
      const offer=await check(p.handle);if(offer)return [offer];
    }
  }catch(error){if(!partial.length)throw error;}
  return [...new Map(partial.map(o=>[o.url,o])).values()];
}
const marketCache=new WeakMap();
export async function marketStoreBases(line,region,fetcher=fetch) {
  const configured=officialStores(line.brand,region);if(configured.length)return configured;
  const roots=officialStores(line.brand,'US');if(!roots.length)return [];
  let cache=marketCache.get(fetcher);if(!cache){cache=new Map();marketCache.set(fetcher,cache);}
  const key=norm(line.brand)+'|'+region,hit=cache.get(key);if(hit&&Date.now()-hit.at<15*60000)return hit.bases;
  const wanted=region==='AE'?/^(en|ar)-AE$/i:/^en-GB$/i,bases=[];
  for(const root of roots.slice(0,2)){
    const html=await read(root,fetcher);
    for(const m of html.matchAll(/<link\b[^>]*>/gi)){
      const tag=m[0],locale=tag.match(/hreflang=["']([^"']+)["']/i)?.[1],href=tag.match(/href=["']([^"']+)["']/i)?.[1];
      if(!locale||!href||!wanted.test(locale))continue;
      try{const u=new URL(href,root);const host=u.hostname.replace(/^www\./,'');
        if(u.protocol!=='https:'||u.username||u.password||u.port||!officialDomains(line.brand).some(d=>host===d||host.endsWith('.'+d)))continue;
        bases.push(u.origin+u.pathname.split('/products/')[0].replace(/\/$/,''));
      }catch{}
    }
  }
  const unique=[...new Set(bases)];cache.set(key,{at:Date.now(),bases:unique});return unique;
}
async function officialRegion(line,region,fetcher) {
  const offers=[];
  const bases=await marketStoreBases(line,region,fetcher);if(!bases.length)throw new Error('official_market_not_advertised');
  for(const base of bases){
    try{offers.push(...await discoverOfficialStore(line,base,region,fetcher));}
    catch(error){
      // Non-Shopify official sites can still publish exact product schema.
      // Access-denied and rate-limit responses are NOT bypassed or worked around.
      if(/supplier_http_(403|401|429)|fetch|timeout|abort/i.test(error.message))throw error;
      offers.push(...await discoverStructuredRetailer(line,region,base,base+'/search?q='+encodeURIComponent(line.title),new URL(base).hostname,fetcher,true));
    }
    if(offers.some(o=>o.exact_match&&o.stock_status==='in_stock'))break;
  }
  return offers;
}
export async function discoverOfficialAE(line,fetcher=fetch){return officialRegion(line,'AE',fetcher);}
export async function discoverOfficialUS(line,fetcher=fetch){return officialRegion(line,'US',fetcher);}
export async function discoverOfficialUK(line,fetcher=fetch){return officialRegion(line,'UK',fetcher);}

export function structuredProducts(html) {
  const products=[];
  function visit(value){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}if(value['@type']==='Product')products.push(value);if(value['@graph'])visit(value['@graph']);if(value.hasVariant)visit(value.hasVariant);}
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(m[1].includes('ld+json'))try{visit(JSON.parse(m[2]));}catch{}
  return products;
}
export function structuredRetailOffers(html,line,url,region,retailer,requestedSku=null) {
  const currency={AE:'AED',US:'USD',UK:'GBP'}[region],out=[];
  for(const p of structuredProducts(html)){
    const brand=typeof p.brand==='string'?p.brand:p.brand?.name;
    const attributes=[p.color,p.size,p.Scent,p.scent,...(p.additionalProperty||[]).filter(x=>/^(size|shade|color|colour|scent|weight)$/i.test(x.name||'')).map(x=>x.value)].filter(Boolean).join(' ');
    if(!brandMatches(line.brand,brand)||(!productMatches(line,p)&&!productMatches(line,{...p,name:p.name+' '+attributes})))continue;
    const sku=String(p.sku||'');if(!sku||requestedSku&&sku!==String(requestedSku))continue;
    const identity=documentedOption(line,p);
    const exact=exactOption(line,p.name+' '+attributes,[p.description||'',identity?.text||''].join(' '));
    const offers=Array.isArray(p.offers)?p.offers:[p.offers];
    for(const offer of offers.filter(Boolean)){
      if(offer['@type']==='AggregateOffer'||offer.priceCurrency!==currency)continue;
      const selected=new URL(offer.url||url,url);
      if(selected.hostname!==new URL(url).hostname)continue;
      const renderedSku=selected.searchParams.get('sku')||selected.searchParams.get('skuId');
      if(renderedSku&&renderedSku!==sku)continue;
      if(retailer==='Ulta Beauty')selected.searchParams.set('sku',sku);
      const availability=String(offer.availability||'').split('/').pop(),price=Number(offer.price);
      if(!(price>0))continue;const at=new Date().toISOString();
      out.push({variant_id:line.variantId,region,retailer,url:selected.href,supplier_variant_id:sku,matched_title:p.name,matched_option:attributes||sku,
        exact_match:exact,stock_status:!exact?'unverified':availability==='InStock'?'in_stock':availability==='OutOfStock'?'out_of_stock':'unverified',
        price,currency,checked_at:at,verified_at:exact&&['InStock','OutOfStock'].includes(availability)?at:null,verification_method:'official_page',
        evidence:retailer+' exact rendered SKU '+sku+'; '+p.name+'; '+attributes+'; '+currency+' '+price+'; availability='+availability+'. '+(identity?.evidence||'')+(!exact?' Exact ordered option still needs confirmation.':'')});
    }
  }
  return out;
}
async function discoverStructuredRetailer(line,region,base,searchUrl,retailer,fetcher,official=false) {
  const paths=new Set(productHints(line).filter(h=>h.region===region&&new URL(h.url).hostname===new URL(base).hostname).map(h=>h.url));
  let searchError=null;
  if(!paths.size)try{const html=await read(searchUrl,fetcher);
    for(const m of html.matchAll(/href="([^"<>]+)"/g)){try{const u=new URL(m[1].replaceAll('&amp;','&'),base);if(u.hostname===new URL(base).hostname&&(official?/\/(?:products?|p)\/|[.]html$/i.test(u.pathname):/^\/p\//.test(u.pathname)))paths.add(u.href);}catch{}}
  }catch(error){searchError=error;}
  for(const url of [...paths].slice(0,8)){
    const offers=structuredRetailOffers(await read(url,fetcher),line,url,region,retailer,new URL(url).searchParams.get('sku'));
    if(offers.length)return offers;
  }
  if(searchError)throw searchError;
  return [];
}
export async function discoverSephoraUK(line,fetcher=fetch){return discoverStructuredRetailer(line,'UK','https://www.sephora.co.uk','https://www.sephora.co.uk/search?q='+encodeURIComponent(line.title),'Sephora UK',fetcher);}
export async function discoverUltaUS(line,fetcher=fetch){return discoverStructuredRetailer(line,'US','https://www.ulta.com','https://www.ulta.com/search?search='+encodeURIComponent(line.brand+' '+line.title),'Ulta Beauty',fetcher);}
export async function checkStructuredSource(source,line,fetcher=fetch) {
  const offers=structuredRetailOffers(await read(source.url,fetcher),line,source.url,source.region,source.retailer,source.supplier_variant_id);
  const offer=offers.find(o=>o.exact_match&&o.supplier_variant_id===String(source.supplier_variant_id));
  if(!offer)return {stock_status:'unverified',checked_at:new Date().toISOString()};
  const {variant_id,region,retailer,url,supplier_variant_id,matched_title,matched_option,exact_match,...check}=offer;return check;
}

// Caller must validate the URL against the approved-brand allowlist before this
// function is used. No redirects, login, cart changes or purchases are performed.
export async function verifyPurchaseLink(line,url,region,fetcher=fetch) {
  const u=new URL(url),host=u.hostname.replace(/^www\./,'');
  if(host==='sephora.me'||host==='sephora.ae'){
    const parsed=parseSephora(await read(url,fetcher)),p=parsed.product;
    if(!p||!productMatches(line,p)||!brandMatches(line.brand,p.c_brand?.name))return [];
    const variants=(p.c_variantsInfo||[]).filter(v=>exactOption(line,p.name+' '+v.c_variation_attribute_name,p.longDescription));
    const explicit=u.searchParams.get('productVariantId');
    if(variants.length!==1||explicit&&explicit!==String(variants[0].product_id))return [];
    const v=variants[0],check=sephoraVerification(parsed,v.product_id);u.searchParams.delete('srsltid');u.searchParams.set('productVariantId',v.product_id);
    return [{variant_id:line.variantId,region:'AE',retailer:'Sephora UAE',url:u.href,supplier_variant_id:String(v.product_id),matched_title:p.name,matched_option:v.c_variation_attribute_name,exact_match:true,currency:'AED',price:Number(v.c_salesPrice)>0?Number(v.c_salesPrice):Number(v.c_price),stock_status:'unverified',verified_at:null,checked_at:new Date().toISOString(),verification_method:'official_page',evidence:'Exact Sephora product and option found; current SKU stock needs confirmation.',...check}];
  }
  if(host==='sephora.com'){
    const p=parseSephoraUS(await read(url,fetcher));if(!p)return [];
    if(!titleMatches(line.title,p.displayName||p.productDetails?.displayName)||!brandMatches(line.brand,p.brandName||p.productDetails?.brand?.displayName))return [];
    const unique=[...new Map([p.currentSku,...(p.regularChildSkus||[])].filter(Boolean).map(s=>[s.skuId,s])).values()];
    const matched=unique.filter(s=>exactOption(line,[s.variationValue,s.variationDesc,s.size].filter(Boolean).join(' '),s.size||''));
    if(matched.length!==1)return [];const sku=matched[0];u.searchParams.set('skuId',sku.skuId);
    const at=new Date().toISOString(),price=Number(String(sku.salePrice||sku.listPrice||'').replace(/[^0-9.]/g,''));
    if(!(price>0))return [];
    return [{variant_id:line.variantId,region:'US',retailer:'Sephora US',url:u.href,supplier_variant_id:String(sku.skuId),matched_title:line.title,matched_option:[sku.variationValue,sku.size].filter(Boolean).join(' '),exact_match:true,currency:'USD',price,stock_status:typeof sku.isOutOfStock!=='boolean'?'unverified':sku.isOutOfStock?'out_of_stock':'in_stock',verified_at:typeof sku.isOutOfStock==='boolean'?at:null,checked_at:at,verification_method:'official_page',evidence:'Exact Sephora US SKU '+sku.skuId+'; isOutOfStock='+sku.isOutOfStock+'; USD '+price}];
  }
  if(host==='sephora.co.uk'||host==='ulta.com')return structuredRetailOffers(await read(url,fetcher),line,url,region,host==='ulta.com'?'Ulta Beauty':'Sephora UK',u.searchParams.get('sku'));
  if(!u.pathname.includes('/products/'))return structuredRetailOffers(await read(url,fetcher),line,url,region,host);
  const prefix=u.pathname.split('/products/')[0];
  try{return await discoverOfficialStore(line,u.origin+prefix,region,fetcher,{urls:[url]});}
  catch(error){
    if(/supplier_http_(403|401|429)|fetch|timeout|abort/i.test(error.message))throw error;
    return structuredRetailOffers(await read(url,fetcher),line,url,region,host);
  }
}

