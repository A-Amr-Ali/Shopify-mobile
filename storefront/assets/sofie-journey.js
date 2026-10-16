(() => {
  'use strict';
  const configNode = document.getElementById('sf-journey-config');
  if (!configNode) return;
  const cfg = JSON.parse(configNode.textContent);
  const strings = Object.fromEntries(Object.entries(cfg.strings).map(([k,v]) => { const n = document.createElement('textarea'); n.innerHTML = v; return [k,n.value]; }));
  const t = key => strings[key] || key;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key,value) => { localStorage.setItem(key,JSON.stringify(value)); };
  const deviceKey = 'sofie-passport-v1';
  const handles = item => /^[a-z0-9-]{1,200}$/.test(item?.handle || '');
  const productURL = item => cfg.root + 'products/' + item.handle + (item.variantId && /^\d+$/.test(item.variantId) ? '?variant=' + item.variantId : '');
  const uuid = () => crypto.randomUUID();
  let sessionId;
  function session() {
    if (sessionId) return sessionId;
    try { sessionId = sessionStorage.getItem('sofie-growth-session') || uuid(); sessionStorage.setItem('sofie-growth-session',sessionId); }
    catch { sessionId = uuid(); }
    return sessionId;
  }
  const params = new URLSearchParams(location.search);
  function consent() {
    const choice = read('sofie-measurement-consent',null);
    return choice === true || (choice !== false && window.Shopify?.customerPrivacy?.analyticsProcessingAllowed?.() === true);
  }
  function setConsent(value) {
    try { write('sofie-measurement-consent',value === true); } catch {}
    if (value !== true) {
      sessionId = null;
      try { sessionStorage.removeItem('sofie-growth-session'); sessionStorage.removeItem('sofie-journey-context'); } catch {}
      fetch(cfg.root + 'cart/update.js',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({attributes:{sofie_campaign:'',sofie_content_id:'',sofie_match_session:''}})}).catch(()=>{});
    }
    document.dispatchEvent(new CustomEvent('sofie:measurement',{detail:{allowed:value === true}}));
    if (value === true) recordView();
  }
  function context() {
    let previous = {};
    try { previous = JSON.parse(sessionStorage.getItem('sofie-journey-context') || '{}'); } catch {}
    const value = { contentId:(params.get('utm_content') || previous.contentId || 'storefront').slice(0,100), source:(params.get('utm_source') || previous.source || 'direct').slice(0,30) };
    if (consent()) try { sessionStorage.setItem('sofie-journey-context',JSON.stringify(value)); } catch {}
    return value;
  }
  async function event(name, ids = []) {
    if (!consent()) return;
    try { await fetch(cfg.api + '/api/events',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,eventId:uuid(),sessionId:session(),event:name,...context(),variantIds:ids.map(String)})}); } catch {}
  }
  async function cartAdded(ids) {
    if (!consent()) return;
    try { await fetch(cfg.root + 'cart/update.js',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({attributes:{sofie_campaign:'sofie_knows_q4_2026',sofie_content_id:context().contentId,sofie_match_session:session()}})}); } catch {}
    await event('cart_add',ids);
  }
  function notify(message) {
    let node = document.querySelector('[data-passport-notice]');
    if (!node) { node = document.createElement('div'); node.className = 'sfjp-notice'; node.setAttribute('role','status'); node.dataset.passportNotice = ''; document.body.append(node); }
    node.textContent = message;
    clearTimeout(notify.timer); notify.timer = setTimeout(()=>node.remove(),5000);
  }
  const empty = () => ({preferences:{},routine:[],saved:[],match:null});
  async function load() {
    if (!cfg.loggedIn) return { passport:read(deviceKey,empty()), version:0 };
    const res = await fetch(cfg.proxy,{headers:{accept:'application/json'},cache:'no-store'});
    if (!res.ok) throw Error(t('load_error'));
    return res.json();
  }
  async function save(patch = {}, options = {}) {
    const current = await load();
    if (cfg.loggedIn && options.expectedVersion !== undefined && options.expectedVersion !== current.version) throw Error(t('conflict'));
    const existing = current.passport || empty();
    const passport = options.clear ? {} : {...empty(),...existing,...patch,preferences:{...existing.preferences,...patch.preferences}};
    if (!cfg.loggedIn) {
      write(deviceKey,passport);
      event('passport_save');
      return { passport,version:0 };
    }
    const res = await fetch(cfg.proxy,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({consent:true,expectedVersion:current.version || 0,passport,clear:options.clear === true})});
    if (!res.ok) throw Error(t(res.status === 409 ? 'conflict' : 'save_error'));
    const result = await res.json(); event('passport_save'); return result;
  }
  const areas = ['new_cairo','nasr_city','madinaty','giza','shorouk','obour','zayed','october','other'];
  function matchPreferences(match) {
    const a = match?.a || {};
    const skin = a.skin === 'combination' ? 'combo' : a.skin;
    return { ...(skin && ['unsure','normal','dry','oily','combo','sensitive'].includes(skin) ? {skin} : {}), ...(['natural','matte'].includes(a.finish) ? {finish:a.finish} : a.finish === 'dewy' ? {finish:'radiant'} : {}) };
  }
  function snapshotItem(item) {
    return {handle:item.handle,title:item.title || '',variantId:item.variantId ? String(item.variantId) : null,variantTitle:item.variantTitle || '',step:item.step || '',included:item.included !== false};
  }
  function favourites() {
    const items = read('sofie-favourites',[]);
    return Array.isArray(items) ? items.filter(handles).slice(0,100).map(snapshotItem) : [];
  }
  function selectedProduct() {
    const p = document.querySelector('[data-product]');
    if (!p) return null;
    const variants = JSON.parse(p.querySelector('[data-variants]')?.textContent || '[]');
    const v = variants.find(v => String(v.id) === p.querySelector('[data-variant-select]')?.value);
    return v ? {handle:p.dataset.handle,title:p.dataset.title,variantId:String(v.id),variantTitle:v.title} : null;
  }
  function options(name, values, value, first) {
    return `<label>${esc(t(name))}<select name="${name}">${first ? `<option value="">${esc(t(first))}</option>` : ''}${values.map(v=>`<option value="${v}" ${value === v ? 'selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label>`;
  }
  function render(data) {
    const host = document.querySelector('[data-passport-page]');
    if (!host) return;
    const passport = data.passport || empty(); const p = passport.preferences || {};
    const saved = (passport.saved || []).filter(handles); const routine = (passport.routine || []).filter(handles);
    host.innerHTML = `<div class="sfjp-top"><div><p class="eyebrow">SOFIE</p><h1>${esc(t('passport'))}</h1><p>${esc(t('intro'))}</p><p class="small">${esc(t(cfg.loggedIn ? 'account_note' : 'device_note'))}</p></div><nav aria-label="${esc(t('passport'))}"><a href="${cfg.root}pages/sofie-knows?resume=passport">${esc(t('knows'))} ↗</a><button type="button" data-match-open="${passport.match ? 'resume' : ''}">${esc(t(passport.match ? 'resume_match' : 'match'))} ↗</button><a href="${cfg.root}pages/my-rewards">${esc(t('rewards'))} ↗</a>${!cfg.loggedIn ? `<a href="${cfg.root}account/login?return_url=${encodeURIComponent(cfg.passportUrl)}">${esc(t('save_account'))} ↗</a>` : ''}</nav></div>
      <form data-passport-form class="sfjp-form"><h2>${esc(t('preferences'))}</h2><div class="sfjp-fields">${options('skin',['unsure','normal','dry','oily','combo','sensitive'],p.skin || 'unsure')}${options('finish',['natural','radiant','matte'],p.finish || 'natural')}<label>${esc(t('budget'))}<input name="budget" type="number" min="100" max="100000" step="any" inputmode="decimal" value="${esc(p.budget ?? '')}" placeholder="${esc(t('no_budget'))}"></label>${options('area',areas,p.area,'choose_area')}</div><label class="sfjp-check"><input type="checkbox" name="includeSaved">${esc(t('save_hearts'))}</label><button class="button" type="submit">${esc(t(cfg.loggedIn ? 'save_account' : 'save_device'))}</button><p role="status" data-passport-status></p></form>
      <div class="sfjp-columns"><section><h2>${esc(t('routine'))}</h2>${routine.length ? `<ul>${routine.map(item=>`<li><a href="${esc(productURL(item))}">${esc(item.title)}${item.variantTitle ? ' · ' + esc(item.variantTitle) : ''}</a>${item.included === false ? ' · ' + esc(t('remove')) : ''}</li>`).join('')}</ul><a class="button button-outline" href="${cfg.root}pages/sofie-knows?resume=passport">${esc(t('edit_routine'))} ↗</a>` : `<p>${esc(t('no_saved'))}</p><a class="underlined" href="${cfg.root}pages/sofie-knows?resume=passport">${esc(t('knows'))} ↗</a>`}</section><section><h2>${esc(t('saved_products'))}</h2>${saved.length ? `<ul>${saved.map(item=>`<li><a href="${esc(productURL(item))}">${esc(item.title || item.handle)}${item.variantTitle ? ' · ' + esc(item.variantTitle) : ''}</a><button type="button" aria-label="${esc(t('remove_saved'))}: ${esc(item.title)}" data-passport-remove="${esc(item.handle)}" data-passport-variant="${esc(item.variantId || '')}">×</button></li>`).join('')}</ul>` : `<p>${esc(t('no_saved'))}</p>`}</section></div>
      ${data.beautyProfile ? `<section class="sfjp-profile"><h2>${esc(t('existing_profile'))}</h2><p>${esc(t('profile_from_rewards'))}</p><p>${[data.beautyProfile.skin_type,data.beautyProfile.undertone,data.beautyProfile.foundation_brand,data.beautyProfile.foundation_shade].filter(Boolean).map(esc).join(' · ')}</p><a class="underlined" href="${cfg.root}pages/my-rewards">${esc(t('update_profile'))} ↗</a></section>` : ''}
      <section class="sfjp-discovery"><h2>${esc(t('discovery'))}</h2><p>${esc(t('discovery_text'))}</p><a class="button button-outline" data-discovery-link href="${cfg.root}collections/mini-size">${esc(t('shop_minis'))} ↗</a> <a class="underlined" href="https://wa.me/201007488707" target="_blank" rel="noopener">${esc(t('ask_team'))} ↗</a></section>
      <section id="measurement" class="sfjp-privacy"><h2>${esc(t('privacy'))}</h2><label class="sfjp-check"><input type="checkbox" data-journey-consent ${consent() ? 'checked' : ''}>${esc(t('measure'))}</label><p class="small">${esc(t('measure_note'))}</p></section><div class="sfjp-actions"><button type="button" data-passport-reload>${esc(t('reload'))}</button><button type="button" data-passport-clear>${esc(t('clear'))}</button></div>`;
    if (passport.match) try { write('sofie-match',passport.match); } catch {}
    host.querySelector('[data-passport-form]').addEventListener('submit', async e => {
      e.preventDefault(); const button = e.target.querySelector('[type=submit]'); const status = host.querySelector('[data-passport-status]');
      const form = new FormData(e.target); button.disabled = true; status.textContent = t('saving');
      try {
        const preferences = {skin:form.get('skin'),finish:form.get('finish'),area:form.get('area'),budget:form.get('budget') === '' ? null : Number(form.get('budget'))};
        const allSaved = [...new Map([...saved,...favourites()].map(x=>[x.handle+'|'+(x.variantId || ''),x])).values()];
        const next = await save({preferences,...(form.get('includeSaved') ? {saved:allSaved} : {})},{expectedVersion:data.version});
        if (preferences.area) { write('sofie-area',preferences.area); window.dispatchEvent(new StorageEvent('storage',{key:'sofie-area'})); }
        render({...data,...next}); notify(t('saved'));
      } catch(error) { status.textContent = error.message; button.disabled = false; }
    });
    host.querySelector('[data-journey-consent]').addEventListener('change',e=>setConsent(e.target.checked));
    host.querySelector('[data-passport-reload]').addEventListener('click',boot);
    host.querySelector('[data-passport-clear]').addEventListener('click',async e => {
      if (!confirm(t('clear_confirm'))) return;
      e.target.disabled = true;
      try { const next = await save({}, {clear:true,expectedVersion:data.version}); render({...data,...next}); notify(t('cleared')); } catch(error) { notify(error.message); e.target.disabled=false; }
    });
    host.querySelectorAll('[data-passport-remove]').forEach(button=>button.addEventListener('click',async()=>{
      button.disabled = true;
      try { const next = await save({saved:saved.filter(x=>!(x.handle === button.dataset.passportRemove && String(x.variantId || '') === button.dataset.passportVariant))},{expectedVersion:data.version});render({...data,...next}); } catch(error) { notify(error.message); button.disabled=false; }
    }));
  }
  async function boot() {
    const host = document.querySelector('[data-passport-page]'); if (!host) return;
    host.textContent = t('loading');
    try { render(await load()); } catch(error) { host.replaceChildren(); const p=document.createElement('p');p.textContent=error.message;const button=document.createElement('button');button.className='button';button.textContent=t('retry');button.addEventListener('click',boot);host.append(p,button); }
  }
  window.SofieJourney = {event,cartAdded,consent,setConsent,t,config:cfg};
  window.SofiePassport = {load,save,t,snapshotItem,saveMatch:async()=>{ const match=read('sofie-match',null);if(!match?.mode)throw Error(t('save_error'));return save({match,preferences:matchPreferences(match)}); }};
  document.addEventListener('click',async e=>{
    const productButton=e.target.closest('[data-passport-product]'); const matchButton=e.target.closest('[data-match-passport]');
    if (productButton || matchButton) {
      const button=productButton || matchButton;button.disabled=true;
      try { if (matchButton) await window.SofiePassport.saveMatch(); else { const item=selectedProduct();if(!item)throw Error(t('save_error'));const current=await load();const saved=(current.passport?.saved || []).filter(x=>!(x.handle === item.handle && x.variantId === item.variantId));await save({saved:[...saved,item]},{expectedVersion:current.version}); }notify(t('saved')); }
      catch(error){notify(error.message);} finally{button.disabled=false;} return;
    }
    if (e.target.closest('[data-match-open]')) event('match_start');
    if (e.target.closest('[data-discovery-link]')) event('discovery_view');
    const productLink=e.target.closest('.sf-card a[href*="/products/"],.sfjp-columns a[href*="/products/"]');
    if(productLink)event('product_click');
    const heart=e.target.closest('[data-save]');
    if(heart){const item=selectedProduct();if(item && item.handle===heart.dataset.save)try{const saved=read('sofie-favourites',[]);write('sofie-favourites',saved.map(x=>x.handle===item.handle?{...x,...item}:x));}catch{}}
  });
  document.addEventListener('sofie:journey:cart-added',e=>cartAdded(e.detail?.variantIds || []));
  document.addEventListener('sofie:match:complete',()=>event('match_complete'));
  document.addEventListener('submit',e=>{if(e.target.querySelector('[name=checkout]') && (e.submitter?.name === 'checkout' || e.target.matches('[data-cart-form]')))event('checkout_start');},true);
  let viewRecorded = false;
  function recordView() {
    if (viewRecorded || !consent()) return;
    viewRecorded = true;
    if(document.body.dataset.page === 'cart')event('cart_view');
    else if(document.querySelector('[data-product]'))event('product_view',[document.querySelector('[data-variant-select]')?.value].filter(Boolean));
    else event('journey_view');
  }
  document.addEventListener('visitorConsentCollected',recordView);
  window.Shopify?.loadFeatures?.([{name:'consent-tracking-api',version:'0.1'}],error=>{if(!error)recordView();});
  recordView();
  boot();
})();
