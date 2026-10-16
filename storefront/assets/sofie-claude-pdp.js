/* SOFIE Atelier — product page layer (loaded on product pages only)
   1. SOFIE NOW panel: one clear line for the chosen option, area, time and fee
   2. Complete your routine: smart pairing by category, same brand first, best sellers in stock
   3. You may also love: Shopify related products, with the brand's best sellers as a fallback
   4. Tutorials on YouTube when a product has no video yet */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const AREAS = { new_cairo: 30, nasr_city: 60, madinaty: 60, giza: 120, shorouk: 120, obour: 120, zayed: 120, october: 120 };
const strings = (() => { try { return JSON.parse($('#sf-config').textContent).strings || {}; } catch (e) { return {}; } })();
const say = k => { const n = document.createElement('textarea'); n.innerHTML = strings[k] || ''; return n.value; };
const areaName = a => say('area_' + a) || a.replace(/_/g, ' ');
function getArea() { try { const a = JSON.parse(localStorage.getItem('sofie-area')); return a === 'other' || AREAS[a] ? a : ''; } catch (e) { return ''; } }
function whenNear(el, fn, margin) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { rootMargin: margin || '1200px 0px' });
  io.observe(el);
}
function finishTrack(track) {
  $$('[data-skel]', track).forEach(n => n.remove());
  if (window.SofieUnify) window.SofieUnify(track);
  if (window.SofieHearts) window.SofieHearts(track);
  const rail = track.closest('[data-rail]');
  if (rail) { if (!rail._update && window.SofieRail) window.SofieRail(rail); if (rail._update) rail._update(); }
}
const getJSON = url => fetch(url, { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : [])).then(d => (Array.isArray(d) ? d : [])).catch(() => []);

/* ------------------------------------------------ 1. SOFIE NOW panel */
function nowPanel() {
  const box = $('[data-nowp]');
  if (!box) return;
  let data;
  try { data = JSON.parse($('[data-nowp-data]', box).textContent); } catch (e) { return; }
  const ready = new Set((data.ready || []).map(Number));
  const sel = $('[data-variant-select]');
  const state = $('[data-nowp-state]', box);
  const fee = m => (data.fees || {})[String(m)];
  const render = () => {
    const id = sel ? Number(sel.value) : Number((data.ready || [])[0]);
    const ok = ready.has(id);
    const area = getArea(), mins = AREAS[area];
    let msg;
    if (!ok) msg = 'This option ships with standard delivery. Pick a ready option below to get it today.';
    else if (area === 'other') msg = 'SOFIE NOW doesn’t reach your area yet, so this ships with standard delivery.';
    else if (mins) msg = (data.single ? 'Ready now' : 'This option is ready now') + ': about ' + mins + ' min to ' + areaName(area) + ' once we confirm your order · LE ' + fee(mins) + ' delivery.';
    else msg = (data.single ? 'Ready for express delivery today.' : 'This option is ready for express delivery today.') + ' Choose your area to see the time and fee.';
    state.textContent = msg;
    box.classList.toggle('is-ready', ok && area !== 'other');
    box.classList.toggle('is-standard', !ok || area === 'other');
    $$('[data-nowp-pick]', box).forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.nowpPick) === id)));
  };
  box.addEventListener('click', e => {
    const chip = e.target.closest('[data-nowp-pick]');
    if (!chip || !sel) return;
    sel.value = chip.dataset.nowpPick;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (sel) sel.addEventListener('change', render);
  document.addEventListener('click', e => { if (e.target.closest('[data-area-save]')) setTimeout(render, 0); });
  window.addEventListener('storage', e => { if (e.key === 'sofie-area') render(); });
  render();
}

/* ------------------------------------------------ 2. Complete your routine */
const PAIRS = {
  'foundation': ['face-primer', 'concealer', 'setting-spray-powder', 'blush'],
  'tinted-moisturizer': ['face-primer', 'concealer', 'setting-spray-powder', 'bronzer'],
  'concealer': ['foundation', 'setting-spray-powder', 'face-primer', 'eye-care'],
  'setting-spray-powder': ['foundation', 'concealer', 'face-primer', 'highlighter-1'],
  'face-primer': ['foundation', 'concealer', 'setting-spray-powder', 'sunscreen'],
  'blush': ['bronzer', 'highlighter-1', 'setting-spray-powder', 'lipstick'],
  'bronzer': ['blush', 'highlighter-1', 'setting-spray-powder', 'foundation'],
  'highlighter-1': ['blush', 'bronzer', 'setting-spray-powder', 'face-primer'],
  'mascara': ['eyeliner', 'eyebrow', 'eye-palettes', 'eye-care'],
  'eyeliner': ['mascara', 'eye-palettes', 'eyebrow', 'face-primer'],
  'eye-palettes': ['mascara', 'eyeliner', 'eyebrow', 'concealer'],
  'eyebrow': ['mascara', 'eyeliner', 'eye-palettes', 'concealer'],
  'lipstick': ['lip-liner', 'lip-gloss', 'lip-balms-treatments-1', 'blush'],
  'lip-gloss': ['lip-liner', 'lipstick', 'lip-balms-treatments-1', 'lip-oil'],
  'lip-oil': ['lip-liner', 'lip-gloss', 'lip-balms-treatments-1', 'blush'],
  'lip-balms-treatments-1': ['lip-oil', 'lip-gloss', 'lip-liner', 'masks-1'],
  'lip-liner': ['lipstick', 'lip-gloss', 'lip-balms-treatments-1', 'lip-oil'],
  'cleansers': ['treatments', 'moisturizers-1', 'sunscreen', 'masks-1'],
  'treatments': ['moisturizers-1', 'cleansers', 'sunscreen', 'eye-care'],
  'moisturizers-1': ['treatments', 'cleansers', 'sunscreen', 'eye-care'],
  'sunscreen': ['moisturizers-1', 'cleansers', 'treatments', 'face-primer'],
  'eye-care': ['treatments', 'moisturizers-1', 'concealer', 'cleansers'],
  'masks-1': ['cleansers', 'treatments', 'moisturizers-1', 'lip-balms-treatments-1'],
  'perfume-1': ['body-mist-hair-mist-1', 'all-fragrance-1', 'lip-balms-treatments-1'],
  'body-mist-hair-mist-1': ['perfume-1', 'all-fragrance-1', 'all-hair'],
  'all-fragrance-1': ['body-mist-hair-mist-1', 'perfume-1', 'lip-balms-treatments-1'],
  'shampoo-conditioner': ['treatments-hair', 'all-hair', 'body-mist-hair-mist-1'],
  'treatments-hair': ['shampoo-conditioner', 'all-hair', 'body-mist-hair-mist-1'],
  'all-hair': ['shampoo-conditioner', 'treatments-hair', 'body-mist-hair-mist-1']
};
const SPECIFIC = ['foundation', 'tinted-moisturizer', 'concealer', 'face-primer', 'setting-spray-powder', 'blush', 'bronzer', 'highlighter-1', 'mascara', 'eyeliner', 'eye-palettes', 'eyebrow', 'lip-liner', 'lipstick', 'lip-gloss', 'lip-oil', 'lip-balms-treatments-1', 'cleansers', 'sunscreen', 'eye-care', 'masks-1', 'moisturizers-1', 'treatments', 'perfume-1', 'body-mist-hair-mist-1', 'shampoo-conditioner', 'treatments-hair', 'all-fragrance-1', 'all-hair'];
const NAMES = { 'foundation': 'foundation', 'tinted-moisturizer': 'skin tint', 'concealer': 'concealer', 'setting-spray-powder': 'setting powder & spray', 'face-primer': 'primer', 'cleansers': 'cleanser', 'treatments': 'serum', 'moisturizers-1': 'moisturiser', 'sunscreen': 'SPF', 'eye-care': 'eye care', 'masks-1': 'mask', 'perfume-1': 'perfume', 'body-mist-hair-mist-1': 'body & hair mist', 'all-fragrance-1': 'fragrance', 'lip-gloss': 'gloss', 'lip-oil': 'lip oil', 'lipstick': 'lipstick', 'lip-balms-treatments-1': 'lip balm', 'lip-liner': 'lip liner', 'blush': 'blush', 'bronzer': 'bronzer', 'highlighter-1': 'highlighter', 'shampoo-conditioner': 'shampoo & conditioner', 'treatments-hair': 'hair treatment', 'all-hair': 'hair care', 'mascara': 'mascara', 'eyeliner': 'eyeliner', 'eye-palettes': 'eyeshadow', 'eyebrow': 'brow' };
let routineDone = Promise.resolve();
function routine() {
  const sec = $('[data-routine]');
  if (!sec) return;
  let cfg;
  try { cfg = JSON.parse($('[data-routine-config]', sec).textContent); } catch (e) { return; }
  const track = $('[data-routine-track]', sec);
  let release;
  routineDone = new Promise(r => { release = r; });
  whenNear(sec, async () => {
    try {
      const max = cfg.max || 8;
      const have = new Set([cfg.handle].concat($$('[data-handle]', track).map(n => n.dataset.handle)));
      const existing = $$('.sf-rail-item:not([data-skel])', track).length;
      const mine = (cfg.mine || '').split(',').filter(Boolean);
      const main = SPECIFIC.find(k => mine.indexOf(k) > -1);
      const wanted = main ? PAIRS[main] : [];
      const sfr = h => cfg.collections + '/' + h + '?view=sfr&sort_by=best-selling';
      const lists = await Promise.all([getJSON(cfg.vendorUrl + '&view=sfr&sort_by=best-selling')].concat(wanted.map(h => getJSON(sfr(h)))));
      const brand = lists[0], cats = lists.slice(1);
      const picks = [];
      const take = it => { if (!it || have.has(it.h) || existing + picks.length >= max) return; have.add(it.h); picks.push(it); };
      wanted.forEach(k => take(brand.find(p => !have.has(p.h) && (p.c || '').split(',').indexOf(k) > -1)));
      for (let round = 0; round < 3; round++) {
        cats.forEach(list => {
          const free = list.filter(p => !have.has(p.h));
          take(free.find(p => p.v === cfg.vendor) || free[0]);
        });
      }
      if (!wanted.length) brand.forEach(take);
      picks.forEach(p => {
        const d = document.createElement('div');
        d.className = 'sf-rail-item'; d.dataset.handle = p.h; d.innerHTML = p.html;
        track.append(d);
      });
      finishTrack(track);
      const total = $$('.sf-rail-item', track).length;
      if (total < 2) sec.hidden = true;
      else if (main) {
        const sub = $('[data-routine-sub]', sec);
        if (sub) sub.textContent = 'Made to go with your ' + NAMES[main] + ': ' + wanted.map(k => NAMES[k]).join(', ') + '. Same brand first, then our best sellers in stock today.';
      }
    } catch (e) {
      finishTrack(track);
      if (!$$('.sf-rail-item', track).length) sec.hidden = true;
    }
    release();
  }, '1400px 0px');
}

/* ------------------------------------------------ 3. You may also love */
function alsoLove() {
  const sec = $('[data-also]');
  if (!sec) return;
  const track = $('[data-also-track]', sec);
  whenNear(sec, async () => {
    let nodes = [];
    try {
      const html = await fetch(sec.dataset.url, { credentials: 'same-origin' }).then(r => (r.ok ? r.text() : ''));
      const doc = new DOMParser().parseFromString(html, 'text/html');
      nodes = $$('[data-also-track] > .sf-rail-item[data-handle]', doc);
    } catch (e) {}
    await Promise.race([routineDone, new Promise(r => setTimeout(r, 2500))]);
    const used = new Set([sec.dataset.handle].concat($$('[data-routine-track] [data-handle]').map(n => n.dataset.handle)));
    nodes = nodes.filter(n => !used.has(n.dataset.handle));
    if (nodes.length < 4 && sec.dataset.fallback) {
      const list = await getJSON(sec.dataset.fallback);
      list.forEach(p => {
        if (used.has(p.h) || nodes.some(n => n.dataset.handle === p.h)) return;
        const d = document.createElement('div');
        d.className = 'sf-rail-item'; d.dataset.handle = p.h; d.innerHTML = p.html;
        nodes.push(d);
      });
    }
    nodes = nodes.slice(0, 12);
    if (!nodes.length) { sec.hidden = true; return; }
    track.replaceChildren.apply(track, nodes);
    finishTrack(track);
  }, '1200px 0px');
}

/* ------------------------------------------------ 4. video fallback */
function videoFallback() {
  const grid = $('[data-video-grid]');
  const fb = $('[data-video-fallback]');
  if (!fb) return;
  if (grid && grid.children.length) return;
  const block = $('[data-videos]');
  if (block) block.hidden = false;
  fb.hidden = false;
  const link = $('[data-video-link]');
  if (link) link.hidden = false;
}

nowPanel();
routine();
alsoLove();
videoFallback();
})();

