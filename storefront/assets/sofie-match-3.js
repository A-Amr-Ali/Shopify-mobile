    else if (RX.colour[a.colour].test(p.tl)) { s.v += 10; why.push(LABEL[a.colour]); }
  }
  if (a.lfinish) {
    max.v += 12;
    const map = { glossy: 'glossy', satin: 'satin', matte: 'matte', sheer: 'sheer' };
    if (hit(p, RX.lipfinish[map[a.lfinish]])) { s.v += 12; why.push(a.lfinish === 'matte' ? LABEL.matteLip : a.lfinish === 'sheer' ? LABEL.sheerLip : LABEL[a.lfinish]); }
  }
  if (a.depth && a.colour === 'nude' && p._shades && p._shades.length) {
    const target = (DEPTHS.find(d => d[0] === a.depth) || [])[3];
    const near = p._shades.filter(r => { const low = r.st.toLowerCase(); return (target < .3 && /light|fair|pale|bare/.test(low)) || (target >= .3 && target < .7 && /medium|mid|warm|caramel|toffee/.test(low)) || (target >= .7 && /deep|rich|dark|cocoa|espresso/.test(low)); });
    if (near.length) { s.v += 4; why.push('Nudes tuned to your depth'); }
  }
  scoreCommon(p, a, s, why, max);
  return { s: s.v, max: max.v, why };
}
function scoreHairItem(p, a, step) {
  const s = { v: 0 }, why = [], max = { v: 0 };
  if (step && step.rx) { max.v += 16; if (step.rx.test(p.tl) || step.rx.test(p.text)) s.v += 16; else s.v -= 25; }
  if (a.type) { max.v += 10; if (hit(p, RX.hair[a.type])) { s.v += 10; why.push(LABEL[a.type] || 'Suits your hair type'); } }
  (a.hconcerns || []).forEach(c => { const rx = c === 'hdry' ? RX.hairConcern.dryness : RX.hairConcern[c]; max.v += 14; if (rx && hit(p, rx)) { s.v += 14; why.push(LABEL[c]); } });
  scoreCommon(p, a, s, why, max);
  return { s: s.v, max: max.v, why };
}
function rank(list, scorer, a, n) {
  const scored = list.map(p => { const q = Object.assign({}, p); const r = scorer(q, a); q._s = r.s; q._max = Math.max(r.max, 1); q._why = uniq(r.why).slice(0, 4); return q; })
    .filter(p => p._s > 0)
    .sort((x, y) => y._s - x._s);
  const out = [], per = {};
  for (const p of scored) { per[p.v] = (per[p.v] || 0) + 1; if (per[p.v] > 2 && out.length < 9) continue; out.push(p); if (out.length >= (n || 9)) break; }
  if (out.length < (n || 9)) scored.forEach(p => { if (out.length < (n || 9) && out.indexOf(p) < 0) out.push(p); });
  out.forEach(p => { p._pct = clamp(Math.round(58 + 41 * Math.pow(clamp(p._s / p._max, 0, 1), .85)), 55, 99); });
  return out;
}

/* --------------------------------------------------------- free-text match */
function parseOwn(text, brands) {
  const t = ' ' + text.toLowerCase() + ' ';
  const a = {};
  if (/foundation|fond de teint|base\b/.test(t)) a.kind = 'foundation';
  else if (/concealer|corrector/.test(t)) a.kind = 'concealer';
  else if (/tint|bb cream|cc cream|tinted/.test(t)) a.kind = 'skintint';
  else if (/powder/.test(t)) a.kind = 'powder';
  let journey = 'base';
  if (/lip|gloss|lipstick|balm|stain/.test(t)) { journey = 'lips'; a.kind = /gloss/.test(t) ? 'gloss' : /oil/.test(t) ? 'lipoil' : /balm|tint|treatment/.test(t) ? 'balm' : 'lipstick'; }
  else if (/blush|cheek/.test(t)) { journey = 'lips'; a.kind = 'blush'; }
  else if (/bronz/.test(t)) { journey = 'lips'; a.kind = 'bronzer'; }
  else if (/perfume|parfum|eau de|edp|edt|mist|fragrance|scent|cologne|kayali|phlur|jo malone|sol de janeiro|vanilla \d/.test(t)) {
    journey = 'scent'; a.families = Object.keys(RX.family).filter(k => RX.family[k].test(t)).slice(0, 3); if (!a.families.length) a.families = ['vanilla']; a.format = /mist/.test(t) ? 'mist' : 'perfume';
  }
  if (journey === 'base' && !a.kind) a.kind = 'foundation';
  for (const k of ['longwear', 'matte', 'dewy', 'natural']) if (RX.finish[k].test(t)) { a.finish = k; break; }
  for (const k of ['full', 'medium', 'sheer']) if (RX.coverage[k].test(t)) { a.coverage = k; break; }
  for (const [rx, val] of DEPTH_WORDS) if (rx.test(t)) { a.depth = DEPTHS.reduce((best, d) => Math.abs(d[3] - val) < Math.abs(best[3] - val) ? d : best)[0]; break; }
  const num = (t.match(/\b(\d{1,3})(?:\.\d)?\s?([nwcgo])\b/) || []);
  if (!a.depth && num[1]) { const n = parseFloat(num[1]); const scale = n > 60 ? 600 : n > 18 ? 60 : n > 9 ? 18 : 9; const val = clamp(n / scale, 0, 1); a.depth = DEPTHS.reduce((best, d) => Math.abs(d[3] - val) < Math.abs(best[3] - val) ? d : best)[0]; }
  if (num[2]) a.tone = { n: 'neutral', w: 'warm', g: 'warm', c: 'cool', o: 'olive' }[num[2]];
  for (const k of ['olive', 'neutral', 'warm', 'cool']) if (!a.tone && TONE_WORDS[k].test(t)) a.tone = k;
  for (const k of ['nude', 'pink', 'berry', 'red', 'coral', 'brown']) if (RX.colour[k].test(t)) { a.colour = k; break; }
  const tn = ' ' + text.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ') + ' ';
  const brand = brands.find(b => { const bn = b.toLowerCase().replace(/[^a-z0-9À-ɏ]+/g, ' ').trim(); return bn.length > 2 && tn.indexOf(' ' + bn + ' ') > -1; });
  if (brand) a.brands = [brand];
  return { journey, a };
}

/* ------------------------------------------------------------------- UI */
let state = { mode: null, step: 0, a: {}, fast: false };
function setScreen(html, focus) {
  app.innerHTML = html;
  app.scrollTop = 0;
  if (window.SofieUnify) window.SofieUnify(app);
  const f = app.querySelector(focus || '[data-focus]') || app.querySelector('h2');
  if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
}
function chrome(inner, progress, label) {
  return '<div class="sfm-top"><button type="button" class="sfm-brand" data-act="home"><span>SOFIE</span> Find My Match</button>' +
    (progress != null ? '<div class="sfm-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(progress) + '" aria-label="' + esc(label || 'Progress') + '"><i style="width:' + progress + '%"></i></div>' : '<span></span>') +
    '</div><div class="sfm-body">' + inner + '</div>';
}
function home() {
  state = { mode: null, step: 0, a: {}, fast: state.fast };
  const tiles = Object.keys(JOURNEYS).map(k => '<button type="button" class="sfm-tile sfm-tile-' + k + '" data-act="journey" data-v="' + k + '"><strong>' + esc(JOURNEYS[k].title) + '</strong><span>' + esc(JOURNEYS[k].sub) + '</span><i aria-hidden="true">→</i></button>').join('');
  const saved = store.get(LS_KEY, null);
  const resume = saved && saved.mode && JOURNEYS[saved.mode] ? '<div class="sfm-resume"><span>Welcome back. Your last match: <b>' + esc(summary(saved.mode, saved.a)) + '</b></span><button type="button" class="sfm-link" data-act="resume">See my picks</button></div>' : '';
  setScreen(chrome('<p class="sfm-eyebrow">Personalised by SOFIE</p><h2 data-focus>What are we matching today?</h2><p class="sfm-lead">Answer a few quick questions. We read every product we have in stock — finish, coverage, shade range, notes, ingredients, price and what other SOFIE clients buy most — then hand-pick your matches and tell you why.</p>' + resume +
    '<div class="sfm-tiles">' + tiles + '<button type="button" class="sfm-tile sfm-tile-own" data-act="own"><strong>Match what I already use</strong><span>Type the product or shade you love — we find its closest SOFIE matches</span><i aria-hidden="true">→</i></button></div>', null));
}
function ownScreen() {
  setScreen(chrome('<p class="sfm-eyebrow">Your current favourite</p><h2 data-focus>What do you use now?</h2><p class="sfm-lead">For example: “NARS Sheer Glow, Medium 2 Santa Fe”, “Fenty 330W”, “a glossy nude lip oil” or “Kayali Vanilla 28”.</p><form class="sfm-own" data-own><label class="sr-only" for="sfm-own">Product or shade</label><input id="sfm-own" type="text" autocomplete="off" placeholder="Brand, product and shade" required><button class="button" type="submit">Find my matches</button></form><button type="button" class="sfm-back" data-act="home">← All journeys</button>', 10));
  const inp = app.querySelector('#sfm-own'); if (inp) inp.focus();
}
function visibleSteps() { return JOURNEYS[state.mode].steps.filter(s => !(s.skipIf && s.skipIf(state.a))); }
function question() {
  const steps = visibleSteps();
  if (state.step >= steps.length) return results();
  const st = steps[state.step];
  const val = state.a[st.id];
  const multi = st.type === 'multi';
  const opts = st.opts.map(o => {
    const on = multi ? (val || []).indexOf(o[0]) > -1 : val === o[0];
    const sw = st.type === 'swatch' ? '<span class="sfm-swatch" style="background:' + o[2] + '"></span>' : '';
    const sub = st.type !== 'swatch' && o[2] ? '<small>' + esc(o[2]) + '</small>' : '';
    return '<button type="button" class="sfm-opt' + (st.type === 'swatch' ? ' is-swatch' : '') + '" aria-pressed="' + on + '" data-act="opt" data-v="' + o[0] + '">' + sw + '<span>' + esc(o[1]) + sub + '</span></button>';
  }).join('');
  const pct = 8 + 84 * state.step / steps.length;
  const canNext = multi ? ((val || []).length > 0 || st.optional) : (!!val || st.optional);
  setScreen(chrome('<p class="sfm-eyebrow">' + esc(JOURNEYS[state.mode].title) + ' · ' + (state.step + 1) + ' of ' + steps.length + '</p><h2 data-focus>' + esc(st.q) + '</h2>' + (multi ? '<p class="sfm-hint">' + (st.max ? 'Choose up to ' + st.max + '.' : 'Choose any.') + '</p>' : '') +
    '<div class="sfm-opts' + (st.type === 'swatch' ? ' sfm-opts-swatch' : '') + '" role="group" aria-label="' + esc(st.q) + '">' + opts + '</div>' +
    (st.id === 'budget' ? '<label class="sfm-fast"><input type="checkbox" data-fast' + (state.fast ? ' checked' : '') + '> Need it today? Put SOFIE NOW items first</label>' : '') +
    '<div class="sfm-nav"><button type="button" class="sfm-back" data-act="back">← Back</button>' + (multi || st.id === 'budget' ? '<button type="button" class="button" data-act="next"' + (canNext ? '' : ' disabled') + '>' + (st.id === 'budget' && !val ? 'Skip budget · Show my matches' : state.step === steps.length - 1 ? 'Show my matches' : 'Next') + ' →</button>' : '') + '</div>', pct, 'Question ' + (state.step + 1) + ' of ' + steps.length));
}
function summary(mode, a) {
  const pick = (id, v) => { const st = (JOURNEYS[mode].steps.find(s => s.id === id) || {}); const o = (st.opts || []).find(x => x[0] === v); return o ? o[1] : ''; };
  const bits = [];
  JOURNEYS[mode].steps.forEach(s => { const v = a[s.id]; if (!v || s.id === 'budget') return; if (Array.isArray(v)) v.forEach(x => bits.push(pick(s.id, x))); else bits.push(pick(s.id, v)); });
  return [JOURNEYS[mode].title].concat(bits.filter(Boolean)).join(' · ');
}
function thinking(n) {
  setScreen(chrome('<div class="sfm-thinking" aria-live="polite"><span class="sfm-orb" aria-hidden="true"></span><h2 data-focus>Reading the SOFIE shelves…</h2><p data-think>Checking ' + (n || 'every') + ' in-stock products for finish, shade range, skin type, notes and price.</p></div>', 96));
}
async function results() {
  const a = Object.assign({}, state.a, { fast: state.fast });
  store.set(LS_KEY, { mode: state.mode, a: state.a, at: Date.now() });
  thinking();
  try {
    let html = '';
    if (state.mode === 'base') {
      const key = { foundation: ['foundation'], skintint: ['skintint', 'foundation'], concealer: ['concealer'], powder: ['powder'] }[a.kind] || ['foundation'];
      const list = await feeds(key);
      const r = rank(list, scoreBase, a, 9);
      html = renderList(r, a);
    } else if (state.mode === 'lips') {
      const list = await feeds([a.kind === 'balm' ? 'balm' : a.kind]);
      html = renderList(rank(list, scoreLips, a, 9), a);
    } else if (state.mode === 'scent') {
      const keys = a.format === 'mist' ? ['mist'] : a.format === 'perfume' ? ['perfume'] : ['perfume', 'mist'];
      let list = await feeds(keys);
      if (list.length < 10) list = list.concat(await feeds(['fragrance']));
      html = renderList(rank(list, scoreScent, a, 9), a);
    } else if (state.mode === 'skin') {
      const steps = [
        { k: 'cleanser', name: 'Cleanse', rx: /cleans|wash|foam|gel|balm|micellar|oil/ },
        { k: 'treatment', name: 'Treat', rx: /serum|essence|treatment|toner|exfoli|acid|drops|ampoule|retin|vitamin/ },
