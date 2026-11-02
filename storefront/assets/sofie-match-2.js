    { id: 'size', q: 'Routine size', type: 'single', opts: [['3', 'Essential — 3 steps'], ['5', 'Complete — 5 steps']] },
    { id: 'prefs', q: 'Anything else? (optional)', type: 'multi', optional: true, opts: [['fragrancefree', 'Fragrance-free'], ['clean', 'Clean / vegan'], ['kbeauty', 'K-beauty'], ['luxury', 'Luxury']] },
    { id: 'budget', optional: true, q: 'Budget per product', type: 'single', opts: BUDGET.opts }
  ] },
  scent: { title: 'Signature scent', sub: 'Perfumes and mists by the notes you love', steps: [
    { id: 'families', q: 'Which notes pull you in? (up to 3)', type: 'multi', max: 3, opts: [['vanilla', 'Vanilla & gourmand'], ['floral', 'Floral'], ['fresh', 'Fresh & citrus'], ['woody', 'Woody & oud'], ['musky', 'Clean musk'], ['amber', 'Amber & spice'], ['fruity', 'Fruity']] },
    { id: 'format', q: 'Perfume or mist?', type: 'single', opts: [['perfume', 'Perfume'], ['mist', 'Body & hair mist'], ['either', 'Surprise me']] },
    { id: 'moment', q: 'When will you wear it most?', type: 'single', opts: [['day', 'Everyday'], ['night', 'Evenings out'], ['special', 'Special occasions']] },
    { id: 'intensity', q: 'How should it feel?', type: 'single', opts: [['soft', 'Soft skin scent'], ['noticeable', 'Noticeable'], ['statement', 'Statement']] },
    { id: 'budget', optional: true, q: 'Budget', type: 'single', opts: BUDGET.opts }
  ] },
  lips: { title: 'Lips & cheeks', sub: 'Gloss, oils, tints and blush in your colour story', steps: [
    { id: 'kind', q: 'What are you looking for?', type: 'single', opts: [['gloss', 'Lip gloss'], ['lipoil', 'Lip oil'], ['lipstick', 'Lipstick'], ['balm', 'Tinted balm'], ['blush', 'Blush'], ['bronzer', 'Bronzer']] },
    { id: 'colour', q: 'Your colour story', type: 'single', opts: [['nude', 'Nude'], ['pink', 'Pink'], ['berry', 'Berry & mauve'], ['red', 'Red'], ['coral', 'Coral & peach'], ['brown', 'Brown & cocoa']] },
    { id: 'lfinish', q: 'Finish', type: 'single', opts: [['glossy', 'Glossy'], ['satin', 'Satin'], ['matte', 'Matte'], ['sheer', 'Sheer tint']] },
    { id: 'depth', q: 'Your skin depth', type: 'swatch', opts: DEPTHS.map(d => [d[0], d[1], d[2]]) },
    { id: 'budget', optional: true, q: 'Budget', type: 'single', opts: BUDGET.opts }
  ] },
  hair: { title: 'Hair ritual', sub: 'Care and styling for your hair type', steps: [
    { id: 'type', q: 'Your hair type', type: 'single', opts: [['fine', 'Fine'], ['medium', 'Medium'], ['thick', 'Thick'], ['curly', 'Curly'], ['coily', 'Coily']] },
    { id: 'hconcerns', q: 'What would you change? (up to 2)', type: 'multi', max: 2, opts: [['frizz', 'Frizz'], ['damage', 'Damage & breakage'], ['volume', 'Volume'], ['hdry', 'Dryness'], ['oilyscalp', 'Oily scalp'], ['colour', 'Colour care'], ['growth', 'Thinning']] },
    { id: 'want', q: 'What do you need?', type: 'single', opts: [['wash', 'Shampoo & conditioner'], ['treat', 'Treatment & mask'], ['style', 'Styling'], ['routine', 'Full routine']] },
    { id: 'budget', optional: true, q: 'Budget per product', type: 'single', opts: BUDGET.opts }
  ] }
};

/* ------------------------------------------------------------------- data */
const cache = {};
async function feed(key) {
  const handle = (cfg.feeds || {})[key];
  if (!handle) return [];
  if (cache[handle]) return cache[handle];
  const ck = 'sfm:' + handle;
  try { const hit = JSON.parse(sessionStorage.getItem(ck) || 'null'); if (hit && Date.now() - hit.at < 20 * 60 * 1000) { cache[handle] = hit.d; return hit.d; } } catch (e) {}
  const url = (cfg.collections || '/collections') + '/' + handle + '?view=sfm&sort_by=best-selling';
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('feed ' + handle);
  const text = await res.text();
  let list = [];
  try { list = JSON.parse(text.trim()); } catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  const total = list.length;
  list = list.map((p, i) => prep(p, i, total, key));
  cache[handle] = list;
  try { sessionStorage.setItem(ck, JSON.stringify({ at: Date.now(), d: list })); } catch (e) {}
  return list;
}
function prep(p, i, total, key) {
  const text = [p.t, p.y, p.g, p.d].join(' ').toLowerCase();
  return Object.assign({}, p, { text, tl: (p.t || '').toLowerCase(), vl: (p.v || '').toLowerCase(), pop: total > 1 ? 1 - i / (total - 1) : 1, src: key });
}
async function feeds(keys) {
  const sets = await Promise.all(keys.map(k => feed(k).catch(() => [])));
  const seen = new Map();
  sets.flat().forEach(p => { const prev = seen.get(p.h); if (!prev || p.pop > prev.pop) seen.set(p.h, p); });
  return Array.from(seen.values());
}

/* ------------------------------------------------------------ shade logic */
const SIZE_RX = /\b(\d+(\.\d+)?\s?(ml|mL|oz|fl\.?\s?oz|g|gr|gram|grams))\b|\bmini\b|\bfull size\b|\btravel\b/i;
function shadeText(t) {
  const parts = String(t || '').split(' / ').map(s => s.trim()).filter(Boolean);
  const cand = parts.filter(s => !SIZE_RX.test(s) || /\d+\s?[nwcgoypbr]\b/i.test(s));
  return (cand.length ? cand[cand.length - 1] : parts[parts.length - 1] || '').trim();
}
const DEPTH_WORDS = [[/\bporcelain|very fair|ultra fair\b/, .04], [/\bfair\b/, .08], [/\bivory\b/, .12], [/\blight[- ]?medium|light to medium\b/, .34], [/\blight\b/, .22], [/\bmedium[- ]?(tan|deep|dark)|medium to (tan|deep|dark)\b/, .6], [/\bmedium\b/, .48], [/\btan\b/, .64], [/\b(deep|dark)[- ]?(rich)?\b/, .84], [/\brich|espresso|ebony|very deep\b/, .95]];
const TONE_WORDS = { cool: /\bcool|pink|rosy|rose\b|\bc\d|\d\s?c\b|\dc\d|\(\s?[cpr]\s?\)/, warm: /\bwarm|golden|yellow|peach|honey|caramel\b|\bw\d|\d\s?w\b|\dw\d|\d\s?g\b|\(\s?[wgy]\s?\)/, neutral: /\bneutral\b|\bn\d|\d\s?n\b|\dn\d|\(\s?n\s?\)/, olive: /\bolive|\bo\d|\d\s?o\b|\(\s?o\s?\)/ };
function shadeInfo(variants) {
  const rows = variants.map(v => {
    const st = shadeText(v.t);
    const low = st.toLowerCase();
    let word = null;
    for (const [rx, val] of DEPTH_WORDS) { if (rx.test(low)) { word = val; break; } }
    const num = (low.match(/(\d{1,3}(?:\.\d)?)/) || [])[1];
    let tone = null;
    for (const k of ['olive', 'neutral', 'warm', 'cool']) { if (TONE_WORDS[k].test(low)) { tone = k; break; } }
    return { v, st, word, num: num != null ? parseFloat(num) : null, tone };
  });
  const nums = rows.filter(r => r.num != null).map(r => r.num).sort((a, b) => a - b);
  rows.forEach(r => {
    if (r.word != null) r.depth = r.word;
    else if (r.num != null && nums.length > 3) { const rank = nums.indexOf(r.num); r.depth = nums.length > 1 ? rank / (nums.length - 1) : .5; }
    else r.depth = null;
  });
  return rows;
}
function suggestShades(p, depthKey, toneKey, max) {
  if (!p.s || p.s.length < 3) return [];
  const target = (DEPTHS.find(d => d[0] === depthKey) || [])[3];
  if (target == null) return [];
  const rows = shadeInfo(p.s).filter(r => r.v.a && r.depth != null);
  if (rows.length < 2) return [];
  rows.forEach(r => {
    let s = 1 - Math.abs(r.depth - target) * 3;
    if (toneKey && toneKey !== 'unsure' && r.tone) s += r.tone === toneKey ? .35 : (toneKey === 'neutral' || r.tone === 'neutral') ? .05 : -.25;
    r.score = s;
  });
  return rows.sort((a, b) => b.score - a.score).filter(r => r.score > .25).slice(0, max || 3);
}
function colourShades(p, colour, max) {
  if (!p.s || p.s.length < 2 || !colour) return [];
  const rx = RX.colour[colour];
  return p.s.filter(v => v.a && rx.test(shadeText(v.t).toLowerCase())).slice(0, max || 3).map(v => ({ v, st: shadeText(v.t) }));
}

/* --------------------------------------------------------------- scoring */
function hit(p, rx) { return rx.test(p.text); }
function faceAreaScore(p,a,s,why,max) {
 const chosen=(a.faceArea||[]).filter(v=>v!=='all'); if(!chosen.length||(a.faceArea||[]).includes('all'))return;
 const rx={forehead:/forehead|t.zone|face/,undereyes:/under.eye|eye.cream|eye.serum|eye.patch|concealer|dark.circle/,eyes:/eye|lash|brow/,cheeks:/cheek|blush|face|complexion/,nose:/nose|t.zone|pores|face/,lips:/lip|balm|gloss/,jaw:/jaw|chin|face|complexion/};
 max.v+=8; if(chosen.some(k=>rx[k]&&rx[k].test(p.text))){s.v+=8;why.push('Matches your chosen face area');}
 else if(chosen.some(k=>['undereyes','eyes','lips'].includes(k)))s.v-=12;
}
function scoreCommon(p, a, s, why, max) {
  max.v += 12; s.v += 12 * p.pop;
  if (p.pop > .82) why.push('A SOFIE best seller');
  max.v += 8;
  if (a.budget && a.budget !== 'any') { if (inBudget(p, a.budget)) { s.v += 8; why.push('In your budget'); } else s.v -= 18; } else s.v += 8;
  if (a.fast) { max.v += 6; if (p.n) { s.v += 6; why.push('Ready today with SOFIE NOW'); } }
  if (a.brands && a.brands.length) { max.v += 8; if (a.brands.indexOf(p.v) > -1) { s.v += 8; why.push('From a brand you love'); } }
}
function scoreBase(p, a) {
  const s = { v: 0 }, why = [], max = { v: 0 };
  const kindRx = { foundation: /foundation|foundcealer/, skintint: /skin ?tint|tinted|serum foundation|bb|cc/, concealer: /concealer|corrector|foundcealer/, powder: /powder|setting/ }[a.kind];
  max.v += 20; if (kindRx && (kindRx.test(p.tl) || kindRx.test(p.text))) s.v += 20; else s.v -= 30;
  if (a.finish) { max.v += 18; if (hit(p, RX.finish[a.finish])) { s.v += 18; why.push(LABEL[a.finish]); } else if (a.finish === 'natural' && !hit(p, RX.finish.matte)) s.v += 6; }
  if (a.coverage) { max.v += 10; if (hit(p, RX.coverage[a.coverage])) { s.v += 10; why.push(LABEL[a.coverage]); } }
  if (a.skin) { max.v += 12; if (hit(p, RX.skin[a.skin])) { s.v += 12; why.push(LABEL[a.skin]); } else if (a.skin === 'oily' && hit(p, RX.finish.dewy) && !hit(p, RX.finish.matte)) s.v -= 6; else if (a.skin === 'dry' && hit(p, /mattif|oil[- ]?control/)) s.v -= 6; }
  if (a.depth) {
    max.v += 14;
    const sh = suggestShades(p, a.depth, a.tone, 3);
    if (sh.length) { s.v += 8 + Math.min(6, sh.length * 2); why.push(sh.length > 1 ? sh.length + ' shades in your range' : 'A shade in your range'); p._shades = sh; }
    else if (p.s && p.s.length > 6) s.v += 3;
  }
  faceAreaScore(p,a,s,why,max);
  scoreCommon(p, a, s, why, max);
  return { s: s.v, max: max.v, why };
}
function scoreSkinItem(p, a, step) {
  const s = { v: 0 }, why = [], max = { v: 0 };
  if (step && step.rx) { max.v += 16; if (step.rx.test(p.tl) || step.rx.test(p.text)) s.v += 16; else s.v -= 25; }
  if (a.skin) { max.v += 12; if (hit(p, RX.skin[a.skin])) { s.v += 12; why.push(LABEL[a.skin]); } }
  (a.concerns || []).forEach(c => { max.v += 14; if (hit(p, RX.concern[c])) { s.v += 14; why.push(LABEL[c]); } });
  (a.prefs || []).forEach(c => { max.v += 6; if (hit(p, RX.pref[c]) || RX.pref[c].test(p.vl)) { s.v += 6; why.push(LABEL[c]); } });
  if (a.skin === 'sensitive' && hit(p, /\bfragrance\b|parfum/) && !hit(p, RX.pref.fragrancefree)) s.v -= 4;
  faceAreaScore(p,a,s,why,max); scoreCommon(p, a, s, why, max);
  return { s: s.v, max: max.v, why };
}
function scoreScent(p, a) {
  const s = { v: 0 }, why = [], max = { v: 0 };
  const isMist = hit(p, RX.format.mist), isPerf = hit(p, RX.format.perfume) && !isMist;
  if (!isMist && !isPerf) s.v -= 30;
  max.v += 10;
  if (a.format === 'mist') { if (isMist) { s.v += 10; why.push(LABEL.mist); } else s.v -= 12; }
  else if (a.format === 'perfume') { if (isPerf) { s.v += 10; why.push(LABEL.perfume); } else s.v -= 12; }
  else s.v += 6;
  (a.families || []).forEach(f => { max.v += 16; if (hit(p, RX.family[f])) { s.v += 16; why.push(LABEL[f]); } });
  if (a.moment) {
    max.v += 6;
    const fit = { day: /fresh|citrus|musk|floral|clean|mist|light/, night: /oud|amber|vanilla|wood|smok|leather|intense|spic|night|noir/, special: /floral|rose|jasmine|amber|oud|elixir|parfum|luxur|signature/ }[a.moment];
    if (fit.test(p.text)) { s.v += 6; why.push({ day: 'Easy to wear every day', night: 'Made for evenings', special: 'Special-occasion worthy' }[a.moment]); }
  }
  if (a.intensity) { max.v += 6; if (hit(p, RX.intensity[a.intensity])) { s.v += 6; why.push(LABEL[a.intensity]); } }
  scoreCommon(p, a, s, why, max);
  return { s: s.v, max: max.v, why };
}
function scoreLips(p, a) {
  const s = { v: 0 }, why = [], max = { v: 0 };
  const kindRx = { gloss: /gloss|glaze|shine/, lipoil: /lip oil|oil/, lipstick: /lipstick|lip colou?r|rouge|lip stick/, balm: /balm|tint|butter|treatment/, blush: /blush|cheek/, bronzer: /bronz|sun/ }[a.kind];
  max.v += 18; if (kindRx && (kindRx.test(p.tl) || kindRx.test(p.text))) s.v += 18; else s.v -= 25;
  if (a.colour) {
    max.v += 16;
    const shades = colourShades(p, a.colour, 3);
    if (shades.length) { s.v += 12 + Math.min(4, shades.length * 2); why.push(LABEL[a.colour] + ' available'); p._shades = shades; }
