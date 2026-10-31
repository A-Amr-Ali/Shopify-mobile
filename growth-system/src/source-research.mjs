import { discoverSephora, discoverSephoraUS, discoverSephoraUK, discoverOfficialAE, discoverOfficialUS, discoverOfficialUK, discoverUltaUS } from './supplier-checks.mjs';
import { officialStores, sourcePriority } from './supplier-registry.mjs';

export const SOURCING_VERSION='2026-10-31.2';
export const SOURCE_STAGES=Object.freeze([
  {id:'sephora_ae',label:'Sephora UAE',region:'AE',discover:discoverSephora},
  {id:'sephora_us',label:'Sephora US',region:'US',discover:discoverSephoraUS},
  {id:'sephora_uk',label:'Sephora UK',region:'UK',discover:discoverSephoraUK},
  {id:'official_ae',label:'Official brand UAE',region:'AE',official:true,discover:discoverOfficialAE},
  {id:'official_us',label:'Official brand US',region:'US',official:true,discover:discoverOfficialUS},
  {id:'official_uk',label:'Official brand UK',region:'UK',official:true,discover:discoverOfficialUK},
  {id:'ulta_us',label:'Ulta Beauty US',region:'US',discover:discoverUltaUS}
]);
export function researchDue(last,now=Date.now()) {
  return !last||last.summary?.version!==SOURCING_VERSION||!Number.isFinite(Date.parse(last.summary.nextRetryAt))||Date.parse(last.summary.nextRetryAt)<=now;
}
// Fresh/unresearched demand goes first; then rotate oldest completed research.
// Repeatedly retrying recent blocked orders must not starve the older queue.
export function compareResearchPriority(a,b) {
  const finished=row=>Date.parse(row.research?.finishedAt)||0;
  const first=row=>row.research?.version!==SOURCING_VERSION||!finished(row);
  if(first(a)!==first(b))return first(a)?-1:1;
  return (first(a)?0:finished(a)-finished(b))||(b.newestOrderAt||0)-(a.newestOrderAt||0);
}
export function supplierError(error) {
  const message=String(error?.message||error);
  if(/403|401|Access Denied|Forbidden/i.test(message))return {status:'blocked',detail:'Supplier denied automated access; stock was not assumed.'};
  if(/429/.test(message))return {status:'rate_limited',detail:'Supplier rate limit; a retry is scheduled.'};
  if(/official_market_not_advertised/.test(message))return {status:'market_unavailable',detail:'The approved brand site does not advertise a store for this market; checking the next market.'};
  if(/format_unavailable|Unexpected token|JSON/.test(message))return {status:'format_changed',detail:'Supplier page format needs a compatible verifier.'};
  if(/timeout|abort|fetch|ECONN|ENOTFOUND|supplier_http_5/i.test(message))return {status:'temporary_error',detail:'Supplier could not be reached; a retry is scheduled.'};
  return {status:'verification_needed',detail:message.slice(0,180)};
}
// Dependencies are injectable for deterministic regression tests. Known URLs are
// refreshed first within their own stage; they never bypass a higher-priority stage.
export async function researchProduct(line,{stages=SOURCE_STAGES,knownSources=[],recheck,allowed=()=>true,isVerified=()=>false,fetcher=fetch}={}) {
  const summary={variantId:line.variantId,version:SOURCING_VERSION,startedAt:new Date().toISOString(),attempts:[],regionsChecked:[],errors:[]};
  const offers=[];
  for(let index=0;index<stages.length;index++){
    const stage=stages[index],attempt={supplier:stage.label,stage:stage.id,region:stage.region,checkedAt:new Date().toISOString()};
    if(!summary.regionsChecked.includes(stage.region))summary.regionsChecked.push(stage.region);
    if(stage.official&&!officialStores(line.brand,stage.region).length&&!officialStores(line.brand,'US').length){
      summary.attempts.push({...attempt,status:'not_configured',detail:'No approved '+stage.region+' official store is registered for this brand. This does not mean the product does not exist.'});continue;
    }
    let found=[];
    try{
      if(recheck)for(const prior of knownSources.filter(s=>sourcePriority(s)===index&&allowed(s,line.brand))){
        const check=await recheck(prior,line.brand,fetcher,line);found.push({...prior,...check});
      }
      if(!found.some(o=>allowed(o,line.brand)&&isVerified(o)))found.push(...await stage.discover(line,fetcher));
      found=found.filter(o=>allowed(o,line.brand));offers.push(...found);
      const ready=found.filter(o=>isVerified(o)),exact=found.filter(o=>o.exact_match);
      const status=ready.length?'in_stock':exact.some(o=>o.stock_status==='out_of_stock')?'out_of_stock':found.length?'verification_needed':'no_exact_match';
      summary.attempts.push({...attempt,status,offers:found.length,detail:ready.length?'Exact option, stock, price and market verified.':status==='out_of_stock'?'Exact option found but unavailable; continuing to the next supplier.':found.length?'Product found; exact option or current stock needs confirmation.':'No exact option found by this supplier check; continuing research.'});
      if(ready.length){summary.state='ready';break;}
    }catch(error){
      // Preserve a refreshed unavailable/candidate URL even if the supplier's
      // search endpoint fails afterwards. It must not vanish from the desk.
      offers.push(...found.filter(o=>allowed(o,line.brand)));
      const info=supplierError(error);summary.attempts.push({...attempt,...info,offers:found.length});summary.errors.push(stage.label+': '+String(error.message||error).slice(0,180));
    }
  }
  const unique=[...new Map(offers.map(o=>[o.variant_id+'|'+o.region+'|'+o.url,o])).values()];
  summary.state||='research_needed';summary.offers=unique.length;summary.verified=unique.filter(isVerified).length;
  summary.finishedAt=new Date().toISOString();
  const transient=summary.attempts.some(a=>['blocked','rate_limited','temporary_error'].includes(a.status));
  summary.nextRetryAt=new Date(Date.now()+(summary.state==='ready'?6*3600000:transient?15*60000:60*60000)).toISOString();
  summary.remaining=summary.state==='ready'?'Verified source available.':'Research continues: inspect the supplier-by-supplier results or paste a known approved product link.';
  return {offers:unique,summary};
}

