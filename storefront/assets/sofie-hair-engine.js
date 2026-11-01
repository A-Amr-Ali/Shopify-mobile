(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SofieHairEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clean = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const benefitTests = {
    dryness: /hydrat|moistur|dryness|dry hair|nourish/,
    frizz: /frizz|smooth|sleek|humidity/,
    damage: /damage|repair|bond|breakage|split ends|strengthen/,
    volume: /volum|flatness|flat hair|fullness|root lift/,
    curls: /curl.{0,40}(defin|enhanc|bounce)|(defin|enhanc).{0,40}curl/,
    colour: /colou?r[- ]safe|colou?r.{0,20}protect|colou?r[- ]treated|fading|vibrancy/,
    brass: /purple|brass|toning|blonde enhancer/
  };
  function classify(p) {
    const title = clean(p.title);
    const desc = clean(p.description);
    const category = clean([p.title, p.type, ...(Array.isArray(p.tags) ? p.tags : [])].join(' '));
    if (/\bpet\b|\bdog\b|\bcat\b|supplement|vitamin gummies|hair dye|root touch|hair colou?r|fragrance mist|hair (&|and) body|hair perfume|body mist|eau de|gift set|discovery set|travel set|trial set|duo set|kit\b/.test(title)) return null;
    if (/minoxidil|finasteride/.test(desc)) return null;
    let slot = '';
    if (/pre[- ]shampoo/.test(title)) slot = 'treat';
    else if (/shampoo/.test(title)) {
      if (/dry shampoo|shampoo powder|shampoo mist/.test(title)) return null;
      slot = 'cleanse';
    } else if (/conditioner|conditioning butter/.test(title) && !/leave[- ]?in|mask|treatment/.test(title)) slot = 'condition';
    else if (/mask|treatment|bond builder|hair perfector/.test(title) && !/scalp|density|thinning|growth|longevity/.test(title)) slot = 'treat';
    else if (/leave[- ]?in|hair oil|styling oil|bonding oil|oil serum|hair serum|heat protect|heat defense|heat defence|heatbounce|curl.*(cream|gel)|defining cream|styling cream|detangling.*primer|hair primer|volume spray|volumizing (spray|mousse)|volumizer|thicken.*lift|blow.?dry.*spray|dream coat|blowout|moisture.*shine.*cream/.test(title)) slot = 'finish';
    if (!slot || !/hair|shampoo|condition|mask|treatment|curl|heat|olaplex|k18|amika|ouai/.test(category + ' ' + desc.slice(0,250))) return null;
    if (/shampoo.*conditioner|conditioner.*shampoo/.test(title)) return null;
    const detail = (desc.split(/highlighted ingredients|ingredient callouts|ingredients:|what else you need|how to use/)[0] || desc).slice(0,3500);
    const typeBlocks = [...desc.matchAll(/hair (?:type|texture):\s*(.*?)(?=hair (?:type|texture|concern)|key benefits|formulation|highlighted|ingredient|what else|how to|$)/g)].map(x => x[1]).join(' ');
    const types = typeBlocks || title;
    const patterns = ['straight','wavy','curly','coily'].filter(x => new RegExp('\\b' + x + '\\b').test(types));
    const strands = ['fine','medium','thick'].filter(x => new RegExp('\\b' + x + '\\b').test(types));
    if (/coarse/.test(types) && !strands.includes('thick')) strands.push('thick');
    const benefits = Object.keys(benefitTests).filter(k => benefitTests[k].test(title + ' ' + detail));
    const heat = /heat (protect|defen)|thermal protect|protect.{0,25}(heat|450|230)|heatbounce/.test(title + ' ' + detail);
    const clarify = /detox|clarif|deep.clean|buildup/.test(title);
    const medicated = /anti[- ]dandruff|dandruff|salicylic acid|scalp scrub/.test(title + ' ' + detail.slice(0,350));
    const k18 = /k18/.test(clean(p.vendor)) && /leave.in molecular repair hair mask/.test(title);
    const prewash = !k18 && /pre[- ](wash|shampoo)|before shampoo|before you shampoo|before cleansing/.test(title + ' ' + desc.slice(-2200));
    const needsHeat = (/heat[- ]activat|blow[- ]dry.{0,40}activat|requires.{0,20}heat/.test(desc) || /dream coat/.test(title)) && !/dream coat for curly/.test(title);
    return {slot,patterns,strands,benefits,heat,clarify,medicated,k18,prewash,needsHeat,title,detail};
  }
  function safety(a) {
    if (a.scalp === 'pain' || (a.concerns || []).includes('sudden_loss')) return 'refer';
    if (a.scalp === 'sensitive' || a.scalp === 'flakes' || (a.concerns || []).includes('shedding')) return 'caution';
    return '';
  }
  function variants(p, a, nowOnly) {
    const cap = Number(a.budget) || Infinity;
    return (p.variants || []).filter(v => v.available === true && Number.isFinite(v.price) && v.price > 0 && v.price <= cap && (!nowOnly || v.now === true)).sort((x,y) => x.price-y.price || x.id-y.id);
  }
  function rankProduct(p, a, slot, nowOnly) {
    const k = classify(p);
    if (!k) return null;
    const available = variants(p,a,nowOnly);
    if (!available.length) return null;
    const concerns = a.concerns || [];
    if (k.patterns.length && a.pattern !== 'unsure' && !k.patterns.includes(a.pattern)) return null;
    if (k.strands.length && a.strand !== 'unsure' && !k.strands.includes(a.strand)) return null;
    if (k.benefits.includes('brass') && (!['blonde','grey'].includes(a.colour) || !concerns.includes('brass'))) return null;
    if (k.medicated) return null;
    if (k.clarify && (a.scalp !== 'oily' || !concerns.includes('buildup'))) return null;
    if (k.needsHeat && a.heat === 'never') return null;
    if (a.scalp === 'sensitive' && k.slot === 'cleanse') return null;
    let suitable = k.slot === slot;
    if (slot === 'protect') suitable = k.heat && k.slot === 'finish';
    if (slot === 'focus') {
      const focus = concerns.filter(x => benefitTests[x]);
      suitable = ['treat','finish'].includes(k.slot) && focus.some(x => k.benefits.includes(x));
    }
    if (!suitable) return null;
    let score = 0;
    const reasons = [];
    if (k.strands.length && a.strand !== 'unsure') { score += 8; reasons.push('reason_' + a.strand); }
    if (k.patterns.length && a.pattern !== 'unsure' && k.patterns.length < 4) { score += 5; reasons.push('reason_' + a.pattern); }
    concerns.filter(x => benefitTests[x]).forEach((c,i) => {
      if (k.benefits.includes(c)) { score += i === 0 ? 9 : 5; reasons.push('reason_' + c); }
    });
    if (['colour','blonde','grey'].includes(a.colour) && k.benefits.includes('colour')) { score += 3; reasons.push('reason_colour'); }
    if (a.heat !== 'never' && k.heat) { score += slot === 'protect' ? 20 : 5; reasons.push('reason_heat'); }
    if (a.scalp === 'oily' && k.clarify) { score += 5; reasons.push('reason_buildup'); }
    if (a.strand === 'fine' && /rich|intense moisture|butter|thick hair/.test(k.title) && !/fine/.test(k.title)) score -= 10;
    if (!reasons.length) reasons.push('reason_routine');
    return {product:p,variant:available[0],variants:available,score,reasons:[...new Set(reasons)].slice(0,3),knowledge:k};
  }
  function recommend(products,a,options={}) {
    const status=safety(a);
    if (status === 'refer') return {rows:[],safety:status,missing:[],count:0};
    const focus=(a.concerns || []).some(x=>benefitTests[x]);
    const slots=['cleanse','condition'];
    if (a.heat !== 'never') slots.push('protect');
    else if (focus) slots.push('focus');
    if (a.size === 'complete' && focus && !slots.includes('focus')) slots.push('focus');
    const used=new Set();
    const rows=slots.map(slot=>{
      const picks=products.filter(p=>!used.has(p.handle)).map(p=>rankProduct(p,a,slot,options.nowOnly)).filter(Boolean).sort((x,y)=>y.score-x.score || x.variant.price-y.variant.price || x.product.handle.localeCompare(y.product.handle)).slice(0,3);
      if (picks[0]) used.add(picks[0].product.handle);
      return {slot,picks};
    });
    const k18row=rows.find(r=>r.picks[0]?.knowledge.k18);
    if (k18row) {
      const idx=rows.indexOf(k18row); rows.splice(idx,1); rows.splice(Math.min(1,rows.length),0,k18row);
    }
    const prewashrow=rows.find(r=>r.picks[0]?.knowledge.prewash);
    if (prewashrow) { rows.splice(rows.indexOf(prewashrow),1); rows.unshift(prewashrow); }
    return {rows,safety:status,missing:rows.filter(r=>!r.picks.length).map(r=>r.slot),count:rows.filter(r=>r.picks.length).length};
  }
  return {classify,rankProduct,recommend,variants,safety};
});
