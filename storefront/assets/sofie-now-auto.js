/* SOFIE NOW — automatic express delivery
   When the bag holds items that are ready for SOFIE NOW, the SOFIE NOW delivery
   line for the customer's area is added automatically (no tick box needed), so
   checkout always shows the right SOFIE NOW delivery, even when the customer
   checks out straight from the mini bag. If we don't know the area yet, a quick
   area picker opens before checkout. The bag page (sf-cart) runs the same rules
   with its own area list, so this file stays out of its way there. */
(() => {
  'use strict';
  if (window.SofieNowAuto) return;
  const root = (window.Shopify && Shopify.routes && Shopify.routes.root) || '/';
  const raw = (input, init) => (window.SofieRawFetch || window.fetch)(input, init);
  const MIN = { new_cairo: 30, nasr_city: 60, madinaty: 60, giza: 120, zayed: 120, october: 120, shorouk: 120, obour: 120 };
  const NAME = { new_cairo: 'New Cairo', nasr_city: 'Nasr City', madinaty: 'Madinaty', giza: 'Giza', zayed: 'Sheikh Zayed', october: '6 October', shorouk: 'El Shorouk', obour: 'El Obour' };
  const money = n => 'LE ' + n;
  const onBagPage = () => !!document.querySelector('[data-cartnow]') || !!document.getElementById('sf-cart-form');
  const getArea = () => { try { return JSON.parse(localStorage.getItem('sofie-area')) || ''; } catch (e) { return ''; } };
  let nowCartText = '';
  try {
    const cfg = JSON.parse((document.getElementById('sf-config') || {}).textContent || '{}');
    const t = document.createElement('textarea'); t.innerHTML = (cfg.strings && cfg.strings.now_cart) || ''; nowCartText = t.value.trim();
  } catch (e) {}

  /* ---------- state of the bag ---------- */
  async function readState() {
    const r = await raw(root + 'cart?view=now', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error('now-state');
    const s = JSON.parse(await r.text());
    if (!s || !s.fees || !s.price) throw new Error('now-state');
    return s;
  }

  function plan(s, area) {
    const mixed = (+s.other || 0) > 0;
    const std = +s.price.std || 150;
    if (!s.ready) return { status: 'none', want: '' };
    if (area === 'other') return { status: 'outside', want: '', attrs: { requested: 'No', fee: '', items: '', area: 'Another area' } };
    if (area === 'pickup') {
      if (!mixed && s.fees.pickup) {
        return { status: 'pickup', want: String(s.fees.pickup), attrs: { requested: 'Yes', fee: 'Store pickup · free · ready in ' + s.pickupMin + ' min', items: s.names, area: 'Store pickup · ' + s.pickupName } };
      }
      area = '';
    }
    const min = MIN[area];
    if (!min) return { status: 'need', want: '', mixed, attrs: { requested: 'No', fee: '', items: '', area: '' } };
    const want = s.fees[String(min) + (mixed ? 'm' : '')];
    if (!want) return { status: 'unavailable', want: '' };
    const base = +s.price[min] || 0;
    const fee = money(base + (mixed ? std : 0)) + ' · ' + min + ' min · ' + NAME[area] + (mixed ? ' (' + money(base) + ' SOFIE NOW + ' + money(std) + ' standard for other items)' : '');
    return { status: 'on', want: String(want), min, base, std, mixed, areaName: NAME[area], attrs: { requested: 'Yes', fee, items: s.names, area: NAME[area] } };
  }

  /* No saved area on this device, but the bag already has a SOFIE NOW line (chosen
     earlier on the bag page): keep that choice instead of asking again. */
  function inferArea(s) {
    const lines = s.lines || [];
    if (lines.length !== 1) return '';
    const id = String(lines[0].id);
    const key = Object.keys(s.fees).find(k => s.fees[k] && String(s.fees[k]) === id) || '';
    if (!key) return '';
    if (key === 'pickup') return 'pickup';
    const band = key.replace('m', '');
    const cur = (s.attrs && s.attrs.area) || '';
    const match = Object.keys(NAME).find(k => NAME[k] === cur && String(MIN[k]) === band);
    if (match) return match;
    return band === '30' ? 'new_cairo' : band === '60' ? 'nasr_city' : band === '120' ? 'giza' : '';
  }

  function inSync(s, p) {
    const lines = s.lines || [];
    const linesOk = p.want ? (lines.length === 1 && String(lines[0].id) === p.want && +lines[0].qty === 1) : lines.length === 0;
    if (!linesOk) return false;
    const a = s.attrs || {};
    const want = p.attrs || { requested: 'No', fee: '', items: '' };
    const req = v => (v === 'Yes' ? 'Yes' : 'No');
    if (req(a.requested) !== req(want.requested)) return false;
    if ((a.fee || '') !== (want.fee || '')) return false;
    if ((a.items || '') !== (want.items || '')) return false;
    if ('area' in want && p.status !== 'need' && (a.area || '') !== (want.area || '')) return false;
    return true;
  }

  let chain = Promise.resolve();
  let last = null;
  function ensure() {
    chain = chain.catch(() => {}).then(async () => {
      const s = await readState();
      let area = getArea();
      if (!area) area = inferArea(s);
      const p = plan(s, area);
      if (!inSync(s, p)) {
        const updates = {};
        Object.values(s.fees).filter(Boolean).forEach(id => { updates[id] = 0; });
        (s.lines || []).forEach(l => { updates[l.id] = 0; });
        if (p.want) updates[p.want] = 1;
        const attrs = p.attrs || { requested: 'No', fee: '', items: '' };
        const body = { updates, attributes: { 'SOFIE NOW requested': attrs.requested, 'SOFIE NOW fee': attrs.fee, 'SOFIE NOW items': attrs.items } };
        if ('area' in attrs && p.status !== 'need') body.attributes['SOFIE NOW area'] = attrs.area;
        const r = await raw(root + 'cart/update.js', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error('now-update');
        p.changed = true;
      }
      last = { s, p };
      paintMini();
      document.dispatchEvent(new CustomEvent('sofie:now', { detail: { status: p.status, plan: p } }));
      return p;
    });
    return chain;
  }

  let timer = null;
  function schedule(ms) {
    if (onBagPage()) return;
    clearTimeout(timer);
    timer = setTimeout(() => { ensure().catch(() => {}); }, ms == null ? 250 : ms);
  }

  /* ---------- run after every change to the bag ---------- */
  const prevFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const p = prevFetch.call(window, input, init);
    if (/\/cart\/(?:add|change|update|clear)(?:\.js)?(?:\?|$)/.test(url)) p.then(r => { if (r && r.ok) schedule(); }).catch(() => {});
    return p;
  };
  window.addEventListener('storage', e => { if (e.key === 'sofie-area') schedule(0); });
  window.addEventListener('pageshow', e => { if (e.persisted) schedule(0); });

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = '.sf-mini-now{border:1px solid rgba(21,21,21,.14);padding:12px 14px;margin:12px 0;font-size:13px;line-height:1.5}.sf-mini-now.is-need{border-color:#b33a3a;background:#fdf5f3}.sf-mini-now p{margin:0}.sf-mini-now .sf-mini-now-badge{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.14em;margin-bottom:4px}.sf-mini-now button{background:none;border:0;padding:0;margin-top:6px;font:inherit;text-decoration:underline;cursor:pointer;color:inherit}.sf-now-need{background:#fdf5f3;border-left:3px solid #b33a3a;padding:10px 12px;margin:0 0 14px;font-size:14px;line-height:1.5}.sf-now-need a{text-decoration:underline}';
  document.head.appendChild(css);

  /* ---------- mini bag status line ---------- */
  function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function paintMini() {
    const box = document.querySelector('#sf-cart [data-cart-content]');
    if (!box) return;
    let line = box.querySelector('[data-mini-now]');
    const sub = box.querySelector('.sf-drawer-subtotal');
    const staticNote = nowCartText ? Array.from(box.querySelectorAll('p.small')).find(p => p.textContent.trim() === nowCartText) : null;
    const p = last && last.p, s = last && last.s;
    if (!sub || !p || p.status === 'none' || p.status === 'unavailable') { if (line) line.remove(); if (staticNote) staticNote.hidden = false; return; }
    if (!line) { line = node('div', 'sf-mini-now'); line.setAttribute('data-mini-now', ''); line.setAttribute('aria-live', 'polite'); sub.after(line); }
    if (staticNote) staticNote.hidden = true;
    line.classList.toggle('is-need', p.status === 'need');
    line.replaceChildren();
    const badge = node('p', 'sf-mini-now-badge');
    const dot = node('i', 'sf-pulse'); dot.setAttribute('aria-hidden', 'true');
    badge.append(dot, document.createTextNode(p.status === 'pickup' ? 'SOFIE STORE PICKUP' : 'SOFIE NOW'));
    let text = '', btn = 'Change area';
    if (p.status === 'on') text = p.areaName + ' · ' + p.min + ' min — ' + money(p.base) + ' express delivery is added automatically at checkout.' + (p.mixed ? ' Your other items ship with standard delivery (+' + money(p.std) + ').' : '');
    else if (p.status === 'pickup') text = 'Free pickup at ' + s.pickupName + ', ready about ' + s.pickupMin + ' minutes after we confirm. Choose “Store pickup” at checkout.';
    else if (p.status === 'outside') text = 'SOFIE NOW doesn’t reach your area yet, so your order ships with standard delivery.';
    else { text = 'Items in your bag are ready for SOFIE NOW. Choose your area so the right express delivery is added before checkout.'; btn = 'Choose your area'; }
    const b = node('button', '', btn); b.type = 'button';
    b.addEventListener('click', () => askArea(null));
    line.append(badge, node('p', '', text), b);
  }
  const drawerBox = document.querySelector('#sf-cart [data-cart-content]');
  if (drawerBox && 'MutationObserver' in window) {
    new MutationObserver(() => {
      if (drawerBox.querySelector('[data-mini-now]') || !drawerBox.querySelector('.sf-drawer-subtotal')) return;
      if (last) paintMini(); else schedule(0);
    }).observe(drawerBox, { childList: true });
  }

  /* ---------- area picker before checkout ---------- */
  let pending = null;
  const busy = new Set();
  function release() { busy.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); }); busy.clear(); }
  function askArea(onDone) {
    const d = document.getElementById('sf-area');
    if (!d || typeof d.showModal !== 'function') { location.assign(root + 'cart'); return; }
    pending = onDone;
    const content = d.querySelector('.sf-area-content') || d;
    let note = d.querySelector('[data-now-need]');
    if (!note) { note = node('p', 'sf-now-need'); note.setAttribute('data-now-need', ''); note.setAttribute('role', 'status'); const lbl = content.querySelector('label'); content.insertBefore(note, lbl || content.firstChild); }
    note.replaceChildren(document.createTextNode('Items in your bag are ready for SOFIE NOW. Choose your delivery area and we’ll add the right express delivery' + (onDone ? ', then take you to checkout.' : '.')));
    const s = last && last.s;
    if (s && !(+s.other) && s.fees && s.fees.pickup) {
      const a = node('a', '', 'Prefer free store pickup? Choose it in your bag.'); a.href = root + 'cart';
      note.append(document.createElement('br'), a);
    }
    note.hidden = false;
    document.querySelectorAll('dialog[open]').forEach(x => { if (x !== d) x.close(); });
    if (!d.open) d.showModal();
    const sel = d.querySelector('[data-area-select]');
    if (sel) { const a = getArea(); if (a && sel.querySelector('option[value="' + a + '"]')) sel.value = a; sel.focus(); }
  }
  const areaDialog = document.getElementById('sf-area');
  if (areaDialog) areaDialog.addEventListener('close', () => {
    const note = areaDialog.querySelector('[data-now-need]');
    if (note) note.hidden = true;
    if (pending) { pending = null; release(); }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-area-save]')) return;
    const cont = pending; pending = null;
    if (onBagPage()) { setTimeout(() => location.reload(), 150); return; }
    ensure().then(p => {
      if (!cont) return;
      if (p.status === 'need') { release(); askArea(cont); return; }
      cont();
    }).catch(() => { if (cont) cont(); });
  });

  /* ---------- checkout from anywhere except the bag page ---------- */
  function goCheckout(go, button) {
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); busy.add(button); }
    clearTimeout(timer);
    ensure().then(p => {
      if (p.status === 'need') { askArea(go); return; }
      go();
    }).catch(() => go());
  }
  const toCheckout = () => location.assign(root + 'checkout');
  document.addEventListener('submit', e => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || form.id === 'sf-cart-form' || onBagPage()) return;
    const sub = e.submitter;
    let path = '';
    try { path = new URL(form.getAttribute('action') || '', location.href).pathname; } catch (err) {}
    const isCheckout = (sub && sub.name === 'checkout') || /\/checkout(?:\/|$)/.test(path);
    if (!isCheckout || !/\/(?:cart|checkout)(?:\/|$)/.test(path)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    goCheckout(toCheckout, sub || form.querySelector('[name="checkout"]'));
  }, true);
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || onBagPage() || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    let u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || !/\/checkout(?:\/|$)/.test(u.pathname)) return;
    e.preventDefault();
    goCheckout(() => location.assign(u.href), null);
  }, true);

  /* ---------- first run ---------- */
  const countEl = document.querySelector('[data-cart-count]');
  if ((parseInt(countEl && countEl.textContent, 10) || 0) > 0) schedule(400);

  window.SofieNowAuto = { ensure, askArea, state: () => last };
})();

