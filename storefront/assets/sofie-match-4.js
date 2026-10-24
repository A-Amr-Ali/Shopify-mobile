        { k: 'moisturizer', name: 'Moisturise', rx: /moistur|cream|lotion|gel[- ]cream|emulsion|balm/ },
        { k: 'spf', name: 'Protect (AM)', rx: /spf|sunscreen|uv|sun/ }
      ];
      if (a.size === '5') { steps.splice(3, 0, { k: 'eye', name: 'Eye care', rx: /eye/ }); steps.push({ k: 'mask', name: 'Weekly mask', rx: /mask|peel/ }); }
      const sets = await Promise.all(steps.map(s => feeds([s.k])));
      html = renderRoutine(steps.map((s, i) => ({ step: s, picks: rank(sets[i], (p, q) => scoreSkinItem(p, q, s), a, 3) })), a);
    } else if (state.mode === 'hair') {
      const all = { wash: [{ k: 'shampoo', name: 'Shampoo', rx: /shampoo/ }, { k: 'shampoo', name: 'Conditioner', rx: /conditioner/ }], treat: [{ k: 'hairtreat', name: 'Treatment', rx: /treatment|serum|oil|bond|repair/ }, { k: 'hairtreat', name: 'Mask', rx: /mask/ }], style: [{ k: 'hair', name: 'Style', rx: /spray|cream|mousse|gel|styl|heat|texture|dry shampoo|primer|oil/ }] };
      const steps = a.want === 'routine' ? all.wash.concat(all.treat.slice(0, 1), all.style) : all[a.want] || all.wash;
      const sets = await Promise.all(steps.map(s => feeds([s.k, 'hair'])));
      html = renderRoutine(steps.map((s, i) => ({ step: s, picks: rank(sets[i], (p, q) => scoreHairItem(p, q, s), a, 3) })), a);
    }
    setScreen(chrome(html, 100));
    document.dispatchEvent(new CustomEvent('sofie:match:complete'));
  } catch (e) {
    setScreen(chrome('<h2 data-focus>We could not reach the shelves just now</h2><p class="sfm-lead">Please check your connection and try again — or ask a SOFIE beauty advisor.</p><div class="sfm-nav"><button type="button" class="button" data-act="retry">Try again</button>' + waLink([]) + '</div>', 100));
  }
}
function shadePicker(p) {
  const multi = p.s && p.s.length > 1;
  if (!multi) return '<input type="hidden" name="id" value="' + (p.s && p.s[0] ? p.s[0].id : '') + '">';
  const first = (p._shades || []).map(r => r.v);
  const ids = new Set(first.map(v => v.id));
  const rest = p.s.filter(v => v.a && !ids.has(v.id));
  const opt = v => '<option value="' + v.id + '">' + esc(shadeText(v.t)) + '</option>';
  return '<label class="sr-only" for="sfm-v-' + esc(p.h) + '">Shade</label><select id="sfm-v-' + esc(p.h) + '" name="id" class="sfm-select">' +
    (first.length ? '<optgroup label="Suggested for you">' + first.map(opt).join('') + '</optgroup><optgroup label="All shades">' + rest.map(opt).join('') + '</optgroup>' : p.s.filter(v => v.a).map(opt).join('')) + '</select>';
}
function card(p, a, hero) {
  const shades = (p._shades || []).slice(0, 3).map(r => '<span class="sfm-shade">' + esc(r.st || shadeText(r.v.t)) + '</span>').join('');
  const why = (p._why || []).map(w => '<li>' + esc(w) + '</li>').join('');
  return '<article class="sfm-card' + (hero ? ' is-hero' : '') + '"><a class="sfm-img" href="' + esc(p.u) + '"><img src="' + esc(imgW(p.i, hero ? 640 : 420)) + '" alt="' + esc(p.t) + '" loading="lazy" width="420" height="420" data-unify-img></a>' +
    '<div class="sfm-info"><span class="sfm-pct"><b>' + p._pct + '%</b> match</span>' + (p.n ? '<span class="sfm-now">SOFIE NOW</span>' : '') +
    '<p class="sfm-vendor">' + esc(p.v) + '</p><h3><a href="' + esc(p.u) + '">' + esc(p.t) + '</a></h3><p class="sfm-price">' + (p.q > p.p ? 'From ' : '') + money(p.p) + '</p>' +
    (why ? '<ul class="sfm-why">' + why + '</ul>' : '') + (shades ? '<p class="sfm-shades"><span>Shades to try first</span>' + shades + '</p>' : '') +
    '<form class="sfm-add" data-add>' + shadePicker(p) + '<button class="button" type="submit">Add to bag</button><a class="sfm-link" href="' + esc(p.u) + '">Details</a></form><p class="sfm-added" data-added hidden></p></div></article>';
}
function profileBar(a) {
  return '<div class="sfm-profile"><span class="sfm-eyebrow">Your profile</span><p>' + esc(summary(state.mode, state.a)) + '</p><div class="sfm-profile-actions"><button type="button" class="sfm-link" data-act="edit">Edit answers</button><button type="button" class="sfm-link" data-match-passport>' + esc(window.SofiePassport?.t('save_match') || 'Save match') + '</button><label class="sfm-fast"><input type="checkbox" data-fast-live' + (state.fast ? ' checked' : '') + '> SOFIE NOW first</label></div></div>';
}
function renderList(list, a) {
  if (!list.length) return '<h2 data-focus>No confident match in stock today</h2><p class="sfm-lead">Our team can match you personally — and tell you when your shade lands.</p><div class="sfm-nav">' + waLink([]) + '<button type="button" class="sfm-back" data-act="edit">Change answers</button></div>';
  const hero = list[0], rest = list.slice(1);
  return '<p class="sfm-eyebrow">Your matches</p><h2 data-focus>Hand-picked for you</h2>' + profileBar(a) +
    '<div class="sfm-results" aria-live="polite">' + card(hero, a, true) + '<div class="sfm-grid">' + rest.map(p => card(p, a, false)).join('') + '</div></div>' +
    '<div class="sfm-foot"><p>Matches are ranked from live stock using your answers, product details and what SOFIE clients love. Shade suggestions are a starting point — our advisors can confirm in store or on WhatsApp.</p><div class="sfm-nav">' + waLink(list) + '<button type="button" class="sfm-back" data-act="home">Start a new match</button></div></div>';
}
function renderRoutine(rows, a) {
  const all = [];
  const html = rows.map((r, i) => {
    if (!r.picks.length) return '';
    all.push(r.picks[0]);
    const alts = r.picks.slice(1).map(p => '<a href="' + esc(p.u) + '" class="sfm-alt"><img src="' + esc(imgW(p.i, 160)) + '" alt="" loading="lazy" width="56" height="56"><span><b>' + esc(p.v) + '</b> ' + esc(p.t) + '<em>' + money(p.p) + '</em></span></a>').join('');
    return '<section class="sfm-step"><div class="sfm-step-n"><span>' + (i + 1) + '</span>' + esc(r.step.name) + '</div>' + card(r.picks[0], a, false) + (alts ? '<div class="sfm-alts"><p>Also great</p>' + alts + '</div>' : '') + '</section>';
  }).join('');
  if (!all.length) return renderList([], a);
  const total = all.reduce((t, p) => t + p.p, 0);
  return '<p class="sfm-eyebrow">Your routine</p><h2 data-focus>Your ' + esc(JOURNEYS[state.mode].title.toLowerCase()) + ', step by step</h2>' + profileBar(a) +
    '<div class="sfm-routine">' + html + '</div><div class="sfm-total"><span>Complete routine</span><strong>' + money(total) + '</strong><button type="button" class="button" data-act="addall" data-ids="' + all.map(p => (p.s && p.s[0] ? p.s[0].id : '')).filter(Boolean).join(',') + '">Add the full routine</button></div>' +
    '<div class="sfm-foot"><div class="sfm-nav">' + waLink(all) + '<button type="button" class="sfm-back" data-act="home">Start a new match</button></div></div>';
}
function waLink(list) {
  if (!cfg.whatsapp) return '';
  const msg = 'Hi SOFIE! My Find My Match profile: ' + (state.mode ? summary(state.mode, state.a) : '') + (list.length ? '. My top picks: ' + list.slice(0, 3).map(p => p.v + ' ' + p.t).join('; ') : '') + '. Could you help me choose?';
  return '<a class="sfm-wa" href="https://wa.me/' + encodeURIComponent(cfg.whatsapp) + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Ask a SOFIE advisor ↗</a>';
}
async function addToBag(items, note) {
  const res = await fetch(cfg.cart || '/cart/add.js', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items: items.map(id => ({ id: Number(id), quantity: 1 })) }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.description || data.message || 'Could not add');
  await window.SofieJourney?.cartAdded(items);
  try { const c = await (await fetch(cfg.cartJs || '/cart.js', { headers: { Accept: 'application/json' } })).json(); document.querySelectorAll('[data-cart-count]').forEach(n => { n.textContent = c.item_count; }); } catch (e) {}
  if (note) { note.hidden = false; note.innerHTML = 'Added to your bag · <a href="' + esc(cfg.cartUrl || '/cart') + '">View bag</a>'; }
}

/* ---------------------------------------------------------------- events */
app.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'home') return home();
  if (act === 'own') return ownScreen();
  if (act === 'journey') { state.mode = b.dataset.v; state.step = 0; state.a = {}; return question(); }
  if (act === 'resume') { const s = store.get(LS_KEY, null); if (s && JOURNEYS[s.mode]) { state.mode = s.mode; state.a = s.a || {}; return results(); } return home(); }
  if (act === 'retry') return results();
  if (act === 'edit') { state.step = 0; return question(); }
  if (act === 'back') { if (state.step === 0) return home(); state.step -= 1; return question(); }
  if (act === 'next') { state.step += 1; return question(); }
  if (act === 'opt') {
    const st = visibleSteps()[state.step];
    if (st.type === 'multi') {
      const cur = (state.a[st.id] || []).slice();
      const i = cur.indexOf(b.dataset.v);
      if (i > -1) cur.splice(i, 1); else { if (st.max && cur.length >= st.max) cur.shift(); cur.push(b.dataset.v); }
      state.a[st.id] = cur;
      return question();
    }
    state.a[st.id] = b.dataset.v;
    if (st.id === 'budget') return question();
    state.step += 1;
    return question();
  }
  if (act === 'addall') {
    const ids = (b.dataset.ids || '').split(',').filter(Boolean);
    b.disabled = true; b.textContent = 'Adding…';
    addToBag(ids).then(() => { b.textContent = 'Routine added ✓'; }).catch(err => { b.disabled = false; b.textContent = err.message; });
  }
});
app.addEventListener('change', e => {
  if (e.target.matches('[data-fast]')) state.fast = e.target.checked;
  if (e.target.matches('[data-fast-live]')) { state.fast = e.target.checked; results(); }
});
app.addEventListener('submit', e => {
  const own = e.target.closest('[data-own]');
  if (own) {
    e.preventDefault();
    const text = own.querySelector('input').value.trim();
    if (!text) return;
    thinking();
    feeds(['foundation', 'lipstick', 'perfume']).then(list => {
      const brands = uniq(list.map(p => p.v)).sort((x, y) => y.length - x.length);
      const r = parseOwn(text, brands);
      state.mode = r.journey;
      state.a = Object.assign({ budget: 'any' }, r.a);
      if (r.journey === 'base') state.a = Object.assign({ skin: 'normal', finish: 'natural' }, state.a);
      if (r.journey === 'scent') state.a = Object.assign({ moment: 'day', intensity: 'noticeable' }, state.a);
      if (r.journey === 'lips') state.a = Object.assign({ lfinish: /gloss|oil/.test(text.toLowerCase()) ? 'glossy' : 'satin' }, state.a);
      results();
    }).catch(() => results());
    return;
  }
  const form = e.target.closest('[data-add]');
  if (!form) return;
  e.preventDefault();
  const id = (form.querySelector('[name=id]') || {}).value;
  const btn = form.querySelector('button[type=submit]');
  const note = form.parentElement.querySelector('[data-added]');
  if (!id) return;
  btn.disabled = true; const old = btn.textContent; btn.textContent = 'Adding…';
  addToBag([id], note).then(() => { btn.textContent = 'Added ✓'; setTimeout(() => { btn.disabled = false; btn.textContent = old; }, 2500); }).catch(err => { btn.disabled = false; btn.textContent = old; if (note) { note.hidden = false; note.textContent = err.message; } });
});

window.SofieMatch = {
  start(mode) {
    if (mode === 'resume') { const s = store.get(LS_KEY, null); if (s && JOURNEYS[s.mode]) { state.mode = s.mode; state.a = s.a || {}; return results(); } }
    if (mode && JOURNEYS[mode]) { state.mode = mode; state.step = 0; state.a = {}; return question(); }
    if (mode === 'own') return ownScreen();
    home();
  },
  summary
};
})();
