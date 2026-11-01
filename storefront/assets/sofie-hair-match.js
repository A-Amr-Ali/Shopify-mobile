(() => {
  'use strict';
  const root=document.querySelector('[data-hair-match]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready='true';
  const cfg=JSON.parse(root.querySelector('[data-hair-config]').textContent);
  const app=root.querySelector('[data-hair-app]');
  const E=window.SofieHairEngine;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t=k=>cfg.strings[k] || k;
  const money=c=>new Intl.NumberFormat(cfg.locale || 'en',{style:'currency',currency:cfg.currency || 'EGP',maximumFractionDigits:2}).format(c/100);
  const key='sofie-hair-profile-v1';
  let state={answers:{},step:0,result:null,selected:{},nowOnly:false};
  let catalog=null;
  let pending=null;
  let busy=false;
  let generation=0;
  const questions=[
    {id:'pattern',opts:['straight','wavy','curly','coily','unsure']},
    {id:'strand',opts:['fine','medium','thick','unsure']},
    {id:'scalp',opts:['balanced','oily','dry','sensitive','flakes','pain']},
    {id:'colour',opts:['natural','colour','blonde','grey','chemical']},
    {id:'concerns',multi:true,opts:['dryness','frizz','damage','volume','curls','colour','brass','buildup','shedding','sudden_loss','maintain']},
    {id:'heat',opts:['never','sometimes','often']},
    {id:'wash',opts:['daily','few_days','weekly']},
    {id:'size',opts:['essential','complete']},
    {id:'budget',optional:true,opts:['any','300000','500000','800000']}
  ];
  function localProfile() {
    try {
      const p=JSON.parse(localStorage.getItem(key));
      if (p?.version !== 1 || !p.answers || typeof p.answers !== 'object') return null;
      if (!questions.every(q=>q.optional || (q.multi ? Array.isArray(p.answers[q.id]) && p.answers[q.id].length && p.answers[q.id].every(v=>q.opts.includes(v)) : q.opts.includes(p.answers[q.id])))) return null;
      return p;
    } catch { return null; }
  }
  function url(path) {
    const u=new URL(path,location.origin);
    const preview=cfg.previewThemeId || new URLSearchParams(location.search).get('preview_theme_id');
    if (preview) u.searchParams.set('preview_theme_id',preview);
    return u.pathname+u.search;
  }
  function productUrl(p,v) { return url(cfg.root+'products/'+encodeURIComponent(p.handle)+'?variant='+encodeURIComponent(v.id)); }
  async function fetchCatalog(force=false) {
    if (!force && catalog) return catalog;
    if (!force && pending) return pending;
    const task=(async()=>{
      let next=url(cfg.collection+'?view=sfhair&sort_by=best-selling');
      const seen=new Set(); const found=new Map();
      while (next) {
        if (seen.has(next) || seen.size >= 50) throw Error(t('load_error'));
        seen.add(next);
        const r=await fetch(next,{credentials:'same-origin',cache:'no-store',headers:{Accept:'text/html'}});
        if (!r.ok) throw Error(t('load_error'));
        const text=await r.text();
        let data; try { data=JSON.parse(text.trim()); } catch { throw Error(t('load_error')); }
        if (!Array.isArray(data.products) || data.version !== 1) throw Error(t('load_error'));
        data.products.forEach(p=>{if (p.handle && Array.isArray(p.variants)) found.set(p.handle,p);});
        if (data.next) {
          const n=new URL(data.next,location.origin);
          if (n.origin !== location.origin || n.pathname !== new URL(cfg.collection,location.origin).pathname) throw Error(t('load_error'));
          n.searchParams.set('view','sfhair');
          n.searchParams.set('sort_by','best-selling');
          next=url(n.pathname+n.search);
        } else next=null;
      }
      catalog=[...found.values()];
      return catalog;
    })();
    pending=task;
    try { return await task; } finally { if (pending===task) pending=null; }
  }
  function focus() { const el=app.querySelector('[data-focus]'); if(el){el.tabIndex=-1;el.focus({preventScroll:true});} }
  function draw(html) { app.innerHTML=html; focus(); }
  function buttons() { return '<button type="button" class="sfhair-link" data-hair-act="home">'+esc(t('restart'))+'</button>'; }
  function start() {
    generation++;
    root.classList.remove('is-active');
    const saved=localProfile();
    draw('<div class="sfhair-start"><div class="sfhair-start-copy"><p class="sfhair-kicker">'+esc(t('start_kicker'))+'</p><h2 data-focus>'+esc(t('start_heading'))+'</h2><p>'+esc(t('start_copy'))+'</p><button type="button" class="sfhair-button" data-hair-act="begin">'+esc(t('start_button'))+' <span aria-hidden="true">↗</span></button><p class="sfhair-small">'+esc(t('start_note'))+'</p>'+(saved?'<button type="button" class="sfhair-link" data-hair-act="resume">'+esc(t('resume'))+'</button> · <button type="button" class="sfhair-link" data-hair-act="forget">'+esc(t('forget'))+'</button>':'')+'</div><div class="sfhair-art" aria-hidden="true"><svg viewBox="0 0 400 380" fill="none"><path d="M80 342C30 200 160 30 210 44c95 23-100 240-50 294M122 344C70 210 223 40 251 69c68 70-94 202-51 278M242 347C189 228 332 151 291 91M281 348c-43-100 68-160 45-205"/><path d="M69 341h264"/></svg><span>'+esc(t('art_caption'))+'</span></div></div><div class="sfhair-promises"><span>01 <b>'+esc(t('promise_1'))+'</b></span><span>02 <b>'+esc(t('promise_2'))+'</b></span><span>03 <b>'+esc(t('promise_3'))+'</b></span></div>');
  }
  function optionLabel(q,v) {
    if(q.id==='budget' && v!=='any') return t('up_to')+' '+money(Number(v));
    return t('o_'+q.id+'_'+v);
  }
  function options(q) { return q.opts.filter(v=>v!=='brass' || ['blonde','grey'].includes(state.answers.colour)).filter(v=>v!=='curls' || ['wavy','curly','coily','unsure'].includes(state.answers.pattern)); }
  function question() {
    root.classList.add('is-active');
    const q=questions[state.step];
    const answer=state.answers[q.id];
    const valid=q.optional || (q.multi ? answer?.length>0 : !!answer);
    const opts=options(q).map(v=>'<label class="sfhair-option'+((q.multi?answer?.includes(v):answer===v)?' is-selected':'')+'"><input type="'+(q.multi?'checkbox':'radio')+'" name="'+q.id+'" value="'+v+'"'+((q.multi?answer?.includes(v):answer===v)?' checked':'')+'><span><strong>'+esc(optionLabel(q,v))+'</strong>'+(cfg.strings['hint_'+q.id+'_'+v]?'<small>'+esc(t('hint_'+q.id+'_'+v))+'</small>':'')+'</span><i aria-hidden="true"></i></label>').join('');
    draw('<div class="sfhair-quiz"><div class="sfhair-meta"><span>'+esc(t('question'))+' '+(state.step+1)+' / '+questions.length+'</span>'+buttons()+'</div><progress aria-label="'+esc(t('progress'))+'" value="'+state.step+'" max="'+questions.length+'"></progress><p class="sfhair-kicker">'+esc(t('stage_'+q.id))+'</p><h2 data-focus>'+esc(t('q_'+q.id))+'</h2><p class="sfhair-muted">'+esc(t('help_'+q.id))+'</p><fieldset class="sfhair-options"><legend class="sfhair-sr">'+esc(t('q_'+q.id))+'</legend>'+opts+'</fieldset><p class="sfhair-validation" role="status" data-hair-validation></p><div class="sfhair-controls"><button type="button" class="sfhair-link" data-hair-act="back">← '+esc(t('back'))+'</button><button type="button" class="sfhair-button" data-hair-act="next"'+(valid?'':' disabled')+'>'+esc(t(state.step===questions.length-1?'see_routine':'next'))+' →</button></div></div>');
  }
  function profileSummary() {
    return ['pattern','strand','scalp'].map(id=>optionLabel({id},state.answers[id])).join(' · ');
  }
  function getSelected() { return Object.values(state.selected).filter(x=>x.included); }
  function usage(pick) {
    if(pick.knowledge.k18) return t('use_k18');
    if(pick.knowledge.prewash) return t('use_prewash');
    if(pick.knowledge.slot==='treat') return t('use_treat');
    return t('use_'+pick.knowledge.slot);
  }
  function pickCard(slot,pick) {
    const selected=state.selected[slot];
    const p=pick.product; const v=selected.variant;
    const all=E.variants(p,state.answers,state.nowOnly);
    const row=state.result.rows.find(r=>r.slot===slot);
    const image=p.image?'<img src="'+esc(p.image)+'" alt="'+esc(p.title)+'" loading="lazy" decoding="async" width="360" height="360">':'<span class="sfhair-no-image" aria-hidden="true">SOFIE</span>';
    const choices=all.length>1?'<label class="sfhair-size-label">'+esc(t('size_label'))+'<select data-hair-variant="'+slot+'">'+all.map(x=>'<option value="'+x.id+'"'+(x.id===v.id?' selected':'')+'>'+esc(x.title)+' · '+esc(money(x.price))+'</option>').join('')+'</select></label>':'<p class="sfhair-small">'+esc(v.title==='Default Title'?t('one_size'):v.title)+'</p>';
    const alts=row.picks.filter(x=>x.product.handle!==p.handle && !Object.entries(state.selected).some(([s,v])=>s!==slot && v.pick.product.handle===x.product.handle));
    return '<article class="sfhair-card"><div class="sfhair-card-step"><span>'+esc(t('slot_'+slot))+'</span><label><input type="checkbox" data-hair-include="'+slot+'"'+(selected.included?' checked':'')+'> '+esc(t('include'))+'</label></div><a class="sfhair-product-image" href="'+esc(productUrl(p,v))+'">'+image+'</a><div class="sfhair-card-copy"><p class="sfhair-vendor">'+esc(p.vendor)+'</p><h3><a href="'+esc(productUrl(p,v))+'">'+esc(p.title)+'</a></h3><p class="sfhair-price">'+esc(money(v.price))+'</p><span class="sfhair-availability'+(v.now?' is-now':'')+'">'+esc(t(v.now?'now_available':'available_order'))+'</span><ul class="sfhair-reasons">'+pick.reasons.map(r=>'<li>'+esc(t(r))+'</li>').join('')+'</ul><p class="sfhair-use">'+esc(usage(pick))+'</p>'+choices+'<div class="sfhair-card-actions"><button type="button" class="sfhair-button sfhair-button-outline" data-hair-add="'+slot+'">'+esc(t('add_one'))+'</button><a href="'+esc(productUrl(p,v))+'" class="sfhair-link">'+esc(t('details'))+' ↗</a></div>'+(alts.length?'<details class="sfhair-alternatives"><summary>'+esc(t('alternatives'))+'</summary>'+alts.map(x=>'<button type="button" data-hair-swap="'+slot+'" data-handle="'+esc(x.product.handle)+'">'+esc(x.product.vendor+' · '+x.product.title)+'<small>'+esc(money(x.variant.price))+' →</small></button>').join('')+'</details>':'')+'</div></article>';
  }
  function resultScreen() {
    const result=state.result;
    if(result.safety==='refer') {
      draw('<div class="sfhair-referral"><p class="sfhair-kicker">'+esc(t('care_first'))+'</p><h2 data-focus>'+esc(t('refer_heading'))+'</h2><p>'+esc(t('refer_copy'))+'</p><p>'+esc(t('refer_note'))+'</p><div class="sfhair-controls"><button type="button" class="sfhair-button" data-hair-act="edit">'+esc(t('edit'))+'</button>'+buttons()+'</div></div>');return;
    }
    const chosen=getSelected();
    const k18=chosen.some(x=>x.pick.knowledge.k18);
    const cards=result.rows.map(row=>{
      const selected=state.selected[row.slot];
      if(!selected) return '<article class="sfhair-gap"><p class="sfhair-kicker">'+esc(t('slot_'+row.slot))+'</p><h3>'+esc(t('no_pick'))+'</h3><p>'+esc(t(row.slot==='cleanse' && state.answers.scalp==='sensitive'?'sensitive_gap':'no_pick_note'))+'</p></article>';
      return pickCard(row.slot,selected.pick);
    }).join('');
    draw('<div class="sfhair-results"><div class="sfhair-meta"><span>'+esc(t('your_edit'))+'</span>'+buttons()+'</div><h2 data-focus>'+esc(t('result_heading'))+'</h2><p class="sfhair-summary">'+esc(profileSummary())+'</p><div class="sfhair-profile-actions"><button type="button" class="sfhair-link" data-hair-act="edit">'+esc(t('edit'))+'</button><button type="button" class="sfhair-link" data-hair-act="retry">'+esc(t('refresh_picks'))+'</button><button type="button" class="sfhair-link" data-hair-act="save_profile">'+esc(t('save_profile'))+'</button><label><input type="checkbox" data-hair-now'+(state.nowOnly?' checked':'')+'> '+esc(t('now_only'))+'</label></div><p class="sfhair-small">'+esc(t('recommend_note'))+'</p>'+(result.safety==='caution'?'<aside class="sfhair-notice">'+esc(t('caution'))+'</aside>':'')+(k18?'<aside class="sfhair-notice">'+esc(t('k18_note'))+'</aside>':'')+(state.answers.wash==='daily'?'<p class="sfhair-small">'+esc(t('daily_note'))+'</p>':'')+'<div class="sfhair-product-grid">'+cards+'</div><div class="sfhair-total"><div><span>'+esc(t('selected_total'))+'</span><strong>'+esc(money(chosen.reduce((sum,x)=>sum+x.variant.price,0)))+'</strong><small>'+esc(t('total_note'))+'</small></div><button type="button" class="sfhair-button" data-hair-act="add_all"'+(chosen.length?'':' disabled')+'>'+esc(t('add_all'))+' ('+chosen.length+')</button></div><div class="sfhair-save"><button type="button" class="sfhair-link" data-hair-act="save_passport"'+(chosen.length?'':' disabled')+'>'+esc(t('save_passport'))+'</button><a class="sfhair-link" href="'+esc(url(cfg.root+'pages/beauty-passport'))+'">'+esc(t('open_passport'))+' ↗</a><p class="sfhair-small">'+esc(t('passport_note'))+'</p></div><p class="sfhair-delivery">'+esc(t('delivery_note'))+'</p><div class="sfhair-status" role="status" data-hair-status></div></div>');
  }
  async function results(force=false) {
    const current=++generation;
    root.classList.add('is-active');
    draw('<div class="sfhair-loading"><span aria-hidden="true"></span><h2 data-focus>'+esc(t('loading'))+'</h2><p>'+esc(t('loading_note'))+'</p></div>');
    try {
      if(E.safety(state.answers)==='refer') state.result=E.recommend([],state.answers);
      else state.result=E.recommend(await fetchCatalog(force),state.answers,{nowOnly:state.nowOnly});
      if(current!==generation) return;
      state.selected={};
      state.result.rows.forEach(r=>{if(r.picks[0])state.selected[r.slot]={pick:r.picks[0],variant:r.picks[0].variant,included:true};});
      resultScreen();
      document.dispatchEvent(new CustomEvent('sofie:match:complete'));
    } catch {
      if(current!==generation)return;
      draw('<div class="sfhair-referral"><h2 data-focus>'+esc(t('load_error_heading'))+'</h2><p>'+esc(t('load_error'))+'</p><button class="sfhair-button" type="button" data-hair-act="retry">'+esc(t('retry'))+'</button> '+buttons()+'</div>');
    }
  }
  function status(message) { const el=app.querySelector('[data-hair-status]'); if(el){el.textContent=message;el.scrollIntoView({block:'nearest',behavior:'smooth'});} }
  async function cart(items,button) {
    if(busy || !items.length) return;
    busy=true; button.disabled=true; const before=button.textContent;button.textContent=t('adding');
    const locked=Array.from(app.querySelectorAll('input,select,button')).map(el=>[el,el.disabled]);
    locked.forEach(([el])=>{el.disabled=true;});
    try {
      if(items.some(item=>item.variant.now)) {
        const current=await fetchCatalog(true);
        if(items.some(item=>item.variant.now && !current.find(p=>p.handle===item.pick.product.handle)?.variants.some(v=>String(v.id)===String(item.variant.id) && v.available && v.now)))throw Error(t('stock_changed'));
      }
      const fresh=await Promise.all(items.map(async item=>{
        const r=await fetch(url(cfg.root+'products/'+encodeURIComponent(item.pick.product.handle)+'.js'),{cache:'no-store',headers:{Accept:'application/json'}});
        if(!r.ok)throw Error(t('stock_changed'));
        const p=await r.json();const v=p.variants?.find(v=>String(v.id)===String(item.variant.id));
        if(!v?.available)throw Error(t('stock_changed'));
        if(v.price!==item.variant.price)throw Error(t('price_changed'));
        return {id:v.id,quantity:1};
      }));
      const r=await fetch(cfg.root+'cart/add.js',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({items:fresh})});
      const data=await r.json();if(!r.ok)throw Error(data.description || t('cart_error'));
      document.dispatchEvent(new CustomEvent('sofie:journey:cart-added',{detail:{variantIds:fresh.map(x=>String(x.id))}}));
      try {
        const r=await fetch(cfg.root+'cart.js',{cache:'no-store'});if(r.ok){const c=await r.json();document.querySelectorAll('[data-cart-count]').forEach(x=>{x.textContent=c.items.filter(i=>i.handle!=='sofie-now-express-delivery').reduce((n,i)=>n+i.quantity,0);});}
      } catch {}
      status(t('added')); const el=app.querySelector('[data-hair-status]');if(el){const a=document.createElement('a');a.href=cfg.root+'cart';a.textContent=' '+t('view_bag')+' →';el.append(a);}
    } catch(error) {status(error.message || t('cart_error'));}
    finally {busy=false;locked.forEach(([el,disabled])=>{el.disabled=disabled;});button.disabled=false;button.textContent=before;}
  }
  async function savePassport(button) {
    button.disabled=true;
    try {
      const api=window.SofiePassport;if(!api?.load || !api?.save)throw Error(t('passport_error'));
      const current=await api.load();const items=(current.passport?.saved || []).slice();
      getSelected().forEach(x=>{
        const p=x.pick.product,v=x.variant;
        if(!items.some(i=>i.handle===p.handle && String(i.variantId)===String(v.id)))items.push({handle:p.handle,title:p.title,variantId:String(v.id),variantTitle:v.title,step:t('slot_'+Object.keys(state.selected).find(k=>state.selected[k]===x)),included:true});
      });
      if(items.length>100)throw Error(t('passport_limit'));
      await api.save({saved:items},{expectedVersion:current.version});status(t('passport_saved'));
    } catch(error) {status(error.message || t('passport_error'));}
    finally {button.disabled=false;}
  }
  app.addEventListener('change',event=>{
    if(busy)return;
    const el=event.target;
    if(el.matches('[data-hair-now]')) {state.nowOnly=el.checked;results(true);return;}
    if(el.matches('[data-hair-variant]')) {
      const chosen=state.selected[el.dataset.hairVariant];
      const variant=E.variants(chosen.pick.product,state.answers,state.nowOnly).find(v=>String(v.id)===el.value);
      if(variant){chosen.variant=variant;resultScreen();app.querySelector('[data-hair-variant="'+el.dataset.hairVariant+'"]')?.focus({preventScroll:true});}return;
    }
    if(el.matches('[data-hair-include]')) {state.selected[el.dataset.hairInclude].included=el.checked;resultScreen();app.querySelector('[data-hair-include="'+el.dataset.hairInclude+'"]')?.focus({preventScroll:true});return;}
    const q=questions[state.step];
    if(!q || el.name!==q.id)return;
    const validation=app.querySelector('[data-hair-validation]');
    if(q.multi) {
      let chosen=Array.from(app.querySelectorAll('input[name="concerns"]:checked')).map(x=>x.value);
      if(el.value==='maintain' && el.checked) chosen=['maintain'];
      else chosen=chosen.filter(x=>x!=='maintain');
      if(chosen.length>2){el.checked=false;validation.textContent=t('pick_two');return;}
      state.answers[q.id]=chosen;
      app.querySelectorAll('input[name="concerns"]').forEach(x=>{x.checked=chosen.includes(x.value);x.closest('label').classList.toggle('is-selected',x.checked);});
    } else {state.answers[q.id]=el.value;app.querySelectorAll('input[name="'+q.id+'"]').forEach(x=>x.closest('label').classList.toggle('is-selected',x.checked));}
    if(q.id==='colour' || q.id==='pattern')state.answers.concerns=(state.answers.concerns || []).filter(c=>(c!=='brass' || ['blonde','grey'].includes(state.answers.colour))&&(c!=='curls' || state.answers.pattern!=='straight'));
    app.querySelector('[data-hair-act="next"]').disabled=!q.optional && !(q.multi?state.answers[q.id]?.length:state.answers[q.id]);
    validation.textContent='';
  });
  app.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button || button.disabled || busy)return;
    const act=button.dataset.hairAct;
    if(act==='home')return start();
    if(act==='begin'){state={answers:{},step:0,result:null,selected:{},nowOnly:false};fetchCatalog().catch(()=>{});return question();}
    if(act==='resume'){const p=localProfile();if(p){state={answers:p.answers,step:0,result:null,selected:{},nowOnly:false};return results(true);}return start();}
    if(act==='forget'){try{localStorage.removeItem(key);}catch{}return start();}
    if(act==='back'){if(state.step===0)return start();state.step--;return question();}
    if(act==='next'){
      if(questions[state.step].id==='scalp' && state.answers.scalp==='pain')return results();
      if(questions[state.step].id==='concerns' && state.answers.concerns?.includes('sudden_loss'))return results();
      if(state.step===questions.length-1)return results();state.step++;return question();
    }
    if(act==='edit'){generation++;state.step=0;return question();}
    if(act==='retry')return results(true);
    if(act==='save_profile'){try{localStorage.setItem(key,JSON.stringify({version:1,answers:state.answers,at:new Date().toISOString()}));status(t('profile_saved'));}catch{status(t('storage_error'));}return;}
    if(act==='save_passport')return savePassport(button);
    if(act==='add_all')return cart(getSelected(),button);
    if(button.dataset.hairAdd)return cart([state.selected[button.dataset.hairAdd]],button);
    if(button.dataset.hairSwap){const slot=button.dataset.hairSwap;const pick=state.result.rows.find(r=>r.slot===slot).picks.find(p=>p.product.handle===button.dataset.handle);if(pick){state.selected[slot]={pick,variant:pick.variant,included:state.selected[slot].included};resultScreen();}}
  });
  start();
})();
