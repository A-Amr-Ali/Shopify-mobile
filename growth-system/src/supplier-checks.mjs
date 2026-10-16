// Read-only public retailer checks. No carts are modified and no purchases are placed.
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
  const query=String(line.title).replace(/[™®]/g,'');const html=await read('https://www.sephora.me/ae-en/search?q='+encodeURIComponent(query),fetcher);
  const links=[...new Set([...html.matchAll(/href="(\/ae-en\/p\/[^"?]+)(?:\?[^"<]*)?"/g)].map(m=>m[1]))].slice(0,16);
  const offers=[];
  for(const path of links){
    // The search endpoint may return related products. Only an exact product
    // title and official brand match can progress to option checks.
    const slug=path.split('/')[3];if(!titleMatches(line.title,slug.replaceAll('-',' ')))continue;
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
  return offers;
}
const SHOPS=[['rhode','https://www.rhodeskin.com'],['tarte','https://tartecosmetics.com'],['hourglass','https://www.hourglasscosmetics.com'],['k18','https://www.k18hair.com'],['briogeo','https://www.briogeohair.com'],['makeup by mario','https://www.makeupbymario.com'],['kosas','https://kosas.com'],['one size','https://www.onesizebeauty.com'],['beauty blender','https://beautyblender.com'],['sol de janeiro','https://soldejaneiro.com'],['ouai','https://theouai.com'],['owala','https://owalalife.com'],['josie maran','https://www.josiemaran.com'],['patrick ta','https://patrickta.com'],['rare beauty','https://www.rarebeauty.com'],['tower 28','https://www.tower28beauty.com'],['grande','https://grandecosmetics.com'],['amika','https://loveamika.com'],['color wow','https://colorwowhair.com'],['summer fridays','https://summerfridays.com'],['saie','https://saiehello.com']];
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
async function discoverOfficialStore(line,base,region,fetcher){
  if(!base)return [];const currency={AE:'AED',US:'USD',UK:'GBP'}[region];
  const cart=JSON.parse(await read(base+'/cart.js',fetcher));if(cart.currency!==currency)return [];
  const shade=(line.options||[]).find(o=>['color','colour','shade'].includes(norm(o.name)));
  const shadeSlug=shade?coreShade(shade.value).replaceAll(' ','-'):'';
  const basic=norm(line.title).replace(/^rhode /,'').replace(' cream blush for cheeks lips','').replaceAll(' ','-');
  const candidates=new Set([line.handle,basic,...(shadeSlug?[basic+'-'+shadeSlug,line.handle+'-'+shadeSlug]:[])].filter(Boolean));
  try{const s=JSON.parse(await read(base+'/search/suggest.json?q='+encodeURIComponent(line.title)+'&resources[type]=product&resources[limit]=10',fetcher));for(const p of s.resources?.results?.products||[])if(p.handle)candidates.add(p.handle);}catch{}
  const offers=[];
  for(const handle of [...candidates].slice(0,12)){
    let p;try{p=JSON.parse(await read(base+'/products/'+encodeURIComponent(handle)+'.js',fetcher));}catch{continue;}
    let name=p.title;if(shadeSlug)name=norm(name).replace(new RegExp(' '+coreShade(shade.value)+'$'),'');
    const model=String(line.title).match(/\b[A-Z]{3}\d{2}[A-Z0-9]*UK\b/i)?.[0];
    if(!model&&(!titleMatches(line.title,name)||!brandMatches(line.brand,p.vendor||line.brand)))continue;
    const vs=(p.variants||[]).filter(v=>model?String(v.sku).toUpperCase()===model.toUpperCase():exactOption(line,p.title+' '+v.title,p.description));
    if(vs.length!==1)continue;const v=vs[0];const at=new Date().toISOString();
    offers.push({variant_id:line.variantId,region,retailer:new URL(base).hostname.replace(/^www\./,''),url:base+'/products/'+p.handle+'?variant='+v.id,
      supplier_variant_id:String(v.id),matched_title:line.title,matched_option:line.option,exact_match:true,stock_status:v.available===true?'in_stock':'out_of_stock',
      price:Number(v.price)/100,currency,verified_at:at,checked_at:at,verification_method:'official_json',
      ...(Number(v.weight)>0&&Number(v.weight)<=100000?{supplier_weight_kg:Number(v.weight)/1000,weight_evidence:'Official Shopify product JSON exact variant weight: '+v.weight+' grams.'}:{}),
      evidence:'Official '+region+' product JSON: '+p.title+'; exact variant '+v.id+' '+v.title+'; SKU '+v.sku+'; availability='+v.available+'; '+currency+' currency from official cart context.'});
    break;
  }
  return offers;
}
const EXTRA_SHOPS=[['stanley','https://www.stanley1913.com'],['living proof','https://www.livingproof.com'],['byoma','https://byoma.com'],['huda beauty','https://hudabeauty.com/en-us']];
export async function discoverOfficialAE(line,fetcher=fetch){return discoverOfficialStore(line,norm(line.brand).includes('huda beauty')?'https://hudabeauty.com/en-ae':null,'AE',fetcher);}
export async function discoverOfficialUS(line,fetcher=fetch){return discoverOfficialStore(line,[...SHOPS,...EXTRA_SHOPS].find(([brand])=>norm(line.brand).includes(brand))?.[1],'US',fetcher);}
export async function discoverOfficialUK(line,fetcher=fetch){const brand=norm(line.brand);const base=brand.includes('smeg')?'https://shop.smeguk.com':brand.includes('rhode')?'https://www.rhodeskin.com/en-gb':brand.includes('stanley')?'https://uk.stanley1913.com':brand.includes('huda beauty')?'https://hudabeauty.com/en-gb':null;return discoverOfficialStore(line,base,'UK',fetcher);}
