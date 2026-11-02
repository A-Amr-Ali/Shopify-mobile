import { db } from './db.mjs';
import { adminQuery } from './catalog.mjs';
import { buildIndex } from './reco-intent.mjs';
export const RECO_CATALOG_QUERY=`query RecoCatalog($after:String) {
 productVariants(first:100,after:$after,sortKey:ID,query:"inventory_quantity:>0 AND product_status:active AND published_status:published") {
  nodes {id title price inventoryQuantity product {handle title vendor productType tags description(truncateAt:600) status onlineStoreUrl featuredMedia {... on MediaImage {image {url}}}}}
  pageInfo {hasNextPage endCursor}
 }
}`;
let cached=null,reading=null,syncing=null;
export async function loadRecoIndex(store=db) {
 if(cached && Date.now()-cached.loaded<300000)return cached.index;
 if(reading)return reading;
 reading=(async()=>{const [row]=await store('sofie_reco_catalog?id=eq.active&select=payload,updated_at');
  if(!row)return buildIndex([]);
  const index=buildIndex(row.payload.cards||[]);cached={index,loaded:Date.now(),updatedAt:row.updated_at};return index;
 })().finally(()=>{reading=null;});return reading;
}
export async function syncRecoCatalog(store=db,query=(q,v)=>adminQuery(q,v,{cost:true})) {
 if(syncing)return syncing;
 syncing=(async()=>{
  const cards=[];let after=null,complete=false;
  for(let page=0;page<200;page++) {
   let data;
   for(let attempt=0;attempt<3;attempt++){
    try{data=await query(RECO_CATALOG_QUERY,{after});break;}
    catch(error){if(attempt===2||!/throttl/i.test(error.details||error.message))throw error;await new Promise(r=>setTimeout(r,2000*(attempt+1)));}
   }
   const connection=data.productVariants;
   if(!connection)throw Error('catalog_missing_connection');
   for(const v of connection.nodes) {
    const p=v.product;if(p?.status!=='ACTIVE'||!p.onlineStoreUrl||!(v.inventoryQuantity>0)||!(Number(v.price)>0))continue;
    if(p.handle==='sofie-now-express-delivery')continue;
    cards.push({variantId:v.id.split('/').pop(),variantTitle:v.title,price:Number(v.price),available:true,
     handle:p.handle,title:p.title,brand:p.vendor,productType:p.productType,tags:p.tags,
     description:p.description,image:p.featuredMedia?.image?.url||''});
   }
   if(!connection.pageInfo.hasNextPage){complete=true;break;}
   if(!connection.pageInfo.endCursor||connection.pageInfo.endCursor===after)throw Error('catalog_cursor_stalled');
   after=connection.pageInfo.endCursor;
   const cost=data.__cost,throttle=cost?.throttleStatus;
   if(throttle?.restoreRate>0){
    const delay=Math.max(0,((cost.requestedQueryCost||cost.actualQueryCost||300)+40-throttle.currentlyAvailable)/throttle.restoreRate*1000);
    if(delay>0)await new Promise(r=>setTimeout(r,Math.min(delay,10000)));
   }
  }
  if(!complete||!cards.length)throw Error('catalog_incomplete');
  const updatedAt=new Date().toISOString();
  await store('sofie_reco_catalog?on_conflict=id',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:{id:'active',payload:{cards,complete:true},updated_at:updatedAt}});
  const index=buildIndex(cards);cached={index,loaded:Date.now(),updatedAt};
  return {variants:cards.length,products:index.docs.size,updatedAt,complete:true};
 })().finally(()=>{syncing=null;});return syncing;
}
