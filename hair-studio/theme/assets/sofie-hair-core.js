(function (root) {
  'use strict';
  const normalise = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const patterns = {
    dryness: /hydrat|moistur|nourish|dry hair|dryness/, frizz: /frizz|smooth|humidity/,
    damage: /repair|bond|damag|breakage|strength/, curls: /curl|coil|definition|defining/,
    volume: /volum|bodif|fine hair|thicken/, buildup: /clarif|detox|build.?up|purif/,
    shine: /shine|gloss|lustre|luster/, tone: /purple|brass|toning|silver|blonde enhancer/,
    heat: /heat protect|thermal protect|heat protection/, fine: /fine hair|lightweight|weightless/,
    coarse: /thick hair|coarse|rich|intense moisture/, sensitive: /fragrance.free|unscented|without added fragrance/
  };
  function describe(product) {
    const title = normalise(product.title);
    const tags = normalise((product.tags || []).join(' '));
    const text = [title, tags, normalise(product.description)].join(' ');
    if (/supplement|gumm|vitamin|lash|brow|perfume|fragrance mist|hair mist|body mist|body wash|body cream|body oil|tool|massager|brush|comb\b|dryer|straightener|flat iron|gift|\bset\b|\bkit\b|dry shampoo|root cover|hair dye|color depositing|colour depositing|hair color|hair colour|no\.?\s*0\b|n[º°]\.?\s*0\b/.test(title + ' ' + tags)) return null;
    const k18 = /k18/.test(normalise(product.vendor)) && /leave.in molecular repair hair mask/.test(title);
    const no3 = /olaplex/.test(normalise(product.vendor)) && /(?:no\.?|n[º°]\.?)\s*3(?:\b|plus)/.test(title);
    if (!no3 && (/pre.wash|pre.shampoo/.test(title) || /fable.*mane/.test(normalise(product.vendor)) && /holiroots.*hair oil/.test(title))) return null;
    let category;
    if (k18 || no3) category = 'repair';
    else if (/shampoo|cleanser/.test(title)) category = 'cleanse';
    else if (/leave.in|leave in|air dry|air.dry/.test(title)) category = 'style';
    else if (/conditioner|hair mask|moisture.*mask|masker|superfood.*mask/.test(title)) category = 'condition';
    else if (/scalp|hair density|stimulating|hair loss|hair growth/.test(title + ' ' + tags)) return null;
    else if (/hair oil|styling|hair serum|tangle|curl.*(?:cream|gel|mousse)|heat protect|blow.*(?:cream|mist)|frizz.*(?:spray|cream)|texture spray|shine spray|hairspray/.test(title)) category = 'style';
    else return null;
    const flags = Object.fromEntries(Object.entries(patterns).map(([key, rx]) => [key, rx.test(text)]));
    flags.sensitive = patterns.sensitive.test(text) && !/not fragrance.free|isn.t fragrance.free/.test(text);
    flags.tone = /purple|brass|toning|silver/.test(title + ' ' + tags);
    return { ...product, category, flags, k18, no3, titleKey: title };
  }
  function variants(product, answers) {
    const cap = Number(answers.budget) || Infinity;
    return (product.variants || []).filter(v => v.available === true && Number(v.price) > 0 && Number(v.price) <= cap && (answers.speed !== 'now' || v.ready === true));
  }
  function rank(products, answers, category) {
    const wants = answers.concerns || [];
    return products.map(describe).filter(Boolean).filter(p => {
      if (p.category !== category || !variants(p, answers).length) return false;
      if (p.flags.tone && (!wants.includes('tone') || answers.colour !== 'lightened')) return false;
      if (answers.scalp === 'sensitive' && (category === 'cleanse' || category === 'repair') && !p.flags.sensitive) return false;
      if (p.flags.buildup && category === 'cleanse' && (!wants.includes('buildup') || answers.scalp === 'dry' || answers.scalp === 'sensitive')) return false;
      if (p.flags.buildup && answers.colour !== 'natural' && !/colo[u]?r.safe|safe.{0,20}colo[u]?r/.test(normalise(p.description))) return false;
      if (category === 'repair' && !wants.includes('damage')) return false;
      if (category === 'style' && !wants.some(c => p.flags[c]) && !(answers.heat !== 'never' && p.flags.heat)) return false;
      return true;
    }).map(p => {
      let score = 0;
      const reasons = [];
      wants.forEach((c, i) => { if (p.flags[c]) { score += 14 - i * 3; reasons.push('reason_' + c); } });
      if ((answers.texture === 'curly' || answers.texture === 'coily') && p.flags.curls) { score += 8; reasons.push('reason_curls'); }
      if (answers.strand === 'fine' && p.flags.fine) { score += 9; reasons.push('reason_fine'); }
      if (answers.strand === 'fine' && p.flags.coarse && !p.flags.fine) score -= 12;
      if (answers.strand === 'coarse' && p.flags.coarse) { score += 7; reasons.push('reason_coarse'); }
      if (answers.scalp === 'dry' && category === 'cleanse' && p.flags.dryness) { score += 7; reasons.push('reason_dryness'); }
      if (answers.scalp === 'sensitive' && p.flags.sensitive) { score += 10; reasons.push('reason_sensitive'); }
      if (answers.heat !== 'never' && category === 'style' && p.flags.heat) { score += 10; reasons.push('reason_heat'); }
      if (answers.colour !== 'natural' && /colo[u]?r.safe|colo[u]?r.protect/.test(normalise(p.description))) { score += 5; reasons.push('reason_colour'); }
      if (p.k18 && wants.includes('damage')) score += 8;
      const eligible = variants(p, answers).sort((a, b) => Number(a.price) - Number(b.price));
      if (!reasons.length) reasons.push('reason_' + category);
      return { ...p, score, reasons: [...new Set(reasons)].slice(0, 3), eligible, variant: eligible[0] };
    }).sort((a, b) => b.score - a.score || Number(a.variant.price) - Number(b.variant.price) || a.title.localeCompare(b.title));
  }
  function routine(products, answers) {
    if (answers.scalp === 'seek_help') return [];
    const categories = ['cleanse', 'condition'];
    if ((answers.concerns || []).includes('damage')) categories.push('repair');
    if ((answers.concerns || []).some(c => ['frizz', 'curls', 'volume', 'shine'].includes(c)) || answers.heat !== 'never') categories.push('style');
    return categories.map(category => ({ category, picks: rank(products, answers, category).slice(0, 5) }));
  }
  const api = { normalise, describe, variants, rank, routine };
  root.SofieHairCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
