(() => {
  'use strict';
  const root = document.querySelector('[data-hair-studio]');
  if (!root || root.dataset.initialised) return;
  root.dataset.initialised = 'true';
  const cfg = JSON.parse(root.querySelector('[data-hair-config]').textContent);
  const core = window.SofieHairCore;
  const app = root.querySelector('[data-hair-app]');
  const t = key => cfg.strings[key] || key;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = cents => new Intl.NumberFormat(cfg.locale || 'en', {style:'currency',currency:cfg.currency,maximumFractionDigits:0}).format(Number(cents) / 100);
  const productURL = (p, v) => cfg.root + 'products/' + encodeURIComponent(p.handle) + '?variant=' + encodeURIComponent(v.id);
  const key = 'sofie-hair-profile-v1';
  const steps = [
    {id:'texture',opts:['straight','wavy','curly','coily','unsure']},
    {id:'strand',opts:['fine','medium','coarse','unsure']},
    {id:'scalp',opts:['balanced','oily','dry','sensitive','seek_help']},
    {id:'concerns',opts:['dryness','frizz','damage','curls','volume','buildup','shine','tone'],multi:true},
    {id:'colour',opts:['natural','coloured','lightened']},
    {id:'heat',opts:['never','sometimes','often']},
    {id:'budget',opts:['300000','500000','800000','0']},
    {id:'speed',opts:['all','now']}
  ];
  const state = {step:0,answers:{concerns:[]},products:null,groups:[],selected:{},variants:{},included:{},busy:false};
  let catalogPromise;
  function focus() { app.querySelector('[data-focus]')?.focus({preventScroll:true}); }
  function announce(message, error = false) {
    const node = app.querySelector('[data-hair-status]');
    if (node) { node.textContent = message; node.dataset.error = String(error); }
  }
  function track(name, ids = []) { window.SofieJourney?.event?.(name, ids); }
  function readSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value?.version !== 1 || !value.answers || typeof value.answers !== 'object') return null;
      const answers = {};
      for (const step of steps) {
        const v = value.answers[step.id];
        if (step.multi) {
          if (!Array.isArray(v) || v.length < 1 || v.length > 2 || v.some(x => !step.opts.includes(x))) return null;
          answers[step.id] = v;
        } else {
          if (!step.opts.includes(v)) return null;
          answers[step.id] = v;
        }
      }
      return answers;
    } catch { return null; }
  }
  function label(step, value) {
    if (step === 'budget') return value === '0' ? t('budget_any') : t('up_to') + ' ' + money(value);
    return t(step + '_' + value);
  }
  const art = texture => {
    const path = {straight:'M20 5v70M40 5v70M60 5v70',wavy:'M20 5c-22 20 22 40 0 70M40 5c-22 20 22 40 0 70M60 5c-22 20 22 40 0 70',curly:'M23 5c-32 10 28 20 0 30s28 20 0 40M53 5c-32 10 28 20 0 30s28 20 0 40',coily:'M20 5l16 10-16 10 16 10-16 10 16 10-16 10 16 10M47 5l16 10-16 10 16 10-16 10 16 10-16 10 16 10'}[texture];
    return path ? `<svg class="sfhair-texture" viewBox="0 0 80 80" aria-hidden="true"><path d="${path}"/></svg>` : '<span class="sfhair-symbol" aria-hidden="true">?</span>';
  };
  function intro() {
    const saved = readSaved();
    app.innerHTML = `<div class="sfhair-intro"><div><p class="sfhair-kicker">${esc(t('kicker'))}</p><h1 tabindex="-1" data-focus>${esc(t('title'))}</h1><p class="sfhair-lead">${esc(t('intro'))}</p><div class="sfhair-actions"><button type="button" class="sfhair-primary" data-act="start">${esc(t('start'))} <span aria-hidden="true">↗</span></button>${saved ? `<button type="button" class="sfhair-secondary" data-act="resume">${esc(t('resume'))}</button>` : ''}</div><p class="sfhair-small">${esc(t('time'))} · ${esc(t('no_email'))}</p></div><div class="sfhair-art" aria-hidden="true"><span class="sfhair-art-word">HAIR</span><div>${['straight','wavy','curly','coily'].map(art).join('')}</div><span class="sfhair-art-bottom">${esc(t('art_note'))}</span></div></div><div class="sfhair-promises"><p><b>01</b>${esc(t('promise_profile'))}</p><p><b>02</b>${esc(t('promise_match'))}</p><p><b>03</b>${esc(t('promise_routine'))}</p></div><p class="sfhair-small">${esc(t('cosmetic_note'))}</p>${saved ? `<button type="button" class="sfhair-link" data-act="clear">${esc(t('clear_saved'))}</button>` : ''}`;
  }
  function optionsFor(step) {
    return step.id === 'concerns' ? step.opts.filter(x => x !== 'curls' || ['wavy','curly','coily','unsure'].includes(state.answers.texture)) : step.opts;
  }
  function question() {
    const step = steps[state.step];
    if (step.multi) state.answers[step.id] = state.answers[step.id].filter(x => optionsFor(step).includes(x));
    const selected = state.answers[step.id];
    app.innerHTML = `<div class="sfhair-progress"><span>${esc(t('question'))} ${state.step + 1} / ${steps.length}</span><span>${esc(t('time'))}</span><progress value="${state.step + 1}" max="${steps.length}" aria-label="${esc(t('progress'))}"></progress></div><form data-hair-question><fieldset><legend tabindex="-1" data-focus>${esc(t('q_' + step.id))}</legend><p class="sfhair-lead" id="sfhair-help">${esc(t('help_' + step.id))}</p><div class="sfhair-options ${step.id === 'texture' ? 'sfhair-options-texture' : ''}">${optionsFor(step).map(value => {
      const checked = step.multi ? selected?.includes(value) : selected === value;
      const disabled = step.multi && selected?.length >= 2 && !checked;
      return `<label class="sfhair-option ${checked ? 'is-chosen' : ''}"><input type="${step.multi ? 'checkbox' : 'radio'}" name="${step.id}" value="${value}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-describedby="sfhair-help">${step.id === 'texture' ? art(value) : ''}<span>${esc(label(step.id,value))}</span><i aria-hidden="true">${checked ? '✓' : '+'}</i></label>`;
    }).join('')}</div></fieldset><p class="sfhair-status" data-hair-status role="status" aria-live="polite"></p><div class="sfhair-nav"><button type="button" class="sfhair-link" data-act="back">← ${esc(t('back'))}</button><button type="submit" class="sfhair-primary">${esc(t(state.step === steps.length - 1 ? 'results_button' : 'next'))} <span aria-hidden="true">→</span></button></div></form>`;
    focus();
  }
  async function catalog() {
    if (catalogPromise) return catalogPromise;
    catalogPromise = (async () => {
      const map = new Map();
      let page = 1;
      while (page) {
        const url = new URL(cfg.feed, location.origin);
        url.searchParams.set('view','sf-hair-feed');
        url.searchParams.set('page',String(page));
        url.searchParams.set('sort_by','best-selling');
        if (cfg.previewTheme) url.searchParams.set('preview_theme_id',String(cfg.previewTheme));
        const response = await fetch(url, {cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000)});
        if (!response.ok) throw Error('catalog');
        const data = await response.json();
        if (data.version !== 1 || !Array.isArray(data.products)) throw Error('catalog');
        for (const p of data.products) if (typeof p.handle === 'string' && p.handle.length <= 200 && !/[/?#\\]/.test(p.handle) && Array.isArray(p.variants)) map.set(String(p.id),p);
        const next = Number(data.nextPage) || 0;
        if (next && (next !== page + 1 || next > 30)) throw Error('pagination');
        page = next;
      }
      return [...map.values()];
    })();
    try { return await catalogPromise; } catch (error) { catalogPromise = null; throw error; }
  }
  function selected(group) {
    const p = group.picks.find(p => String(p.id) === state.selected[group.category]) || group.picks[0];
    if (!p) return null;
    const v = p.eligible.find(v => String(v.id) === state.variants[group.category]) || p.variant;
    return {p,v,category:group.category,included:state.included[group.category] !== false};
  }
  function choices() {
    const all = state.groups.map(selected).filter(Boolean);
    const repair = all.find(x => x.category === 'repair' && x.included);
    return all.filter(x => !repair?.p.k18 || x.category !== 'condition').sort((a,b) => {
      const order = x => x.p.no3 ? -1 : ({cleanse:0,repair:1,condition:2,style:3})[x.category];
      return order(a) - order(b);
    });
  }
  function card(group, item, index) {
    const {p,v,category,included} = item;
    const how = p.k18 ? 'use_k18' : p.no3 ? 'use_no3' : 'use_' + category;
    return `<article class="sfhair-card ${included ? '' : 'is-excluded'}" data-hair-card="${category}"><div class="sfhair-card-step"><span>${String(index + 1).padStart(2,'0')}</span><h3>${esc(t('step_' + (p.no3 ? 'prewash' : p.k18 ? 'repair' : category)))}</h3><label class="sfhair-include"><input type="checkbox" data-include="${category}" ${included ? 'checked' : ''}>${esc(t('include'))}</label></div><div class="sfhair-card-main"><a href="${esc(productURL(p,v))}" data-product-link>${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.title)}" width="260" height="300" loading="lazy">` : `<span class="sfhair-no-image">${esc(p.vendor)}</span>`}</a><div><p class="sfhair-kicker">${esc(p.vendor)}</p><h4><a href="${esc(productURL(p,v))}" data-product-link>${esc(p.title)}</a></h4><ul class="sfhair-reasons">${p.reasons.map(r => `<li>${esc(t(r))}</li>`).join('')}</ul><p class="sfhair-use">${esc(t(how))}</p><label class="sfhair-select">${esc(t('size'))}<select data-variant="${category}">${p.eligible.map(x => `<option value="${x.id}" ${String(v.id) === String(x.id) ? 'selected' : ''}>${esc(x.title)} · ${esc(money(x.price))}</option>`).join('')}</select></label><div class="sfhair-price"><strong>${esc(money(v.price))}</strong><span class="${v.ready ? 'sfhair-now' : ''}">${esc(t(v.ready ? 'now_eligible' : 'standard_delivery'))}</span></div><p class="sfhair-small">${esc(t(v.ready ? 'now_note' : 'standard_note'))}</p><a class="sfhair-link" href="${esc(productURL(p,v))}" data-product-link>${esc(t('view_product'))} ↗</a>${group.picks.length > 1 ? `<details class="sfhair-alternatives"><summary>${esc(t('alternatives'))}</summary><label class="sfhair-select">${esc(t('choose_product'))}<select data-alternative="${category}">${group.picks.map(x => `<option value="${x.id}" ${String(p.id) === String(x.id) ? 'selected' : ''}>${esc(x.title)} · ${esc(money(x.variant.price))}</option>`).join('')}</select></label></details>` : ''}</div></div></article>`;
  }
  function results() {
    const a = state.answers;
    const list = choices();
    const included = list.filter(x => x.included);
    const total = included.reduce((sum,x) => sum + Number(x.v.price),0);
    const missing = state.groups.filter(g => !g.picks.length);
    const repair = included.find(x => x.p.k18);
    app.innerHTML = `<div class="sfhair-result-head"><div><p class="sfhair-kicker">${esc(t('your_profile'))}</p><h1 tabindex="-1" data-focus>${esc(t('result_title'))}</h1><p class="sfhair-lead">${esc(t('profile_note'))}</p><div class="sfhair-profile">${['texture','strand','scalp'].map(k => `<span>${esc(t('profile_' + k))}: <b>${esc(label(k,a[k]))}</b></span>`).join('')}<span>${a.concerns.map(x => esc(label('concerns',x))).join(' + ')}</span></div><p class="sfhair-small">${esc(t('budget_per_product'))}: ${esc(label('budget',a.budget))} · ${esc(label('speed',a.speed))}</p></div><button type="button" class="sfhair-secondary" data-act="edit">${esc(t('edit'))}</button></div>${a.concerns.includes('tone') && a.colour !== 'lightened' ? `<p class="sfhair-note">${esc(t('tone_note'))}</p>` : ''}${a.scalp === 'sensitive' ? `<p class="sfhair-note">${esc(t('sensitive_note'))}</p>` : ''}${repair ? `<p class="sfhair-note">${esc(t('k18_note'))}</p>` : ''}<div class="sfhair-result-grid"><div>${list.map((item,index) => card(state.groups.find(g => g.category === item.category),item,index)).join('')}${missing.length ? `<div class="sfhair-empty"><h3>${esc(t('no_exact'))}</h3><p>${esc(t('missing_note'))}</p><p>${missing.map(x => esc(t('step_' + x.category))).join(' · ')}</p><button type="button" class="sfhair-secondary" data-act="edit">${esc(t('adjust'))}</button> <a class="sfhair-link" href="${esc(cfg.feed)}">${esc(t('browse'))} ↗</a></div>` : ''}</div><aside class="sfhair-summary"><p class="sfhair-kicker">${esc(t('your_edit'))}</p><h2>${included.length} ${esc(t('products_selected'))}</h2><p class="sfhair-total">${esc(money(total))}</p><p class="sfhair-small">${esc(t('total_note'))}</p><button type="button" class="sfhair-link" data-act="refresh">${esc(t('refresh'))}</button><button type="button" class="sfhair-primary" data-act="add" ${included.length ? '' : 'disabled'}>${esc(t('add_routine'))} +</button><a class="sfhair-link" href="${esc(cfg.root)}cart">${esc(t('view_bag'))} ↗</a><button type="button" class="sfhair-secondary" data-act="save">${esc(t('save_device'))}</button><p class="sfhair-small">${esc(t('device_note'))}</p>${window.SofiePassport && included.length ? `<button type="button" class="sfhair-link" data-act="passport">${esc(t('save_passport'))} ↗</button>` : ''}<p data-hair-status class="sfhair-status" role="status" aria-live="polite"></p><a class="sfhair-link" href="${esc(cfg.root)}pages/beauty-passport">${esc(t('open_passport'))} ↗</a><details><summary>${esc(t('how_matched'))}</summary><p class="sfhair-small">${esc(t('matching_note'))}</p></details><p class="sfhair-small">${esc(t('cosmetic_note'))}</p></aside></div>`;
  }
  function support() {
    app.innerHTML = `<div class="sfhair-support"><p class="sfhair-kicker">${esc(t('care_first'))}</p><h1 tabindex="-1" data-focus>${esc(t('support_title'))}</h1><p class="sfhair-lead">${esc(t('support_note'))}</p><a class="sfhair-link" href="https://www.aad.org/public/diseases/hair-loss/treatment/diagnosis-treat" target="_blank" rel="noopener">${esc(t('read_guidance'))} ↗</a><div class="sfhair-actions"><button class="sfhair-secondary" type="button" data-act="edit">${esc(t('edit'))}</button></div></div>`;
    focus();
  }
  async function showResults() {
    if (state.answers.scalp === 'seek_help') return support();
    app.innerHTML = `<div class="sfhair-loading" role="status"><span class="sfhair-spinner" aria-hidden="true"></span><h2>${esc(t('loading'))}</h2><p>${esc(t('loading_note'))}</p></div>`;
    try {
      state.products = await catalog();
      state.groups = core.routine(state.products,state.answers);
      state.selected = {}; state.variants = {}; state.included = {};
      results(); focus(); track('match_complete');
    } catch (error) {
      root.dataset.hairError = error.message;
      app.innerHTML = `<div class="sfhair-empty"><h2 tabindex="-1" data-focus>${esc(t('load_error'))}</h2><p>${esc(t('load_error_note'))}</p><button type="button" class="sfhair-primary" data-act="retry">${esc(t('retry'))}</button> <a class="sfhair-link" href="${esc(cfg.feed)}">${esc(t('browse'))} ↗</a></div>`;
      focus();
    }
  }
  async function addRoutine() {
    const list = choices().filter(x => x.included);
    if (!list.length || state.busy) return;
    state.busy = true;
    const button = app.querySelector('[data-act="add"]');
    button.disabled = true; announce(t('checking'));
    try {
      for (const {p,v} of list) {
        const response = await fetch(cfg.root + 'products/' + encodeURIComponent(p.handle) + '.js', {cache:'no-store',signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw Error(t('availability_changed'));
        const current = await response.json();
        const variant = current.variants?.find(x => String(x.id) === String(v.id));
        if (!variant?.available || Number(variant.price) !== Number(v.price)) throw Error(t('availability_changed'));
      }
      const response = await fetch(cfg.root + 'cart/add.js', {method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items:list.map(({v}) => ({id:v.id,quantity:1}))})});
      const data = await response.json();
      if (!response.ok) throw Error(data.description || t('add_error'));
      announce(t('added'));
      button.textContent = t('added_button');
      document.dispatchEvent(new CustomEvent('sofie:journey:cart-added',{detail:{variantIds:list.map(x => String(x.v.id))}}));
      const cartResponse = await fetch(cfg.root + 'cart.js',{cache:'no-store'}).catch(() => null);
      if (cartResponse?.ok) { const cart = await cartResponse.json(); document.querySelectorAll('[data-cart-count]').forEach(n => { n.textContent = cart.items.filter(i => i.handle !== 'sofie-now-express-delivery').reduce((sum,i) => sum + i.quantity,0); }); }
    } catch (error) { announce(error.message || t('add_error'),true); button.disabled = false; }
    finally { state.busy = false; }
  }
  async function savePassport(button) {
    button.disabled = true;
    try {
      const current = await window.SofiePassport.load();
      const saved = new Map((current.passport?.saved || []).map(x => [x.handle + '|' + (x.variantId || ''),x]));
      choices().filter(x => x.included).forEach(({p,v,category}) => saved.set(p.handle + '|' + v.id,{handle:p.handle,title:p.title,variantId:String(v.id),variantTitle:v.title,step:category,included:true}));
      if (saved.size > 100) throw Error(t('passport_limit'));
      await window.SofiePassport.save({saved:[...saved.values()]},{expectedVersion:current.version});
      announce(t(window.SofieJourney?.config?.loggedIn ? 'passport_saved_account' : 'passport_saved_device'));
    } catch { announce(t('passport_error'),true); }
    finally { button.disabled = false; }
  }
  app.addEventListener('submit',e => {
    if (!e.target.matches('[data-hair-question]')) return;
    e.preventDefault();
    const step = steps[state.step];
    const form = new FormData(e.target);
    const value = step.multi ? state.answers[step.id] : form.get(step.id);
    if (step.multi ? !value.length || value.length > 2 : !step.opts.includes(value)) return announce(t('choose_answer'),true);
    state.answers[step.id] = value;
    if (step.id === 'scalp' && value === 'seek_help') return support();
    if (state.step < steps.length - 1) { state.step++; question(); } else showResults();
  });
  app.addEventListener('change',e => {
    const node = e.target;
    if (node.name === 'concerns') {
      state.answers.concerns = node.checked ? [...state.answers.concerns.filter(x => x !== node.value),node.value] : state.answers.concerns.filter(x => x !== node.value);
      app.querySelectorAll('[name="concerns"]').forEach(input => { input.disabled = state.answers.concerns.length >= 2 && !input.checked; input.closest('label').classList.toggle('is-chosen',input.checked); input.closest('label').querySelector('i').textContent = input.checked ? '✓' : '+'; });
    } else if (node.matches('[data-hair-question] input[type="radio"]')) {
      app.querySelectorAll('input[type="radio"]').forEach(input => { input.closest('label').classList.toggle('is-chosen',input.checked); input.closest('label').querySelector('i').textContent = input.checked ? '✓' : '+'; });
    }
    if (node.dataset.variant) { state.variants[node.dataset.variant] = node.value; results(); app.querySelector(`[data-variant="${node.dataset.variant}"]`)?.focus(); }
    if (node.dataset.alternative) { state.selected[node.dataset.alternative] = node.value; delete state.variants[node.dataset.alternative]; results(); const target = app.querySelector(`[data-alternative="${node.dataset.alternative}"]`); if (target) { target.closest('details').open = true; target.focus(); } }
    if (node.dataset.include) { state.included[node.dataset.include] = node.checked; results(); app.querySelector(`[data-include="${node.dataset.include}"]`)?.focus(); }
  });
  app.addEventListener('click',e => {
    if (e.target.closest('[data-product-link]')) track('product_click');
    const button = e.target.closest('[data-act]');
    if (!button) return;
    const act = button.dataset.act;
    if (act === 'start') { state.step = 0; state.answers = {concerns:[]}; question(); track('match_start'); }
    if (act === 'resume') { const saved = readSaved(); if (saved) { state.answers = saved; showResults(); } }
    if (act === 'back') { if (state.step) { state.step--; question(); } else intro(); }
    if (act === 'edit') { state.step = 0; question(); }
    if (act === 'retry') showResults();
    if (act === 'refresh') { catalogPromise = null; showResults(); }
    if (act === 'add') addRoutine();
    if (act === 'passport') savePassport(button);
    if (act === 'save') { try { localStorage.setItem(key,JSON.stringify({version:1,answers:state.answers,savedAt:new Date().toISOString()})); announce(t('device_saved')); } catch { announce(t('device_error'),true); } }
    if (act === 'clear') { try { localStorage.removeItem(key); intro(); } catch {} }
  });
  intro();
})();
