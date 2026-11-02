// Train only on mature, actually visible impressions. Start with click outcomes;
// paid orders remain a separate business metric until enough labels exist.
export const FEATURE_KEYS=['popularity','affinity','semantic','priceFit','novelty'];
const sigmoid=x=>1/(1+Math.exp(-Math.max(-20,Math.min(20,x))));
const loss=(rows,weights,bias)=>rows.reduce((n,r)=>{
 const p=Math.max(1e-6,Math.min(1-1e-6,sigmoid(bias+r.x.reduce((v,x,i)=>v+x*weights[i],0))));
 return n-r.y*Math.log(p)-(1-r.y)*Math.log(1-p);
},0)/Math.max(1,rows.length);
export function predict(ranker,features) {
 if(!ranker?.active)return null;
 return sigmoid(ranker.bias+FEATURE_KEYS.reduce((n,k,i)=>n+(Number(features[k])||0)*ranker.weights[i],0));
}
export function fitRanker(rows) {
 const positives=rows.filter(r=>r.y===1).length;
 if(rows.length<500||positives<50||rows.length-positives<200)return {active:false,reason:'insufficient_mature_labels',examples:rows.length,positives};
 const sorted=[...rows].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const cut=Math.floor(sorted.length*0.8),boundary=sorted[cut].at;
 const train=sorted.filter(r=>r.at<boundary),held=sorted.filter(r=>r.at>=boundary);
 if(train.length<300||held.length<80||!held.some(r=>r.y===1)||!held.some(r=>r.y===0))return {active:false,reason:'insufficient_temporal_holdout'};
 const rate=Math.max(0.001,Math.min(0.999,train.reduce((n,r)=>n+r.y,0)/train.length));
 const bias0=Math.log(rate/(1-rate));let bias=bias0;const weights=FEATURE_KEYS.map(()=>0);
 for(let step=0;step<300;step++){
  const gradient=weights.map(()=>0);let gb=0;
  for(const r of train){const error=sigmoid(bias+r.x.reduce((n,x,i)=>n+x*weights[i],0))-r.y;gb+=error;
   r.x.forEach((x,i)=>gradient[i]+=error*x);
  }
  bias-=0.15*gb/train.length;
  weights.forEach((w,i)=>weights[i]-=0.15*(gradient[i]/train.length+0.01*w));
 }
 const baseLoss=loss(held,weights.map(()=>0),bias0),candidateLoss=loss(held,weights,bias);
 if(!(candidateLoss<baseLoss*0.995))return {active:false,reason:'holdout_not_better',examples:rows.length,baseLoss,candidateLoss};
 return {active:true,target:'click',weights,bias,examples:rows.length,positives,baseLoss,candidateLoss,trainedAt:new Date().toISOString()};
}
export function matureLabels(events,now=Date.now()) {
 const groups=new Map();
 for(const e of events) {
  if(!e.request_id||!e.variant_id)continue;
  const key=e.visitor_id+':'+e.request_id+':'+e.variant_id;
  const g=groups.get(key)||{};groups.set(key,g);
  if(e.event==='impression'&&e.features&&Date.parse(e.created_at)<now-86400000)g.impression=e;
  if(e.event==='click')g.click=e;
 }
 const out=[];
 for(const g of groups.values()) {
  const e=g.impression;if(!e)continue;
  const clicked=g.click&&Date.parse(g.click.created_at)>=Date.parse(e.created_at)&&Date.parse(g.click.created_at)<=Date.parse(e.created_at)+86400000;
  out.push({at:e.created_at,x:FEATURE_KEYS.map(k=>Math.max(0,Math.min(1,Number(e.features[k])||0))),y:clicked?1:0});
 }return out;
}
