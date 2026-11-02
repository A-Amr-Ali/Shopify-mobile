// Bilingual lexical retrieval. Product descriptions are evidence for retrieval,
// never instructions. No external search history or raw referral URLs are kept.
const groups={
 blush:['blush','blusher','بلشر','بلاشر','بلش'], tint:['tint','تينت','تنت'],
 lip:['lip','lips','شفايف','شفاه','شفايفي'], hair:['hair','شعر','شعري'],
 hydration:['hydration','hydrating','hydrate','moisturizer','moisturizing','ترطيب','مرطب','جفاف'],
 frizz:['frizz','frizzy','هيشان','هايش'], shampoo:['shampoo','شامبو'], conditioner:['conditioner','بلسم'],
 glow:['glow','glowy','glowing','جلو','لمعه','لمعة'], matte:['matte','مات','مطفي'],
 foundation:['foundation','فاونديشن','كريم اساس'], concealer:['concealer','كونسيلر'],
 perfume:['perfume','fragrance','عطر','عطور','برفيوم'], gift:['gift','gifts','هديه','هدية','هدايا'],
 rhode:['rhode','رود'], stanley:['stanley','ستانلي'], owala:['owala','اوالا'],
 mug:['mug','mugs','cup','cups','مج','مجات'], skincare:['skincare','بشره','بشرة'],
 mascara:['mascara','ماسكارا'], sunscreen:['sunscreen','spf','صن سكرين'],
 dry:['dry','ناشف','جاف'], oil:['oil','زيت'], cream:['cream','كريم'],
 serum:['serum','سيرم','سيروم'], mask:['mask','ماسك']
};
const aliases=new Map(Object.entries(groups).flatMap(([key,words])=>words.map(w=>[w,key])));
const stops=new Set(['the','and','for','with','your','from','sofie','store','egypt','في','من','على','عن','انا','عايز','عايزة','عاوزه','عاوز','جدا','افضل','best','product','products','my','me']);
export function terms(value,max=32) {
 const text=String(value||'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
 // Query fields can accidentally contain contact details. Drop them wholesale.
 if(/@|https?:|\b\d{7,}\b/.test(text))return [];
 return [...new Set((text.match(/[\p{L}\p{N}]+/gu)||[]).map(t=>aliases.get(t)||t).filter(t=>t.length>1&&!stops.has(t)))].slice(0,max);
}
export const CAMPAIGNS={
 'sofie-rhode-lips':{terms:['rhode','lip','tint'],source:'instagram'},
 'sofie-blush':{terms:['blush'],source:'meta'},
 'sofie-hair-frizz':{terms:['hair','frizz'],source:'meta'},
 'sofie-hydration':{terms:['hydration','skincare'],source:'google'},
 'sofie-home-gifts':{terms:['gift','stanley','owala','mug'],source:'klaviyo'},
 'sofie-beauty-gifts':{terms:['gift','makeup'],source:'klaviyo'}
};
const intents={hair:['hair'],blush:['blush'],lips:['lip','tint'],hydration:['hydration'],fragrance:['perfume'],gifts:['gift'],home:['mug','stanley','owala']};
const sources=new Set(['google','instagram','meta','facebook','tiktok','youtube','klaviyo','direct','other']);
const plainHandle=v=>typeof v==='string'&&v.length<=200&&/^[\p{L}\p{N}\p{M}\p{S}_-]+$/u.test(v);
export function cleanArrival(raw={},vocabulary=null) {
 raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const campaign=Object.hasOwn(CAMPAIGNS,raw.campaign)?raw.campaign:null;
 const explicit=Object.hasOwn(intents,raw.intent)?intents[raw.intent]:[];
 const search=terms(raw.query,12).filter(t=>!vocabulary||vocabulary.has(t));
 const supplied=Array.isArray(raw.terms)?terms(raw.terms.join(' '),16).filter(t=>!vocabulary||vocabulary.has(t)):[];
 return {source:sources.has(raw.source)?raw.source:'direct',campaign,
   terms:[...new Set([...(CAMPAIGNS[campaign]?.terms||[]),...explicit,...search,...supplied])].slice(0,20),
   landing:plainHandle(raw.landing)?raw.landing:null,
   explicit:raw.onsite===true&&search.length>0};
}
export function buildIndex(cards) {
 const docs=new Map(), byVariant=new Map(), byHandle=new Map();
 for(const c of cards) {
  if(!c.available)continue;byVariant.set(c.variantId,c);
  if(!byHandle.has(c.handle))byHandle.set(c.handle,[]);byHandle.get(c.handle).push(c);
  if(!docs.has(c.handle)) {
   const tf=new Map();
   for(const [text,weight] of [[c.title,3],[c.brand,3],[c.productType,3],[(c.tags||[]).join(' '),2],[c.description,1]])
    for(const t of terms(text,160))tf.set(t,(tf.get(t)||0)+weight);
   docs.set(c.handle,{tf,length:[...tf.values()].reduce((a,b)=>a+b,0)});
  }
 }
 const df=new Map();for(const d of docs.values())for(const t of d.tf.keys())df.set(t,(df.get(t)||0)+1);
 return {cards,docs,df,byVariant,byHandle,vocabulary:new Set(df.keys()),averageLength:[...docs.values()].reduce((n,d)=>n+d.length,0)/Math.max(1,docs.size)};
}
export function retrieve(index,query,limit=64) {
 const wanted=terms(Array.isArray(query)?query.join(' '):query).filter(t=>index.vocabulary.has(t));
 if(!wanted.length)return [];
 const scoreDoc=(doc)=>{
  let score=0;
  for(const t of wanted) {const tf=doc.tf.get(t)||0;if(!tf)continue;
   const idf=Math.log(1+(index.docs.size-(index.df.get(t)||0)+0.5)/((index.df.get(t)||0)+0.5));
   score+=idf*tf*2.2/(tf+1.2*(0.25+0.75*doc.length/Math.max(1,index.averageLength)));
  }return score;
 };
 const scored=[...index.docs].map(([handle,d])=>({handle,score:scoreDoc(d)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
 const top=scored[0]?.score||1;
 // Round-robin options prevents one many-shade product crowding all candidates.
 const result=[];
 for(let option=0;option<12&&result.length<limit;option++)for(const d of scored){
  const c=index.byHandle.get(d.handle)?.[option];if(!c)continue;
  const optionMatch=terms(c.variantTitle).filter(t=>wanted.includes(t)).length;
  result.push({...c,semanticScore:d.score/top+Math.min(0.4,optionMatch*0.2)});
  if(result.length===limit)break;
 }
 return result;
}
export function interestQuery(index,history,arrival,profileTerms=[]) {
 // Current declared arrival intent supersedes historical retrieval terms.
 // History still personalizes the ranking within the relevant candidates.
 if(arrival.terms.length)return arrival.terms;
 const recent=history.filter(e=>['view','click','save','cart'].includes(e.event)).slice(0,8);
 const fromHistory=recent.flatMap(e=>{
  const c=index.byVariant.get(e.variant_id);return c?terms([c.brand,c.productType,c.title].join(' '),8):[];
 });
 return [...new Set([...arrival.terms,...profileTerms,...fromHistory])].slice(0,32);
}
