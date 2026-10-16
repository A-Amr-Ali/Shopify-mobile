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
const coreShade=x=>norm(String(x).split(/\s[-–—]\s/)[0]);
function sizes(s){return [...String(s||'').toLowerCase().matchAll(/(\d*\.?\d+)\s*(?:fl\.?\s*)?(ml|oz|grams?|g|litres?|liters?|l)\b/g)].map(m=>({n:Number(m[1]),u:/^gram/.test(m[2])?'g':/^(l|litre|liter)/.test(m[2])?'l':m[2]}));}
export function exactOption(line,attribute,description=''){
  const opts=(line.options||[]).filter(o=>norm(o.value)!=='default title');
  for(const o of opts){const kind=norm(o.name);if(['color','colour','shade','model','material','style'].includes(kind)){
    const a=norm(attribute),wanted=coreShade(o.value);if(!(a===wanted||a.startsWith(wanted+' ')||a.endsWith(' '+wanted)||a.includes(' '+wanted+' ')))return false;
  }}
  const size=opts.find(o=>norm(o.name)==='size');
  if(size){const wanted=sizes(size.value),actual=sizes(attribute+' '+text(description));
    if(wanted.length){if(!wanted.some(w=>actual.some(a=>w.u===a.u&&Math.abs(w.n-a.n)<Math.max(.001,w.n*.01))))return false;}
    else if(!norm(attribute+' '+description).includes(norm(size.value)))return false;
  }
  return true;
}
function titleKey(s){return norm(s).replace(/^rhode /,'').replace('futureiq','future iq').replace(' cream blush for cheeks lips','').replace(/[^a-z0-9]/g,'');}
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
export async function checkSephoraSource(source,fetcher=fetch){try{return sephoraVerification(parseSephora(await read(source.url,fetcher)),source.supplier_variant_id);}catch{return {stock_status:'unverified',checked_at:new Date().toISOString()};}}
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
    const variants=p.c_variantsInfo.filter(v=>exactOption(line,v.c_variation_attribute_name,p.longDescription));
    if(variants.length!==1)continue;
    const v=variants[0],check=sephoraVerification(parsed,v.product_id);
    offers.push({variant_id:line.variantId,region:'AE',retailer:'Sephora UAE',url:url+'?productVariantId='+v.product_id,supplier_variant_id:String(v.product_id),
      matched_title:line.title,matched_option:line.option,exact_match:true,currency:'AED',price:Number(v.c_salesPrice)>0?Number(v.c_salesPrice):Number(v.c_price),
      stock_status:'unverified',verified_at:new Date().toISOString(),checked_at:new Date().toISOString(),verification_method:'official_page',evidence:'Exact product and option found; selected-shade stock requires verification.',...check});
    break;
  }
  return offers;
}
const SHOPS=[['rhode','https://www.rhodeskin.com'],['k18','https://www.k18hair.com'],['briogeo','https://www.briogeohair.com'],['makeup by mario','https://www.makeupbymario.com'],['kosas','https://kosas.com'],['one size','https://www.onesizebeauty.com'],['beauty blender','https://beautyblender.com'],['sol de janeiro','https://soldejaneiro.com'],['ouai','https://theouai.com'],['owala','https://owalalife.com'],['josie maran','https://www.josiemaran.com'],['patrick ta','https://patrickta.com'],['rare beauty','https://www.rarebeauty.com'],['tower 28','https://www.tower28beauty.com'],['grande','https://grandecosmetics.com'],['amika','https://loveamika.com'],['color wow','https://colorwowhair.com'],['summer fridays','https://summerfridays.com'],['saie','https://saiehello.com']];
export async function discoverOfficialUS(line,fetcher=fetch){
  const base=SHOPS.find(([brand])=>norm(line.brand).includes(brand))?.[1];if(!base)return [];
  const cart=JSON.parse(await read(base+'/cart.js',fetcher));if(cart.currency!=='USD')return [];
  const shade=(line.options||[]).find(o=>['color','colour','shade'].includes(norm(o.name)));
  const shadeSlug=shade?coreShade(shade.value).replaceAll(' ','-'):'';
  const basic=norm(line.title).replace(/^rhode /,'').replace(' cream blush for cheeks lips','').replaceAll(' ','-');
  const candidates=new Set([line.handle,basic,...(shadeSlug?[basic+'-'+shadeSlug,line.handle+'-'+shadeSlug]:[])].filter(Boolean));
  try{const s=JSON.parse(await read(base+'/search/suggest.json?q='+encodeURIComponent(line.title)+'&resources[type]=product&resources[limit]=10',fetcher));for(const p of s.resources?.results?.products||[])if(p.handle)candidates.add(p.handle);}catch{}
  const offers=[];
  for(const handle of [...candidates].slice(0,12)){
    let p;try{p=JSON.parse(await read(base+'/products/'+encodeURIComponent(handle)+'.js',fetcher));}catch{continue;}
    let name=p.title;if(shadeSlug)name=norm(name).replace(new RegExp(' '+coreShade(shade.value)+'$'),'');
    if(!titleMatches(line.title,name)||!brandMatches(line.brand,p.vendor||line.brand))continue;
    const vs=(p.variants||[]).filter(v=>exactOption(line,p.title+' '+v.title,p.description));
    if(vs.length!==1)continue;const v=vs[0];const at=new Date().toISOString();
    offers.push({variant_id:line.variantId,region:'US',retailer:new URL(base).hostname.replace(/^www\./,''),url:base+'/products/'+p.handle+'?variant='+v.id,
      supplier_variant_id:String(v.id),matched_title:line.title,matched_option:line.option,exact_match:true,stock_status:v.available===true?'in_stock':'out_of_stock',
      price:Number(v.price)/100,currency:'USD',verified_at:at,checked_at:at,verification_method:'official_json',
      evidence:'Official US product JSON: '+p.title+'; exact variant '+v.id+' '+v.title+'; availability='+v.available+'; USD currency from official cart context.'});
    break;
  }
  return offers;
}
