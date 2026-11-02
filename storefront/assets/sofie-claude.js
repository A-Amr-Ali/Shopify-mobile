/* SOFIE Atelier — Claude edit enhancements
   1. Same-background product photos (processed off the main thread in a Web Worker)
   2. Hero banner slideshow
   3. Product / brand rails with arrows
   4. Fresh at SOFIE brand chips
   5. New In tabs (Section Rendering API)
   6. Find My Match launcher (engine lazy-loaded)
   7. Banner collages filled after the page has loaded
   8. Product rails loaded after the page has loaded
   9. SOFIE NOW delivery line kept out of the mini bag */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 900 }) : setTimeout(fn, 40));

/* ------------------------------------------------ 1. same background */
const MAX_SIDE = 480;
function sfClean(px, w, h) {
  const border = [];
  const take = (x, y) => { const i = (y * w + x) * 4; border.push([px[i], px[i + 1], px[i + 2], px[i + 3]]); };
  for (let x = 0; x < w; x += 2) { take(x, 0); take(x, 1); take(x, h - 2); take(x, h - 1); }
  for (let y = 0; y < h; y += 2) { take(0, y); take(1, y); take(w - 2, y); take(w - 1, y); }
  if (border.filter(b => b[3] < 20).length > border.length * .6) return 'transparent';
  const med = [0, 1, 2].map(c => { const a = border.map(b => b[c]).sort((m, n) => m - n); return a[a.length >> 1]; });
  const dist = (r, g, b) => Math.sqrt((r - med[0]) * (r - med[0]) + (g - med[1]) * (g - med[1]) + (b - med[2]) * (b - med[2]));
  const close = border.filter(b => dist(b[0], b[1], b[2]) < 22).length / border.length;
  if (med[0] >= 250 && med[1] >= 250 && med[2] >= 250) return 'white';
  if (close < .72) return 'busy';
  const light = (med[0] + med[1] + med[2]) / 3 > 222;
  const T1 = light ? 10 : 24, T2 = light ? 26 : 46, n = w * h;
  const seen = new Uint8Array(n), queue = new Int32Array(n);
  let head = 0, tail = 0;
  const push = id => { if (seen[id]) return; const i = id * 4; if (dist(px[i], px[i + 1], px[i + 2]) < T2) { seen[id] = 1; queue[tail++] = id; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) { const id = queue[head++]; const x = id % w, y = (id / w) | 0; if (x > 0) push(id - 1); if (x < w - 1) push(id + 1); if (y > 0) push(id - w); if (y < h - 1) push(id + w); }
  let removed = 0;
  for (let id = 0; id < n; id++) {
    if (!seen[id]) continue;
    const i = id * 4, d = dist(px[i], px[i + 1], px[i + 2]);
    const a = d <= T1 ? 0 : Math.round(255 * (d - T1) / (T2 - T1));
    px[i + 3] = Math.min(px[i + 3], a);
    if (a < 128) removed++;
  }
  const frac = removed / n;
  if (frac < .08 || frac > .94) return 'skip';
  return 'done';
}
let worker = null, jobId = 0;
const jobs = new Map();
function getWorker() {
  if (worker !== null) return worker;
  try {
    if (!('OffscreenCanvas' in window) || !('createImageBitmap' in window) || !window.Worker) throw new Error('no worker');
    const src = sfClean.toString() + '\nonmessage=async e=>{const d=e.data;try{const cv=new OffscreenCanvas(d.w,d.h);const cx=cv.getContext("2d",{willReadFrequently:true});cx.drawImage(d.bmp,0,0,d.w,d.h);if(d.bmp.close)d.bmp.close();const data=cx.getImageData(0,0,d.w,d.h);const r=sfClean(data.data,d.w,d.h);if(r!=="done"){postMessage({id:d.id,r});return}cx.putImageData(data,0,0);const blob=await cv.convertToBlob({type:"image/webp",quality:.92});postMessage({id:d.id,r,blob})}catch(err){postMessage({id:d.id,r:"err"})}};';
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = e => { const job = jobs.get(e.data.id); if (job) { jobs.delete(e.data.id); job(e.data); } };
    worker.onerror = () => { worker = false; jobs.forEach(job => job({ r: 'retry' })); jobs.clear(); };
  } catch (e) { worker = false; }
  return worker;
}
function cleanOnMain(img, w, h, apply) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, w, h);
  let data;
  try { data = cx.getImageData(0, 0, w, h); } catch (e) { return 'tainted'; }
  const r = sfClean(data.data, w, h);
  if (r !== 'done') return r;
  cx.putImageData(data, 0, 0);
  if (cv.toBlob) cv.toBlob(b => { if (b) apply(b); }, 'image/webp', .92);
  else { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = cv.toDataURL('image/png'); img.classList.add('is-unified'); }
  return 'done';
}
function unifyImg(img) {
  if (!img || img.dataset.unified) return;
  if (!img.complete || !img.naturalWidth) { img.addEventListener('load', () => unifyImg(img), { once: true }); return; }
  const raw = img.currentSrc || img.src;
  let u;
  try { u = new URL(raw, location.href); } catch (e) { return; }
  if (u.protocol === 'data:' || u.protocol === 'blob:' || u.origin !== location.origin) { img.dataset.unified = 'skip'; return; }
  img.dataset.unified = 'pending';
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const finish = r => { img.dataset.unified = r; if (r === 'busy') img.classList.add('is-photo'); };
  const apply = blob => { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = URL.createObjectURL(blob); img.classList.add('is-unified'); };
  const onMain = () => finish('skip');
  const wk = getWorker();
  if (!wk) { onMain(); return; }
  createImageBitmap(img).then(bmp => {
    const id = ++jobId;
    jobs.set(id, res => { if (res.r === 'retry') { onMain(); return; } if (res.r === 'done' && res.blob) apply(res.blob); finish(res.r); });
    wk.postMessage({ id, bmp, w, h }, [bmp]);
  }).catch(onMain);
}
const unifySelector = '[data-unify] img, img[data-unify], img[data-unify-img]';
const unifyIO = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { unifyIO.unobserve(en.target); unifyImg(en.target); } });
}, { rootMargin: '400px 0px' }) : null;
function SofieUnify(scope) {
  if (matchMedia('(max-width: 800px), (pointer: coarse)').matches) return;
  $$(unifySelector, scope || document).forEach(img => { if (img.dataset.unified) return; unifyIO ? unifyIO.observe(img) : unifyImg(img); });
}
window.SofieUnify = SofieUnify;

/* ------------------------------------------------ saved hearts (dynamic cards) */
function refreshHearts(scope) {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem('sofie-favourites')) || []; } catch (e) {}
  $$('[data-save]', scope).forEach(b => b.setAttribute('aria-pressed', String(saved.some(x => x && x.handle === b.dataset.save))));
}
window.SofieHearts = refreshHearts;

/* ------------------------------------------------ 3. rails */
function initRail(rail) {
  if (rail.dataset.ready) return; rail.dataset.ready = '1';
  const track = $('[data-rail-track]', rail);
  const prev = $('[data-rail-prev]', rail), next = $('[data-rail-next]', rail);
  if (!track) return;
  const rtl = getComputedStyle(track).direction === 'rtl';
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    const pos = Math.abs(track.scrollLeft);
    if (prev) prev.disabled = pos <= 2;
    if (next) next.disabled = pos >= max;
    rail.classList.toggle('is-static', max <= 2);
  };
  const go = dir => track.scrollBy({ left: dir * (rtl ? -1 : 1) * track.clientWidth * .88, behavior: reduceMotion ? 'auto' : 'smooth' });
  prev && prev.addEventListener('click', () => go(-1));
  next && next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  window.addEventListener('resize', update);
  update();
  rail._update = update;
}
window.SofieRail = initRail;

/* ------------------------------------------------ 2. slideshow */
function initSlides(sec) {
  const track = $('[data-slides-track]', sec);
  const slides = $$('[data-slide]', sec);
  if (!track || slides.length < 2) return;
  const dots = $$('[data-slide-to]', sec);
  const pauseBtn = $('[data-slide-pause]', sec);
  const rtl = getComputedStyle(track).direction === 'rtl';
  let index = 0, timer = null, paused = sec.dataset.autoplay !== 'true' || reduceMotion, visible = true, hover = false;
  const interval = parseInt(sec.dataset.interval, 10) || 7000;
  const toneOf = s => (s.className.match(/sf-tone-(\w+)/) || [])[1] || 'cream';
  const mark = i => {
    index = i;
    dots.forEach((d, n) => d.setAttribute('aria-selected', String(n === i)));
    slides.forEach((s, n) => s.setAttribute('aria-hidden', String(n !== i)));
    sec.dataset.tone = toneOf(slides[i]);
  };
  const goTo = (i, smooth) => {
    const n = (i + slides.length) % slides.length;
    track.scrollTo({ left: (rtl ? -1 : 1) * n * track.clientWidth, behavior: smooth === false || reduceMotion ? 'auto' : 'smooth' });
    mark(n);
  };
  const tick = () => { if (!paused && visible && !hover && !document.hidden) goTo(index + 1); };
  const start = () => { clearInterval(timer); timer = setInterval(tick, interval); };
  track.addEventListener('scroll', () => {
    const i = Math.round(Math.abs(track.scrollLeft) / Math.max(track.clientWidth, 1));
    if (i !== index && i >= 0 && i < slides.length) mark(i);
  }, { passive: true });
  dots.forEach(d => d.addEventListener('click', () => { goTo(parseInt(d.dataset.slideTo, 10)); start(); }));
  const p = $('[data-slide-prev]', sec), nx = $('[data-slide-next]', sec);
  p && p.addEventListener('click', () => { goTo(index - 1); start(); });
  nx && nx.addEventListener('click', () => { goTo(index + 1); start(); });
  sec.addEventListener('mouseenter', () => { hover = true; });
  sec.addEventListener('mouseleave', () => { hover = false; });
  sec.addEventListener('focusin', () => { hover = true; });
  sec.addEventListener('focusout', () => { hover = false; });
  if (pauseBtn) {
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.addEventListener('click', () => { paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow'); });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .35 }).observe(sec);
  window.addEventListener('resize', () => goTo(index, false));
  mark(0);
  start();
}

/* ------------------------------------------------ 4. fresh chips */
function initChips(sec) {
  const chips = $$('[data-chip]', sec);
  if (!chips.length) return;
  const items = $$('.sf-rail-item[data-brand]', sec);
  const rail = $('[data-rail]', sec);
  chips.forEach(c => c.addEventListener('click', () => {
    const v = c.dataset.chip;
    chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
    items.forEach(it => { it.hidden = !!v && it.dataset.brand !== v; });
    const track = rail && $('[data-rail-track]', rail);
    if (track) track.scrollTo({ left: 0 });
    rail && rail._update && rail._update();
  }));
}

/* ------------------------------------------------ 5. new-in tabs */
function initTabs(sec) {
  const tabs = $$('[data-tab-feed]', sec);
  const panel = $('[data-tab-panel]', sec);
  const viewAll = $('[data-tab-viewall]', sec);
  const sort = sec.dataset.sort;
  const cache = new Map();
  let requested = 0;
  if (!tabs.length || !panel) return;
  if (panel.hasAttribute('data-lazy-feed')) panel.addEventListener('sf:filled', () => cache.set(tabs[0].dataset.tabFeed, panel.innerHTML), { once: true });
  else cache.set(tabs[0].dataset.tabFeed, panel.innerHTML);
  async function load(tab) {
    const request = ++requested;
    panel.dataset.tabbed = '1';
    tabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    if (viewAll) viewAll.href = tab.dataset.tabUrl + (sort && sort !== 'manual' ? '?sort_by=' + sort : '');
    const url = tab.dataset.tabFeed;
    let html = cache.get(url);
    if (html == null) {
      panel.classList.add('is-loading');
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('feed_unavailable');
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const feed = doc.querySelector('[data-feed]');
        html = feed ? Array.from(feed.children).slice(0, Number(sec.dataset.limit) || 12).map(n => n.outerHTML).join('') : '';
        cache.set(url, html);
      } catch (e) { html = '<p class="sf-empty-note">' + (document.documentElement.lang === 'ar' ? 'تعذّر تحميل المنتجات. افتحي المجموعة من رابط عرض الكل.' : 'Products could not load. Open the collection with View all.') + '</p>'; }
      if (request !== requested) return;
      panel.classList.remove('is-loading');
    }
    panel.innerHTML = html && html.trim() ? html : '<p class="sf-empty-note">' + (document.documentElement.lang === 'ar' ? 'لا توجد اختيارات متاحة حاليًا. تصفحي المجموعة أو اسألي الفريق.' : 'No options are available right now. Browse the collection or ask our team.') + '</p>';
    panel.scrollTo({ left: 0 });
    panel.closest('[role=tabpanel]')?.setAttribute('aria-labelledby', tab.id);
    SofieUnify(panel); refreshHearts(panel);
    const rail = panel.closest('[data-rail]'); rail && rail._update && rail._update();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => load(t));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      n.focus(); load(n);
    });
  });
}

/* ------------------------------------------------ 6. Find My Match */
let matchLoading = null;
function loadMatch() {
  if (window.SofieMatch) return Promise.resolve();
  if (matchLoading) return matchLoading;
  const cfgEl = $('[data-match-config]');
  if (!cfgEl) return Promise.reject(new Error('no config'));
  const parts = JSON.parse(cfgEl.textContent).scripts || [];
  matchLoading = Promise.all(parts.map(u => fetch(u).then(r => { if (!r.ok) throw new Error('engine'); return r.text(); })))
    .then(texts => new Promise((ok, fail) => {
      const url = URL.createObjectURL(new Blob([texts.join('')], { type: 'text/javascript' }));
      const s = document.createElement('script'); s.src = url; s.onload = () => { URL.revokeObjectURL(url); ok(); }; s.onerror = fail; document.head.appendChild(s);
    }))
    .catch(err => { matchLoading = null; throw err; });
  return matchLoading;
}
function openMatch(mode, trigger) {
  const dlg = document.getElementById('sf-match');
  if (!dlg) return;
  $$('dialog[open]').forEach(d => { if (d !== dlg) d.close(); });
  if (!dlg.open) dlg.showModal();
  dlg._trigger = trigger || document.activeElement;
  loadMatch().then(() => window.SofieMatch.start(mode || '')).catch(() => {
    const app = $('[data-match-app]', dlg);
    if (app) app.innerHTML = '<div class="sfm-boot"><p>Find My Match could not load. Please refresh the page.</p></div>';
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-match-open], a[href*="#sfm"], a[href$="#find-my-match"]');
  if (!b) return;
  e.preventDefault();
  openMatch(b.dataset ? b.dataset.matchOpen : '', b);
});
const dlg = document.getElementById('sf-match');
if (dlg) {
  dlg.addEventListener('close', () => { if (dlg._trigger && dlg._trigger.focus) dlg._trigger.focus({ preventScroll: true }); });
  if (['#sfm', '#find-my-match', '#match'].indexOf(location.hash) > -1) setTimeout(() => openMatch(''), 350);
  const idleLoad = () => loadMatch().catch(() => {});
  $$('[data-match-open]').forEach(b => { b.addEventListener('pointerenter', idleLoad, { once: true }); b.addEventListener('focus', idleLoad, { once: true }); });
}
try {
  const s = JSON.parse(localStorage.getItem('sofie-match') || 'null');
  if (s && s.mode) $$('[data-match-resume]').forEach(n => { n.hidden = false; const t = $('[data-match-resume-text]', n); if (t) t.textContent = 'Welcome back — your last match is saved.'; });
} catch (e) {}

/* ------------------------------------------------ 7. banner collages */
const COLLAGE_TTL = 6 * 3600 * 1000;
function collageData(url) {
  const key = 'sofie-collage:' + url;
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < COLLAGE_TTL && Array.isArray(c.d) && c.d.length) return Promise.resolve(c.d); } catch (e) {}
  return fetch(url, { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : [])).then(d => {
    d = Array.isArray(d) ? d : [];
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
    return d;
  }).catch(() => []);
}
const sized = (src, w) => { try { const x = new URL(src, location.href); x.searchParams.set('width', w); return x.href; } catch (e) { return src; } };
function picture(p, widths, sizes, alt) {
  const img = document.createElement('img');
  img.loading = 'lazy'; img.decoding = 'async'; img.alt = alt || '';
  img.src = sized(p.i, widths[widths.length - 1]);
  img.srcset = widths.map(w => sized(p.i, w) + ' ' + w + 'w').join(', ');
  img.sizes = sizes;
  return img;
}
function fillCollage(box) {
  if (box.dataset.filled) return;
  box.dataset.filled = '1';
  const kind = box.dataset.collageKind;
  collageData(box.dataset.collage).then(list => {
    list.slice(0, 3).forEach((p, i) => {
      const n = i + 1;
      let item;
      if (kind === 'slide') {
        item = document.createElement('a'); item.href = p.u; item.tabIndex = -1;
        item.className = 'sf-collage-item sf-collage-' + n;
        item.append(picture(p, [300, 450, 600, 700], '(min-width: 800px) 22vw, 40vw', p.t));
        const s = document.createElement('span'); s.textContent = p.v; item.append(s);
      } else {
        item = document.createElement('span');
        item.className = (kind === 'bb' ? 'sf-bb-item sf-bb-item-' : 'sf-collage-item sf-collage-') + n;
        item.append(picture(p, [240, 360, 500], kind === 'bb' ? '(min-width: 900px) 12vw, 35vw' : '(min-width: 900px) 14vw, 40vw', ''));
      }
      item.setAttribute('data-unify', '');
      box.append(item);
    });
    SofieUnify(box);
  });
}
const collageIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  collageIO.unobserve(e.target);
  $$('[data-collage]', e.target).forEach(fillCollage);
}), { rootMargin: '900px 0px' }) : null;
function initCollages(scope) {
  const roots = new Set();
  $$('[data-collage]', scope || document).forEach(b => {
    if (b.dataset.filled) return;
    if (b.dataset.collageKind === 'slide' || !collageIO) { setTimeout(() => idle(() => fillCollage(b)), 900); return; }
    roots.add(b.closest('section') || b.parentElement);
  });
  roots.forEach(r => collageIO.observe(r));
}

/* ------------------------------------------------ 8. product rails loaded after the page */
function fillFeed(track) {
  if (track.dataset.lazyDone) return;
  track.dataset.lazyDone = '1';
  const limit = parseInt(track.dataset.lazyLimit, 10) || 12;
  fetch(track.dataset.lazyFeed, { credentials: 'same-origin' }).then(r => (r.ok ? r.text() : '')).then(html => {
    if (track.dataset.tabbed) return;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = $$('[data-feed] > .sf-rail-item', doc).slice(0, limit);
    if (!items.length) {
      const sec = track.closest('section');
      if (track.hasAttribute('data-tab-panel')) track.innerHTML = '<p class="sf-empty-note">New arrivals are on their way.</p>';
      else if (sec) sec.hidden = true;
      return;
    }
    const grid = !track.hasAttribute('data-rail-track');
    const frag = document.createDocumentFragment();
    items.forEach((it, i) => {
      if (track.hasAttribute('data-lazy-rank')) {
        const pic = it.querySelector('.sf-card-image');
        if (pic) { const r = document.createElement('span'); r.className = 'sf-rank'; r.textContent = 'No.' + (i + 1); pic.prepend(r); }
      }
      frag.append(grid ? (it.firstElementChild || it) : it);
    });
    track.replaceChildren(frag);
    SofieUnify(track); refreshHearts(track);
    const rail = track.closest('[data-rail]'); rail && rail._update && rail._update();
    track.dispatchEvent(new CustomEvent('sf:filled'));
  }).catch(() => { track.dataset.lazyDone = ''; });
}
const feedIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  feedIO.unobserve(e.target);
  $$('[data-lazy-feed]', e.target).forEach(fillFeed);
}), { rootMargin: '900px 0px' }) : null;
function initFeeds(scope) {
  $$('[data-lazy-feed]', scope || document).forEach(t => {
    if (t.dataset.lazyDone) return;
    const root = t.closest('section') || t;
    feedIO ? feedIO.observe(root) : fillFeed(t);
  });
}

/* ------------------------------------------------ 9. SOFIE NOW delivery line
   The SOFIE NOW line is managed on the bag page (area + tick box). It weighs the
   order so checkout shows only the SOFIE NOW delivery for that area, so it is
   kept out of the mini bag and the bag counter. */
const NOW_FEE = 'sofie-now-express-delivery';
const nativeFetch = window.fetch.bind(window);
window.SofieRawFetch = nativeFetch;
window.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const p = nativeFetch(input, init);
  if (!/\/cart(?:\.js|\/(?:change|update|add)\.js)(?:\?|$)/.test(url)) return p;
  return p.then(res => {
    if (!res.ok) return res;
    return res.clone().json().then(data => {
      if (!data || !Array.isArray(data.items) || !data.items.some(i => i.handle === NOW_FEE)) return res;
      const qty = data.items.filter(i => i.handle === NOW_FEE).reduce((n, i) => n + i.quantity, 0);
      data.items = data.items.filter(i => i.handle !== NOW_FEE);
      if (typeof data.item_count === 'number') data.item_count = Math.max(0, data.item_count - qty);
      return new Response(JSON.stringify(data), { status: res.status, statusText: res.statusText, headers: { 'Content-Type': 'application/json' } });
    }).catch(() => res);
  });
};

/* ------------------------------------------------ boot */
function boot(scope) {
  const r = scope || document;
  $$('[data-rail]', r).forEach(initRail);
  $$('[data-slides]', r).forEach(initSlides);
  $$('[data-fresh]', r).forEach(initChips);
  $$('[data-newtabs]', r).forEach(initTabs);
  initFeeds(r);
  initCollages(r);
  SofieUnify(r);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot()); else boot();
document.addEventListener('shopify:section:load', e => boot(e.target));
})();

/* ---------- 10. SOFIE NOW opening hours (Cairo time) ---------- */
(() => {
  const run = () => {
  const els = document.querySelectorAll('[data-now-status]');
  if (!els.length) return;
  const hour = () => { try { return +new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric', hour12: false }).format(new Date()) % 24; } catch (e) { return new Date().getHours(); } };
  const paint = () => {
    const h = hour();
    els.forEach(el => {
      const open = +el.dataset.open || 10, close = +el.dataset.close || 22;
      const on = h >= open && h < close;
      el.classList.toggle('is-open', on);
      el.classList.toggle('is-closed', !on);
      el.textContent = on ? 'Open now · until ' + el.dataset.closeText : 'Closed now · opens ' + el.dataset.openText;
      el.title = 'Every day ' + el.dataset.openText + '–' + el.dataset.closeText + ', Cairo time';
    });
  };
  paint();
  setInterval(paint, 60000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

