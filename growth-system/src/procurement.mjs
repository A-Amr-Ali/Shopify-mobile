import { adminQuery } from './catalog.mjs';
import { db } from './db.mjs';

export const MARKETS = Object.freeze({
  AE: { currency:'AED', exchange:15, shipping:900, label:'UAE' },
  US: { currency:'USD', exchange:55, shipping:2500, label:'US' },
  UK: { currency:'GBP', exchange:75, shipping:2500, label:'UK' }
});
export const SOURCE_TTL_MS = 12 * 3600000;
export const ORDER_LIST_QUERY = `query ProcurementOrderList($after:String) { orders(first:50,after:$after,query:"status:open") { nodes { id } pageInfo { hasNextPage endCursor } } }`;
const LINE_FIELDS = `id productTitle variantTitle vendor sku remainingQuantity totalQuantity weight { value unit }
  lineItem { id unfulfilledQuantity customAttributes { key value } discountedUnitPriceAfterAllDiscountsSet { shopMoney { amount currencyCode } }
    product { id handle tags nowVariants:metafield(namespace:"custom",key:"sofie_hours_variants") { jsonValue } collections(first:30) { nodes { handle } pageInfo { hasNextPage endCursor } } } }
  variant { id barcode selectedOptions { name value } }`;
export const ORDER_DETAIL_QUERY = `query ProcurementOrder($id:ID!,$after:String) { order(id:$id) { id name createdAt updatedAt cancelledAt closedAt displayFulfillmentStatus displayFinancialStatus test tags
  fulfillmentOrders(first:10,after:$after) { nodes { id status requestStatus assignedLocation { name location { id } }
    lineItems(first:50) { nodes { ${LINE_FIELDS} } pageInfo { hasNextPage endCursor } }
  } pageInfo { hasNextPage endCursor } } } }`;
export const MORE_LINES_QUERY = `query ProcurementMoreLines($id:ID!,$after:String) { node(id:$id) { ... on FulfillmentOrder { lineItems(first:50,after:$after) { nodes { ${LINE_FIELDS} } pageInfo { hasNextPage endCursor } } } } }`;

export const normal = x => String(x||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const gid = v => /^gid:\/\/shopify\/(Order|ProductVariant)\/\d+$/.test(v||'');
export function kilograms(weight) {
  const scale={KILOGRAMS:1,GRAMS:0.001,POUNDS:0.45359237,OUNCES:0.028349523125};
  const n=Number(weight?.value)*scale[weight?.unit];
  return Number.isFinite(n) && n>0 && n<=100 ? Math.round(n*10000)/10000 : null;
}
export function costEstimate(region, price, weightKg, quantity=1) {
  const market=MARKETS[region]; const p=Number(price); const w=weightKg===null||weightKg===''?NaN:Number(weightKg);
  if(!market || !Number.isFinite(p) || p<=0 || !Number.isInteger(quantity)||quantity<1) return null;
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const purchaseEgp=round(p*1.03*market.exchange);
  const shippingEgp=Number.isFinite(w)&&w>0&&w<=100 ? round(w*market.shipping) : null;
  const landedEgp=shippingEgp===null?null:round(p*1.03*market.exchange+w*market.shipping);
  const targetEgp=landedEgp===null?null:round(p*1.03*market.exchange+w*market.shipping+500);
  return {currency:market.currency,price:p,feePercent:3,exchangeRate:market.exchange,weightKg:shippingEgp===null?null:w,shippingRate:market.shipping,
    purchaseEgp,shippingEgp,marginEgp:500,landedEgp,targetEgp,quantity,totalTargetEgp:targetEgp===null?null:round(targetEgp*quantity)};
}

export function routeLine(line, assignedLocation, override=null) {
  if(override==='sofie'||override==='regular') return {kind:override,evidence:'Staff source override',inferred:false};
  const sourceValues=(line.lineItem?.customAttributes||[]).filter(a=>/^(store|source|fulfillment source|stock source|sofie source)$/.test(normal(a.key))).map(a=>normal(a.value));
  sourceValues.push(normal(assignedLocation));
  if(sourceValues.some(x=>['reglare store','regular store'].includes(x))) return {kind:'regular',evidence:'Explicit Shopify source label',inferred:false};
  if(sourceValues.some(x=>['sofie','sofie store','sofie now'].includes(x))) return {kind:'sofie',evidence:'Explicit Shopify source label',inferred:false};
  const product=line.lineItem?.product;
  const exact=product?.nowVariants?.jsonValue;
  if(Array.isArray(exact)&&exact.length) return {kind:exact.map(String).includes(line.variant?.id)?'sofie':'regular',evidence:'Existing exact SOFIE NOW option list',inferred:true};
  const collections=product?.collections;
  if(collections?.nodes?.some(c=>c.handle==='sofie-hours') || product?.tags?.some(t=>['sofie now','sofie hours'].includes(normal(t))))
    return {kind:'review',evidence:'SOFIE NOW product; exact stocked option is not recorded',inferred:true};
  if(!product || collections?.pageInfo?.hasNextPage || !line.variant) return {kind:'review',evidence:'Missing or incomplete source evidence',inferred:true};
  return {kind:'regular',evidence:'Outside SOFIE NOW; inferred Reglare Store, review before purchase',inferred:true};
}

export function normalizeOrder(order, at=new Date().toISOString()) {
  const deliveredTag=(order?.tags||[]).some(t=>['delivered','out for delivery','in transit','shipped'].includes(normal(t)));
  const active=Boolean(order&&!order.cancelledAt&&!order.closedAt&&!order.test&&!deliveredTag&&!['FULFILLED'].includes(order.displayFulfillmentStatus)&&!['REFUNDED','VOIDED'].includes(order.displayFinancialStatus));
  const warnings=[]; const lines=[];
  for(const fo of order?.fulfillmentOrders?.nodes||[]) {
    if(['CANCELLED','CLOSED','INCOMPLETE'].includes(fo.status)) continue;
    for(const item of fo.lineItems.nodes||[]) {
      const qty=Math.max(0,Math.min(item.remainingQuantity,item.lineItem?.unfulfilledQuantity??item.remainingQuantity));
      if(!qty) continue;
      const route=routeLine(item,fo.assignedLocation?.name);
      const hold=fo.status==='ON_HOLD'||fo.status==='SCHEDULED'||fo.requestStatus==='CANCELLATION_REQUESTED';
      lines.push({lineId:item.lineItem.id,fulfillmentLineId:item.id,fulfillmentOrderId:fo.id,variantId:item.variant?.id||'missing:'+item.lineItem.id,
        productId:item.lineItem.product?.id||null,handle:item.lineItem.product?.handle||null,title:item.productTitle,brand:item.vendor||'',option:item.variantTitle||'Default',
        options:item.variant?.selectedOptions||[],sku:item.sku||'',barcode:item.variant?.barcode||'',quantity:qty,
        weightKg:kilograms(item.weight),weightSource:kilograms(item.weight)?'Shopify shipping weight':'Missing shipping weight',
        source:route,hold,fulfillmentStatus:fo.status,location:fo.assignedLocation?.name||'',
        salePrice:Number(item.lineItem.discountedUnitPriceAfterAllDiscountsSet?.shopMoney?.amount||0),saleCurrency:item.lineItem.discountedUnitPriceAfterAllDiscountsSet?.shopMoney?.currencyCode||'EGP'});
    }
  }
  if(lines.some(l=>l.source.inferred)) warnings.push('Sofie/Reglare labels are absent in Shopify; routing uses SOFIE NOW evidence and is labelled as inferred.');
  return {order_id:order.id,order_name:order.name,created_at:order.createdAt,shopify_updated_at:order.updatedAt,scanned_at:at,active,
    fulfillment_status:order.displayFulfillmentStatus,lines,warnings};
}

async function loadOrder(id) {
  let after=null; let order=null;
  do {
    const next=(await adminQuery(ORDER_DETAIL_QUERY,{id,after})).order;
    if(!next) return null;
    if(!order) order={...next,fulfillmentOrders:{nodes:[],pageInfo:next.fulfillmentOrders.pageInfo}};
    for(const fo of next.fulfillmentOrders.nodes) {
      let cursor=fo.lineItems.pageInfo.hasNextPage?fo.lineItems.pageInfo.endCursor:null;
      while(cursor) {
        const more=(await adminQuery(MORE_LINES_QUERY,{id:fo.id,after:cursor})).node?.lineItems;
        if(!more) throw new Error('fulfillment_lines_unavailable');
        fo.lineItems.nodes.push(...more.nodes);
        cursor=more.pageInfo.hasNextPage?more.pageInfo.endCursor:null;
      }
      order.fulfillmentOrders.nodes.push(fo);
    }
    after=next.fulfillmentOrders.pageInfo.hasNextPage?next.fulfillmentOrders.pageInfo.endCursor:null;
  }while(after);
  return order;
}

export async function syncOneOrder(id) {
  if(!gid(id)||!id.includes('/Order/')) throw new Error('invalid_order');
  const order=await loadOrder(id);
  if(!order) return null;
  const row=normalizeOrder(order);
  await db('procurement_orders?on_conflict=order_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:row});
  await db('procurement_orders?order_id=eq.'+encodeURIComponent(id)+'&shopify_updated_at=lte.'+encodeURIComponent(row.shopify_updated_at),{method:'PATCH',prefer:'return=minimal',body:row});
  return row;
}
let syncFlight=null;
export function syncProcurement() {
  if(syncFlight) return syncFlight;
  syncFlight=(async()=>{
    const started=new Date().toISOString(); const ids=[];let after=null;
    do {const page=(await adminQuery(ORDER_LIST_QUERY,{after})).orders;ids.push(...page.nodes.map(x=>x.id));after=page.pageInfo.hasNextPage?page.pageInfo.endCursor:null;}while(after);
    const summary={state:'ready',startedAt:started,openOrders:ids.length,scanned:0,errors:[]};
    // Include previously open orders: closed/fulfilled orders must leave the queue.
    const prior=await allRows('procurement_orders','select=order_id&active=eq.true');
    for(const id of new Set([...ids,...prior.map(x=>x.order_id)])) {
      try {await syncOneOrder(id);summary.scanned++;}catch(e){summary.errors.push({orderId:id,error:e.message});}
    }
    if(summary.errors.length) summary.state='partial';
    summary.finishedAt=new Date().toISOString();
    await db('procurement_runs',{method:'POST',body:{kind:'order_sync',summary}});
    return summary;
  })().finally(()=>{syncFlight=null;});
  return syncFlight;
}

export async function allRows(table,query='') {
  const rows=[];
  for(let offset=0;;offset+=500){const page=await db(table+'?'+query+(query?'&':'')+'limit=500&offset='+offset);rows.push(...page);if(page.length<500)break;}
  return rows;
}

// Only Sephora or the product's official brand website is accepted.
const BRANDS=[
  ['rhode',['rhodeskin.com']],['k18',['k18hair.com','k18hair.ae','k18hair.co.uk']],['clinique',['clinique.com','clinique.co.uk','clinique-me.com']],
  ['tarte',['tartecosmetics.com']],['briogeo',['briogeohair.com']],['charlotte tilbury',['charlottetilbury.com']],['huda beauty',['hudabeauty.com']],
  ['makeup by mario',['makeupbymario.com']],['milk makeup',['milkmakeup.com']],['kosas',['kosas.com']],['dior',['dior.com']],
  ['one size',['onesizebeauty.com']],['kiehl',['kiehls.com','kiehls.ae','kiehls.co.uk']],['stanley',['stanley1913.com','stanley1913.ae','uk.stanley1913.com']],
  ['smeg',['smeg.com']],['blond amsterdam',['blond-amsterdam.com']],['beauty blender',['beautyblender.com','beautyblender.co.uk']],
  ['sol de janeiro',['soldejaneiro.com']],['ouai',['theouai.com','theouai.co.uk']],['owala',['owalalife.com']],['slip',['slip.com','slip.co.uk']],
  ['josie maran',['josiemaran.com']],['24bottle',['24bottles.com']],['fenty',['fentybeauty.com','fentyskin.com']],
  ['patrick ta',['patrickta.com']],['living proof',['livingproof.com']],['rare beauty',['rarebeauty.com']],['tower 28',['tower28beauty.com']],
  ['grande',['grandecosmetics.com']],['benefit',['benefitcosmetics.com']],['amika',['loveamika.com']],['color wow',['colorwowhair.com']],
  ['smashbox',['smashbox.com','smashbox.co.uk']],['summer fridays',['summerfridays.com']],['saie',['saiehello.com']],['hourglass',['hourglasscosmetics.com']]
];
export function allowedSource(url,brand,region) {
  let u;try{u=new URL(url);}catch{return false;}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!MARKETS[region])return false;
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(['sephora.me','sephora.ae'].includes(host))return region==='AE'&&(/^\/ae(?:-en|-ar)?(?:\/|$)/.test(u.pathname)||host==='sephora.ae');
  if(host==='sephora.com')return region==='US'&&!/^\/ca(?:\/|$)/.test(u.pathname);
  if(host==='sephora.co.uk')return region==='UK';
  const name=normal(brand); const allowed=BRANDS.filter(([b])=>name.includes(b)).flatMap(([,domains])=>domains);
  return allowed.some(d=>host===d||host.endsWith('.'+d));
}
export function validSource(row, now=Date.now()) {
  return row?.exact_match===true&&row.stock_status==='in_stock'&&Number(row.price)>0&&MARKETS[row.region]?.currency===row.currency&&
    Number.isFinite(Date.parse(row.verified_at))&&Date.parse(row.verified_at)<=now+60000&&now-Date.parse(row.verified_at)<SOURCE_TTL_MS;
}
export function chooseSource(sources,brand,now=Date.now()) {
  for(const region of ['AE','US','UK']) {
    const matches=sources.filter(s=>s.region===region&&allowedSource(s.url,brand,region)&&validSource(s,now));
    if(matches.length)return matches.sort((a,b)=>Number(a.price)-Number(b.price))[0];
  }
  return null;
}

export async function procurementDashboard() {
  const [orders,options,sources,purchases,runs]=await Promise.all([
    allRows('procurement_orders','order=created_at.asc'),allRows('procurement_options'),allRows('procurement_sources'),
    allRows('procurement_purchases','voided_at=is.null&order=created_at.desc'),db('procurement_runs?order=created_at.desc&limit=6')]);
  const optionMap=new Map(options.map(x=>[x.variant_id,x])); const lines=[];
  for(const order of orders) for(const original of order.lines) {
    const option=optionMap.get(original.variantId);const source=option?.source_override?{kind:option.source_override,evidence:'Staff source override',inferred:false}:original.source;
    const bought=purchases.filter(p=>p.order_id===order.order_id&&p.line_id===original.lineId).reduce((n,p)=>n+p.quantity,0);
    const outstanding=Math.max(0,original.quantity-bought);
    const offers=sources.filter(s=>s.variant_id===original.variantId);
    const selected=chooseSource(offers,original.brand);
    const weight=option?.weight_kg?Number(option.weight_kg):original.weightKg;
    const stale=Date.now()-Date.parse(order.scanned_at)>15*60000;
    const status=!order.active?'completed':source.kind==='sofie'?'local_stock':!outstanding?'purchased':original.hold?'on_hold':stale?'sync_needed':source.kind==='review'?'source_review':selected?'ready':'needs_sourcing';
    lines.push({...original,source,orderId:order.order_id,orderName:order.order_name,orderCreatedAt:order.created_at,scannedAt:order.scanned_at,active:order.active,
      purchased:bought,outstanding,weightKg:weight,weightSource:option?.weight_kg?'Staff shipping weight':original.weightSource,status,
      selectedSource:selected,offers:offers.map(s=>({...s,currentlyVerified:validSource(s)&&allowedSource(s.url,original.brand,s.region)})),
      cost:selected?costEstimate(selected.region,selected.price,weight,outstanding||1):null});
  }
  const demand=new Map();
  for(const line of lines.filter(l=>l.active&&l.outstanding>0&&!['local_stock','on_hold'].includes(l.status))) {
    if(!demand.has(line.variantId))demand.set(line.variantId,{variantId:line.variantId,title:line.title,brand:line.brand,option:line.option,quantity:0,orders:[],status:line.status,
      source:line.source,weightKg:line.weightKg,selectedSource:line.selectedSource,cost:line.cost});
    const row=demand.get(line.variantId);row.quantity+=line.outstanding;row.orders.push({orderName:line.orderName,orderId:line.orderId,lineId:line.lineId,quantity:line.outstanding,status:line.status});
    if(line.status!=='ready')row.status=line.status;
  }
  for(const row of demand.values()) row.cost=row.selectedSource?costEstimate(row.selectedSource.region,row.selectedSource.price,row.weightKg,row.quantity):null;
  const openLines=lines.filter(l=>l.active);
  const count=status=>openLines.filter(l=>l.status===status).reduce((n,l)=>n+l.outstanding,0);
  const summary={openOrders:orders.filter(o=>o.active).length,needToBuy:[...demand.values()].reduce((n,r)=>n+r.quantity,0),uniqueOptions:demand.size,
    ready:count('ready'),needsSourcing:count('needs_sourcing'),sourceReview:count('source_review'),held:count('on_hold'),localSkipped:count('local_stock'),
    purchased:purchases.reduce((n,p)=>n+p.quantity,0),missingWeights:[...demand.values()].filter(x=>!x.weightKg).length,
    pricedTotal:[...demand.values()].reduce((n,r)=>n+(r.cost?.totalTargetEgp||0),0)};
  return {generatedAt:new Date().toISOString(),summary,lines,demand:[...demand.values()],purchases,runs,markets:MARKETS,
    sourceExpiryHours:SOURCE_TTL_MS/3600000,routingNotice:'Outside SOFIE NOW is inferred as Reglare Store. SOFIE NOW products without exact-option stock evidence require source review. You can override the source on each option.',
    dailyReport:{timezone:'Africa/Cairo',window:'Every morning, around 08:00',delivery:'ChatGPT notification'}};
}

export async function saveOption(body) {
  if(!gid(body.variantId)||!body.variantId.includes('/ProductVariant/'))throw new Error('invalid_variant');
  const patch={variant_id:body.variantId,updated_at:new Date().toISOString()};
  if('weightKg'in body){const w=body.weightKg===null||body.weightKg===''?null:Number(body.weightKg);if(w!==null&&(!Number.isFinite(w)||w<=0||w>100))throw new Error('invalid_weight');patch.weight_kg=w;}
  if('source'in body){if(![null,'sofie','regular'].includes(body.source))throw new Error('invalid_source');patch.source_override=body.source;}
  await db('procurement_options?on_conflict=variant_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{variant_id:body.variantId}});
  return db('procurement_options?variant_id=eq.'+encodeURIComponent(body.variantId),{method:'PATCH',body:patch});
}
export async function saveSource(body) {
  if(!gid(body.variantId)||!MARKETS[body.region])throw new Error('invalid_source');
  const data=await procurementDashboard();const line=data.lines.find(l=>l.variantId===body.variantId);
  if(!line||!allowedSource(body.url,line.brand,body.region))throw new Error('invalid_official_source');
  if(typeof body.evidence!=='string'||body.evidence.trim().length<10||body.evidence.length>1500)throw new Error('invalid_evidence');
  if(!['in_stock','out_of_stock','unverified','not_found'].includes(body.stockStatus))throw new Error('invalid_stock_status');
  const at=body.verifiedAt||new Date().toISOString();
  if(!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.now()+60000)throw new Error('invalid_verified_time');
  const price=body.price===''||body.price===null?null:Number(body.price);
  if(price!==null&&(!Number.isFinite(price)||price<=0))throw new Error('invalid_price');
  const row={variant_id:body.variantId,region:body.region,retailer:String(body.retailer||new URL(body.url).hostname).slice(0,100),url:body.url,
    supplier_variant_id:body.supplierVariantId||null,matched_title:line.title,matched_option:line.option,exact_match:body.exactMatch===true,
    stock_status:body.stockStatus,price,currency:MARKETS[body.region].currency,evidence:body.evidence,
    verification_method:['official_page','official_json','staff_checked'].includes(body.verificationMethod)?body.verificationMethod:'staff_checked',verified_at:at,checked_at:new Date().toISOString()};
  return db('procurement_sources?on_conflict=variant_id,region,url',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:row});
}
export async function recordPurchase(body) {
  if(!gid(body.orderId)||!gid(body.variantId)||!/^gid:\/\/shopify\/LineItem\/\d+$/.test(body.lineId)||!Number.isInteger(body.quantity)||body.quantity<1||!body.requestId)throw new Error('invalid_purchase');
  // Always re-read the order immediately before acknowledging a purchase.
  await syncOneOrder(body.orderId);
  const data=await procurementDashboard();const line=data.lines.find(l=>l.orderId===body.orderId&&l.lineId===body.lineId&&l.variantId===body.variantId);
  if(!line||!line.active||line.source.kind==='sofie'||line.hold)throw new Error('invalid_purchase_line');
  return db('rpc/procurement_record_purchase',{method:'POST',body:{p_request_id:body.requestId,p_order_id:body.orderId,p_line_id:body.lineId,p_variant_id:body.variantId,p_quantity:body.quantity,p_source_id:body.sourceId||null,p_note:String(body.note||'').slice(0,500)}});
}
export async function undoPurchase(id) {
  if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('invalid_purchase');
  return db('procurement_purchases?id=eq.'+id+'&voided_at=is.null',{method:'PATCH',body:{voided_at:new Date().toISOString()}});
}

// Refresh only an explicitly matched official Shopify variant. Pages without
// machine-readable, exact option evidence remain unverified; no stock is guessed.
export async function recheckSource(source,brand,fetcher=fetch) {
  if(!allowedSource(source.url,brand,source.region))return {stock_status:'unverified',checked_at:new Date().toISOString()};
  const u=new URL(source.url);const m=u.pathname.match(/^(.*\/products\/[^/]+?)(?:\.js|\.json)?\/?$/);
  if(!m||!source.supplier_variant_id)return {checked_at:new Date().toISOString()};
  try{
    const r=await fetcher(u.origin+m[1]+'.js',{redirect:'error',signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
    if(!r.ok)throw new Error('http');const p=await r.json();
    const variant=p.variants?.find(v=>String(v.id)===String(source.supplier_variant_id));
    if(!variant)return {stock_status:'unverified',checked_at:new Date().toISOString()};
    const at=new Date().toISOString();
    // A source's market currency was established on the original official page.
    // Require it again from the official cart's current localization context.
    const cart=await fetcher(u.origin+u.pathname.split('/products/')[0]+'/cart.js',{redirect:'error',signal:AbortSignal.timeout(10000),headers:{accept:'application/json'}});
    const context=cart.ok?await cart.json():null;
    if(context?.currency!==source.currency) return {stock_status:'unverified',checked_at:at};
    return {stock_status:variant.available===true?'in_stock':'out_of_stock',price:Number(variant.price)/100,
      verified_at:at,checked_at:at,verification_method:'official_json',evidence:'Official product JSON exact variant '+variant.id+' ('+variant.title+'); availability='+variant.available+'; official cart currency='+context.currency};
  }catch{return {stock_status:'unverified',checked_at:new Date().toISOString()};}
}
export async function refreshProcurementSources() {
  const data=await procurementDashboard();let checked=0;
  for(const group of data.demand){for(const source of data.lines.find(l=>l.variantId===group.variantId)?.offers||[]){
    const result=await recheckSource(source,group.brand);await db('procurement_sources?id=eq.'+source.id,{method:'PATCH',body:result});checked++;
  }}
  return {checked};
}

export function exportCsv(data) {
  const fields=['Product','Brand','Exact option','Quantity','Orders','Status','Country','Verified purchase URL','Supplier price','Currency','Weight kg','Landed EGP / pc','Target EGP / pc','Target EGP total','Stock checked at'];
  const csv=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  const rows=data.demand.map(r=>[r.title,r.brand,r.option,r.quantity,r.orders.map(o=>o.orderName+' ×'+o.quantity).join('; '),r.status,r.selectedSource?.region,
    r.selectedSource?.url,r.selectedSource?.price,r.selectedSource?.currency,r.weightKg,r.cost?.landedEgp,r.cost?.targetEgp,r.cost?.totalTargetEgp,r.selectedSource?.verified_at]);
  return '\ufeff'+[fields,...rows].map(row=>row.map(csv).join(',')).join('\r\n');
}
