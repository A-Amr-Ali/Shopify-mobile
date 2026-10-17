// SOFIE 365 purchase-led email recommendations; no API calls or auto-sends.
// Never infer occupation, income, religion or identity from an email address.
const day=86400000;
const age=(timestamp,now)=>(now-new Date(timestamp).getTime())/day;
const unique=x=>[...new Set((x||[]).filter(Boolean))];
function sellable(p){
 if(!p||!p.handle||!p.category||p.published!==true||p.availableForSale!==true) return false;
 if(!(Number(p.sellableVariantQuantity)>0)||!(Number(p.priceEGP)>0)) return false;
 try {const u=new URL(p.url);return u.protocol==='https:'&&['sofiestore.net','www.sofiestore.net'].includes(u.hostname)&&u.pathname.startsWith('/products/');}catch{return false;}
}
export function planPersonalizedEmail({profile,products=[],campaign={},sentHistory=[],now=new Date()}){
 now=new Date(now);if(!Number.isFinite(now.getTime()))throw new Error('invalid_now');
 const blockers=[];
 if(profile?.emailMarketingConsent!=='SUBSCRIBED'||profile?.suppressed||profile?.optedOut)blockers.push('no_explicit_marketing_consent');
 const recent=sentHistory.filter(x=>x.status==='sent'&&Number.isFinite(new Date(x.sentAt).getTime())).filter(x=>age(x.sentAt,now)>=0);
 if(recent.some(x=>age(x.sentAt,now)<3))blockers.push('promotional_spacing_72h');
 if(recent.filter(x=>age(x.sentAt,now)<=7).length>=2)blockers.push('weekly_promotional_cap');
 if(campaign.kind==='trend'&&recent.some(x=>x.kind==='trend'&&age(x.sentAt,now)<7))blockers.push('trend_cooldown');
 if(campaign.kind==='trend'&&unique(campaign.evidenceUrls).length<2)blockers.push('insufficient_trend_evidence');
 if(campaign.timingConfidence==='lunar_tentative'&&!campaign.officialDateConfirmed)blockers.push('holiday_date_not_confirmed');
 if(campaign.treatment==='respectful_greeting'&&campaign.includeDiscount)blockers.push('no_discounts_on_remembrance');
 const favorites=new Set(unique(profile?.preferredCategories));
 const browsed=new Set(unique(profile?.recentBrowsedCategories));
 const bought=new Set(unique(profile?.purchasedCategories));
 const recentProductHandles=new Set(unique(profile?.recentlyPurchasedHandles));
 const preferredBrands=new Set(unique(profile?.preferredBrands));
 const ranked=products.filter(sellable).filter(p=>!recentProductHandles.has(p.handle))
  .map(p=>({p,score:(favorites.has(p.category)?7:0)+(browsed.has(p.category)?4:0)+(bought.has(p.category)?2:0)+(campaign.category===p.category?5:0)+(preferredBrands.has(p.brand)?2:0)}))
  .sort((a,b)=>b.score-a.score||a.p.handle.localeCompare(b.p.handle));
 const recommendations=campaign.treatment==='respectful_greeting'?[]:ranked.slice(0,3).map(({p,score})=>({handle:p.handle,title:p.title,url:p.url,priceEGP:Number(p.priceEGP),rankingScore:score}));
 if(campaign.treatment!=='respectful_greeting'&&recommendations.length===0)blockers.push('no_verified_sellable_products');
 return {status:blockers.length?'blocked':'ready_for_review',blockers,recommendations,sendAutomatically:false,
  usedSignals:['explicit_preferences','purchase_category','onsite_behavior','verified_live_catalog'],
  professionInferred:false,notes:'Recheck Klaviyo consent, exact variant stock, links, prices and campaign QA at send time.'};
}
export function canQueueMarketingEmail({decision,campaign,profile}){
 return Boolean(decision?.status==='ready_for_review'&&decision?.blockers?.length===0&&
 profile?.emailMarketingConsent==='SUBSCRIBED'&&!profile?.suppressed&&!profile?.optedOut&&
 campaign?.approved===true&&campaign?.qualityAssurancePassed===true&&campaign?.autoSendEnabled===true);
}
