((host) => {
  'use strict';
  const depths = [
    ['fair','Fair','#f3dcc8'],['light','Light','#eac7a6'],['lightmed','Light-medium','#dcb08a'],
    ['medium','Medium','#c79373'],['tan','Tan','#aa7451'],['deep','Deep','#825032'],['rich','Rich','#583424']
  ];
  const concernRules = {
    dryness:{rx:/hydrat|moistur|hyaluron|ceramide|squalane|barrier/,reason:'Hydration support in the product details'},
    shine:{rx:/oil.free|oil.control|mattif|niacinamide|sebum|combination|oily/,reason:'Details describe oily-skin or shine support'},
    dull:{rx:/radiance|radiant|brighten|dull|vitamin c/,reason:'Details describe a more radiant-looking finish'},
    uneven:{rx:/dark.spot|uneven.skin.tone|brighten|discolou?r|niacinamide/,reason:'Details describe uneven-tone care'},
    blemish:{rx:/blemish|breakout|acne.prone|non.comedogenic|salicylic/,reason:'Details describe blemish-prone skin care'},
    redness:{rx:/sooth|calm|redness|sensitive|barrier|centella|cica\b/,reason:'Details describe calming or barrier care'}
  };
  const skinRules = {
    dry:{rx:/dry|hydrat|moistur|ceramide|squalane|rich/,reason:'Hydration-focused formula details'},
    oily:{rx:/oily|oil.free|oil.control|mattif|niacinamide|sebum/,reason:'Formula details mention oily-skin needs'},
    combination:{rx:/combination|balanc|all skin types/,reason:'Details mention combination or all skin types'},
    normal:{rx:/normal|all skin types/,reason:'Details mention normal or all skin types'}
  };
  const finishRules = {
    glow:{rx:/dewy|glow|radian|lumin|illuminat/,reason:'A glow finish in the product details'},
    natural:{rx:/natural|skin.like|satin|second.skin/,reason:'A natural finish in the product details'},
    matte:{rx:/matte|mattif|velvet/,reason:'A matte finish in the product details'}
  };
  const text = p => [p.t,p.y,p.g,p.d].join(' ').toLowerCase();
  const withinBudget = (price,budget) => budget === 'b1' ? price <= 300000 : budget === 'b2' ? price <= 500000 : budget === 'b3' ? price <= 800000 : true;
  const validVariant = v => /^\d+$/.test(String(v?.id || '')) && Number.isFinite(Number(v.p)) && Number(v.p)>0 && (v.a === 1 || v.a === true);
  function shadeInfo(title) {
    const t = String(title).toLowerCase().replace(/\b\d+(?:\.\d+)?\s*(?:fl\.?\s*)?(?:oz|ml|grams?|g)\b/g,'');
    let depth = null;
    const depthText=t.split(/\bwith\b|\bundertones?\b/)[0];
    const depthPhrase=(depthText.match(/\b(?:ultra[ -]deep|very[ -](?:deep|dark)|deep[ -]rich|rich[ -]deep|very[ -]fair|very[ -]light|light(?:[ /-]| to )medium|medium(?:[ /-]| to )(?:deep|dark|tan)|tan(?:[ /-]| to )(?:deep|dark)|fair[ -]light|fair|porcelain|light|medium|tan|deep|dark|rich|ebony)\b/)||[])[0]||'';
    if (/ultra.deep|very.deep|very.dark|deep.rich|rich.deep/.test(depthPhrase)) depth=6;
    else if (/fair.light|very.light/.test(depthPhrase)) depth=.5;
    else if (/fair|porcelain/.test(depthPhrase)) depth=0;
    else if (/light(?:[ /-]| to )medium/.test(depthPhrase)) depth=2;
    else if (/medium(?:[ /-]| to )(?:deep|dark)/.test(depthPhrase)) depth=4.5;
    else if (/medium(?:[ /-]| to )tan/.test(depthPhrase)) depth=4;
    else if (/tan(?:[ /-]| to )(?:deep|dark)/.test(depthPhrase)) depth=5;
    else if (/light/.test(depthPhrase)) depth=1;
    else if (/medium/.test(depthPhrase)) depth=3;
    else if (/tan/.test(depthPhrase)) depth=4;
    else if (/deep|dark/.test(depthPhrase)) depth=5;
    else if (/rich|ebony/.test(depthPhrase)) depth=6;
    let tone=null;
    if (/olive/.test(t)) tone='olive';
    else if (/neutral/.test(t)) tone='neutral';
    else if (/\bcool\b|pink undertone|rosy undertone|\d\s?c\b/.test(t)) tone='cool';
    else if (/\bwarm\b|golden undertone|yellow undertone|peach undertone|\d\s?[wg]\b/.test(t)) tone='warm';
    else if (/\d\s?n\b/.test(t)) tone='neutral';
    return {depth,tone};
  }
  function complexionRows(list,a) {
    const target=depths.findIndex(x=>x[0]===a.depth);
    const kind={foundation:/foundation|foundcealer/,skintint:/skin.?tint|tinted.moist|tinted.hydrat|tinted.serum|bb.cream|cc.cream/,concealer:/concealer|conceal|corrector/}[a.kind] || /foundation/;
    return list.flatMap((p,index)=>{
      if (!kind.test(String(p.t).toLowerCase()) || /brush|pump|sponge|applicator|refillable.case|empty|palette|\bset\b|\bkit\b/.test(String(p.t).toLowerCase())) return [];
      let available=(p.s || []).filter(v=>validVariant(v)&&withinBudget(Number(v.p),a.budget));
      if (!available.length) return [];
      const described=available.map(v=>({...v,shade:shadeInfo(v.t)}));
      const fitting=described.filter(v=>v.shade.depth!==null && (target<0 || Math.abs(v.shade.depth-target)<=.55) && !(a.tone && a.tone!=='unsure' && v.shade.tone && v.shade.tone!=='neutral' && v.shade.tone!==a.tone));
      const unknown=described.filter(v=>v.shade.depth===null);
      available=fitting.length ? fitting : unknown;
      if (!available.length) return [];
      let score=2-Math.min(index,30)/30;
      const why=[];
      const details=text(p);
      if (fitting.length) { score+=8;why.push('Shade description matches your chosen depth'); }
      if (fitting.some(v=>v.shade.tone && v.shade.tone===a.tone)) { score+=3;why.push('Your undertone appears in the shade description'); }
      if (finishRules[a.finish]?.rx.test(details)) { score+=4;why.push(finishRules[a.finish].reason); }
      if (skinRules[a.skin]?.rx.test(details)) { score+=2;why.push(skinRules[a.skin].reason); }
      if (a.budget && a.budget!=='any') why.push('Selected options stay within your price limit');
      if (!why.length) why.push('A formula to explore for your chosen product type');
      return [{p,variants:available,why:why.slice(0,3),score,shadeSuggested:!!fitting.length,step:'Your shade shortlist'}];
    }).sort((x,y)=>y.score-x.score).slice(0,3);
  }
  function skinRows(catalogues,a) {
    const lip=a.area==='lips', eye=a.area==='undereyes';
    const steps=lip ? [{key:'balm',label:'01 · Lip care',rx:/lip.*(?:balm|butter|mask|treatment)|(?:balm|butter|mask|treatment).*lip/}]
      : eye ? [{key:'eye',label:'01 · Eye-area care',rx:/eye.*(?:cream|gel|serum|balm|patch)|(?:cream|gel|serum|balm|patch).*eye/}]
      : [{key:'cleanser',label:'01 · Cleanse',rx:/cleanser|cleansing|face.wash|facial.wash/},{key:'moisturizer',label:'02 · Moisturise',rx:/moistur|cream|lotion|balm|gel.cream/},{key:'spf',label:'03 · Protect · AM',rx:/sunscreen|\bspf\s*(?:3\d|[4-9]\d|\d{3})\b|sun.protect/}];
    const used=new Set();
    return steps.map(step=>{
      const list=catalogues[step.key] || [];
      const ranked=list.flatMap((p,index)=>{
        const title=String(p.t).toLowerCase(), details=text(p);
        if (used.has(p.h) || !step.rx.test(title) || /body|hand\b|foot\b|feet\b|hair|scalp|shampoo|brush|wipes|scrub|\bset\b|\bkit\b|\bduo\b|\btrio\b/.test(title)) return [];
        if (!lip&&!eye&&/\blip\b|\beye\b/.test(title)) return [];
        if (step.key==='moisturizer' && /\bspf\b|sunscreen/.test(title)) return [];
        if (lip && /tint|plump|lipstick|gloss|liner/.test(title)) return [];
        if (eye && /retin|exfoliat|glycolic|salicylic/.test(details)) return [];
        if (/retin|benzoyl|hydroquinone|exfoliat|glycolic|lactic.acid|salicylic|\baha\b|\bbha\b|peel/.test(details)) return [];
        if (step.key==='spf' && (!/broad.spectrum/.test(details) || !/\bspf\s*[-:]?\s*(?:3\d|[4-9]\d|\d{3})\b/.test(details))) return [];
        const fragranceFree=/fragrance.free|fragrance free|without fragrance|free of[^.]{0,70}fragrance|unscented/.test(details);
        if (a.sensitivity==='yes' && !fragranceFree) return [];
        let variants=(p.s||[]).filter(v=>validVariant(v)&&withinBudget(Number(v.p),a.budget));
        if (!variants.length) return [];
        let score=1-Math.min(index,30)/30;
        const why=[];
        (a.concerns||[]).forEach(c=>{if(concernRules[c]?.rx.test(details)){score+=3;why.push(concernRules[c].reason);}});
        if(skinRules[a.skin]?.rx.test(details)){score+=3;why.push(skinRules[a.skin].reason);}
        if(fragranceFree){score+=1;if(a.sensitivity==='yes')why.push('Described as fragrance-free');}
        if(step.key==='spf')why.push('Broad-spectrum SPF 30+ in the product details');
        if(!why.length) return [];
        if(a.budget&&a.budget!=='any')why.push('Selected options stay within your price limit');
        return [{p,variants,why:[...new Set(why)].slice(0,3),score,step:step.label}];
      }).sort((x,y)=>y.score-x.score);
      if(ranked[0])used.add(ranked[0].p.h);
      return {step:step.label,key:step.key,item:ranked[0]||null,alternatives:ranked.slice(1,3)};
    });
  }
  const api={depths,shadeInfo,complexionRows,skinRows,withinBudget,validVariant};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else host.SofieQuestRules=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis);
