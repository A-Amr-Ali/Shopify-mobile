(() => {
  'use strict';
  const root = document.querySelector('[data-sofie-growth]');
  if (!root || root.dataset.editorReady) return;
  root.dataset.editorReady = 'true';
  const base = (root.dataset.api || '').replace(/\/$/,'');
  const onShop = /^(www\.)?sofiestore\.net$/.test(location.hostname);
  const T = (ar,en) => root.lang === 'en' ? en : ar;
  const E = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => new Intl.NumberFormat(root.lang === 'en' ? 'en-EG' : 'ar-EG',{style:'currency',currency:'EGP',maximumFractionDigits:2}).format(n);
  const get = (key,value) => {try{return JSON.parse(localStorage.getItem(key)) ?? value;}catch{return value;}};
  const emit = (name,ids=[]) => window.SofieJourney?.event(name,ids);
  let data = null; let selectedProfile = null; let busy = false; let checked = false;
  const products = new Map();
  const areaNames = {new_cairo:['القاهرة الجديدة','New Cairo',30,200],nasr_city:['مدينة نصر','Nasr City',60,225],madinaty:['مدينتي','Madinaty',60,225],giza:['الجيزة','Giza',120,300],shorouk:['الشروق','El Shorouk',120,300],obour:['العبور','El Obour',120,300],zayed:['الشيخ زايد','Sheikh Zayed',120,300],october:['٦ أكتوبر','6 October',120,300]};
  const deliveryConfig=window.SofieJourney?.config.delivery || {fees:{30:200,60:225,120:300},open:10,close:22};
  for(const value of Object.values(areaNames))value[3]=deliveryConfig.fees[value[2]];
  const labels = {prep:['تحضير البشرة','Skin prep'],primer:['برايمر اختياري','Optional primer'],set:['تثبيت الميك أب','Set your makeup'],cheek:['لون للخدود','Cheek colour'],lip:['لمسة للشفايف','Lip care'],moisturize:['ترطيب','Hydration'],eye:['عناية بمنطقة العين','Eye-area care'],gift:['اختيار هدية','Gift idea'],scent:['اكتشفي عطرك','Discover a scent']};
  function area() { return root.querySelector('[data-routine-area]')?.value || get('sofie-area',''); }
  function delivery(item) {
    if (item.available === false) return T('الخيار ده مش متاح دلوقتي.','This option is currently unavailable.');
    if (item.now == null) return T('التوصيل محتاج تأكيد. راجعي صفحة المنتج أو اسألي الفريق.','Delivery needs confirmation. Check the product page or ask our team.');
    if (!item.now) return T('التوصيل العادي: المتاح ٣–٥ أيام عمل. الطلب الخاص ٣–٢١ يوم؛ استثناءات الفئات موضحة في السياسة.','Standard: in-stock 3–5 business days; by-order 3–21. See policy for category exceptions.');
    const a = areaNames[area()];
    const hour = Number(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Cairo',hour:'numeric',hourCycle:'h23'}).format(new Date()));
    const prefix = hour >= deliveryConfig.open && hour < deliveryConfig.close ? 'SOFIE NOW · ' : T('SOFIE NOW مقفول. بنفتح ١٠ صباحًا بتوقيت القاهرة. ','SOFIE NOW is closed. Opens at 10 am Cairo time. ');
    return prefix + (a ? T(a[0],a[1]) + ' · ' + a[2] + T(' دقيقة بعد تأكيد الطلب · ',' min after confirmation · ') + money(a[3]) + T(' رسوم التوصيل.',' delivery fee.') : T('اختاري المنطقة لمعرفة التقدير والرسوم.','Choose an area for an estimate and fee.'));
  }
  const chosen = () => (data?.items || []).filter(p=>p.included !== false);
  function message(value) { const node=root.querySelector('[data-editor-status]') || root.querySelector('[data-status]');if(node)node.textContent=value; }
  function totals() {
    const items=chosen(); const total=Math.round(items.reduce((n,p)=>n + p.price,0)*100)/100;
    root.querySelector('[data-selected-total]').textContent=money(total);
    const button=root.querySelector('[data-editor-cart]');if(button)button.disabled=busy || !checked || !items.length || items.some(p=>p.available===false);
    const over=root.querySelector('[data-over-budget]');if(over)over.hidden=selectedProfile?.budget == null || total <= selectedProfile.budget;
  }
  function draw() {
    const results=root.querySelector('[data-results]'); if(!data || !results)return;
    const a=area();
    results.innerHTML=`<div class="sg-advice"><p class="sg-kicker">${T('روتينك، باختيارك','YOUR ROUTINE, YOUR CHOICE')}</p><p>${E(data.advice || T('روتينك المحفوظ. راجعي الخيارات قبل الإضافة.','Your saved routine. Review the options before adding.'))}</p></div><div class="sg-editor-toolbar"><label>${T('منطقة التوصيل','Delivery area')}<select data-routine-area><option value="">${T('اختاري المنطقة','Choose an area')}</option>${Object.entries(areaNames).map(([key,v])=>`<option value="${key}" ${a===key?'selected':''}>${E(T(v[0],v[1]))}</option>`).join('')}<option value="other" ${a==='other'?'selected':''}>${T('منطقة تانية','Other area')}</option></select></label><a href="https://sofiestore.net/pages/shipping-policy">${T('تفاصيل التوصيل','Delivery details')} ↗</a><button type="button" class="sg-button secondary" data-editor-check>${T('راجعي التوفر','Recheck options')}</button></div>
      <div class="sg-cards">${(data.items || []).map((p,index)=>`<article class="sg-card ${p.included===false?'sg-excluded':''}" data-routine-row="${index}"><div class="sg-card-photo">${p.image?`<img src="${E(p.image)}" alt="${E(p.title)}" loading="lazy" width="420" height="420">`:''}</div><div class="sg-card-body"><p class="sg-step">${E(p.stepName || (labels[p.step] ? T(...labels[p.step]) : T('خطوة الروتين','Routine step')))}</p><div class="sg-vendor">${E(p.brand)}</div><h3>${E(p.title)}</h3><label class="sg-editor-label">${T('المقاس أو الدرجة','Exact size or shade')}<select data-editor-option="${index}" aria-label="${E(p.title)} — ${T('المقاس أو الدرجة','Exact size or shade')}"><option value="${p.variantId}">${E(p.variantTitle)}</option></select></label>${(data.alternatives || []).some(x=>x.step===p.step) ? `<label class="sg-editor-label">${T('جربي بديل','Swap product')}<select data-editor-swap="${index}"><option value="">${T('اختاري بديل للخطوة دي','Choose another product for this step')}</option>${data.alternatives.filter(x=>x.step===p.step && x.handle!==p.handle).map(x=>`<option value="${x.variantId}">${E(x.title)} · ${E(x.variantTitle)} · ${money(x.price)}</option>`).join('')}</select></label>` : ''}<p class="sg-price">${money(p.price)}</p><p class="sg-reason">${E((p.reasons || []).join(' · '))}</p><p class="sg-delivery" data-editor-delivery="${index}">${E(delivery(p))}</p><label class="sg-check"><input type="checkbox" data-editor-include="${index}" ${p.included!==false?'checked':''}><span>${T('ضيفيه في روتيني','Include in my routine')}</span></label><a class="sg-card-link" href="${E(p.url || 'https://sofiestore.net/products/'+p.handle+'?variant='+p.variantId)}" data-product="${p.variantId}">${T('التفاصيل وطريقة الاستخدام','Details and how to use')} ↗</a></div></article>`).join('')}</div>
      <div class="sg-total"><div><p class="sg-note">${T('المنتجات المختارة، من غير التوصيل','Selected products, excluding delivery')}</p><strong data-selected-total></strong><p class="sg-note" data-over-budget hidden>${T('الإجمالي أعلى من ميزانيتك. شيلي خطوة أو اختاري بديل.','The total exceeds your budget. Remove a step or choose an alternative.')}</p><p class="sg-note">${T('الرسوم حسب المنطقة ومحتويات السلة. الفريق بيأكد ميعاد التوصيل بعد تأكيد الطلب.','Delivery fees depend on your area and bag. Our team confirms timing after order confirmation.')}</p></div><div><label class="sg-check"><input type="checkbox" data-editor-confirm><span>${T('راجعت المقاسات والدرجات المختارة','I checked the selected sizes and shades')}</span></label><button class="sg-button" type="button" data-editor-cart disabled>${T('ضيفي المختار للسلة','Add selected products to bag')} +</button><button class="sg-button secondary" type="button" data-editor-save>${T('احفظي روتيني','Save my routine')}</button></div></div><p class="sg-status" data-editor-status role="status" aria-live="polite"></p><p class="sg-note"><a href="https://sofiestore.net/pages/beauty-passport">${T('افتحي جواز جمالك والمكافآت','Open your Beauty Passport and rewards')} ↗</a></p>`;
    checked=false;totals();
  }
  async function optionList(index) {
    const item=data.items[index]; if(!item || !/^[a-z0-9-]+$/.test(item.handle))return;
    if(!products.has(item.handle))products.set(item.handle,fetch((onShop?'':'https://sofiestore.net')+'/products/'+item.handle+'.js',{headers:{accept:'application/json'}}).then(r=>{if(!r.ok)throw Error('product_unavailable');return r.json();}).catch(error=>{products.delete(item.handle);throw error;}));
    const p=await products.get(item.handle);const select=root.querySelector(`[data-editor-option="${index}"]`);
    if(!select || select.value!==item.variantId)return;
    select.innerHTML=p.variants.map(v=>`<option value="${v.id}" ${String(v.id)===item.variantId?'selected':''} ${!v.available?'disabled':''}>${E(v.title)} · ${money(v.price/100)}${!v.available?' · '+T('غير متاح','Unavailable'):''}</option>`).join('');
  }
  async function check(ids=chosen().map(p=>p.variantId)) {
    if(!ids.length)throw Error('empty');
    const res=await fetch(base+'/api/routine/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({variantIds:ids})});
    if(!res.ok)throw Error('check_failed');
    const out=await res.json();
    for(const v of out.items){const p=data.items.find(p=>p.variantId===v.variantId);if(p)Object.assign(p,v);}
    data.checkedAt=out.checkedAt; emit('routine_check',ids);return out;
  }
  async function loadPassport() {
    try {
      const saved=window.SofiePassport ? await window.SofiePassport.load() : {passport:get('sofie-passport-v1',null)};
      const p=saved.passport?.preferences || {};
      const defaults={...p,skin:p.skin || saved.beautyProfile?.skin_type};const form=root.querySelector('[data-form]');
      for(const key of ['goal','skin','finish']){const input=form.querySelector(`[name="${key}"][value="${defaults[key]}"]`);if(input)input.checked=true;}
      for(const key of ['faceAreas','concerns'])form.querySelectorAll(`[name="${key}"]`).forEach(input=>input.checked=(p[key] || []).includes(input.value));
      form.elements.budget.value=p.budget ?? '';form.elements.today.checked=p.today===true;
      if(p.area)try{localStorage.setItem('sofie-area',JSON.stringify(p.area));}catch{}
      selectedProfile={...p,note:'',lang:root.lang};
      if(saved.passport?.routine?.length){data={items:saved.passport.routine.map(x=>({...x,price:0,available:false,now:null})),alternatives:[]};busy=true;draw();await check(data.items.map(p=>p.variantId));busy=false;draw();}
      message(T('حمّلنا تفضيلاتك. عدليها وراجعي اختياراتك.','Your preferences are loaded. Edit them and review your options.'));
    } catch {message(T('مش قادرين نحمّل جواز جمالك دلوقتي.','Your Passport could not load right now.'));busy=false;}
  }
  function mountTools() {
    const bar=root.querySelector('.sg-submitbar');
    if(bar && !bar.querySelector('[data-use-passport]')){const button=document.createElement('button');button.type='button';button.className='sg-button secondary';button.dataset.usePassport='';button.textContent=T('استخدمي جواز جمالك','Use my Beauty Passport');button.addEventListener('click',loadPassport);bar.append(button);}
    const consent=root.querySelector('[name=consent]');
    if(consent && window.SofieJourney)consent.checked=window.SofieJourney.consent();
  }
  root.addEventListener('sofie:routine:ready',e=>{data={...e.detail,items:e.detail.items.map(p=>({...p,included:true}))};busy=false;draw();});
  root.addEventListener('submit',e=>{if(!e.target.matches('[data-form]'))return;const f=new FormData(e.target);selectedProfile={goal:f.get('goal'),skin:f.get('skin'),finish:f.get('finish'),budget:f.get('budget')===''?null:Number(f.get('budget')),faceAreas:f.getAll('faceAreas'),concerns:f.getAll('concerns'),today:f.has('today'),lang:root.lang};},true);
  root.addEventListener('focusin',e=>{if(e.target.matches('[data-editor-option]'))optionList(Number(e.target.dataset.editorOption)).catch(()=>message(T('مش قادرين نحمّل كل الخيارات. جرّبي صفحة المنتج.','Options could not load. Please open the product page.')));});
  root.addEventListener('change',async e=>{
    if(e.target.matches('[name=consent]'))window.SofieJourney?.setConsent(e.target.checked);
    if(e.target.matches('[data-editor-confirm]')){checked=e.target.checked;totals();return;}
    if(e.target.matches('[data-routine-area]')){try{localStorage.setItem('sofie-area',JSON.stringify(e.target.value));window.dispatchEvent(new StorageEvent('storage',{key:'sofie-area'}));}catch{}root.querySelectorAll('[data-editor-delivery]').forEach(n=>n.textContent=delivery(data.items[Number(n.dataset.editorDelivery)]));return;}
    if(e.target.matches('[data-editor-include]')){data.items[Number(e.target.dataset.editorInclude)].included=e.target.checked;checked=false;root.querySelector('[data-editor-confirm]').checked=false;totals();emit('routine_edit');return;}
    let index;
    if(e.target.matches('[data-editor-option]')){index=Number(e.target.dataset.editorOption);const p=data.items[index];p.variantId=e.target.value;p.now=null;p.available=false;}
    if(e.target.matches('[data-editor-swap]') && e.target.value){index=Number(e.target.dataset.editorSwap);const v=data.alternatives.find(p=>p.variantId===e.target.value);if(v)data.items[index]={...v,included:true,available:false,now:null};}
    if(index!==undefined){busy=true;totals();try{await check([data.items[index].variantId]);busy=false;draw();emit('routine_edit');}catch{busy=false;message(T('مش قادرين نأكد التوفر. راجعي الاختيار قبل الإضافة.','We could not confirm availability. Recheck before adding.'));}}
  });
  root.addEventListener('click',async e=>{
    if(e.target.closest('[data-lang]')){data=null;setTimeout(mountTools,0);return;}
    if(e.target.closest('[data-editor-check]')){busy=true;totals();try{await check();busy=false;draw();message(T('راجعنا السعر وتوفر الاختيارات دلوقتي.','Prices and availability were checked just now.'));}catch{busy=false;totals();message(T('مش قادرين نأكد التوفر دلوقتي. جرّبي تاني.','We could not confirm availability. Please try again.'));}return;}
    const save=e.target.closest('[data-editor-save]');
    if(save){save.disabled=true;try{const snapshot={preferences:{...selectedProfile,area:area()},routine:data.items.map(p=>({handle:p.handle,variantId:p.variantId,title:p.title,variantTitle:p.variantTitle,step:p.step,included:p.included!==false}))};if(window.SofiePassport)await window.SofiePassport.save(snapshot);else localStorage.setItem('sofie-passport-v1',JSON.stringify({...get('sofie-passport-v1',{}),...snapshot}));message(T(onShop && window.SofieJourney?.config.loggedIn?'روتينك اتحفظ في حسابك.':'روتينك اتحفظ على الجهاز ده.',onShop && window.SofieJourney?.config.loggedIn?'Your routine is saved to your account.':'Your routine is saved on this device.'));}catch(error){message(error.message || T('مش قادرين نحفظ دلوقتي.','Could not save right now.'));}finally{save.disabled=false;}return;}
    const button=e.target.closest('[data-editor-cart]');if(!button || button.disabled || !chosen().length)return;
    busy=true;totals();
    try {
      const before=chosen().map(p=>({id:p.variantId,price:p.price}));await check(before.map(p=>p.id));
      if(chosen().some(p=>p.available===false || before.find(v=>v.id===p.variantId)?.price!==p.price)){busy=false;draw();message(T('السعر أو التوفر اتغير. راجعي الروتين قبل الإضافة.','A price or availability changed. Review your routine before adding.'));return;}
      const items=chosen().map(p=>({id:Number(p.variantId),quantity:1}));
      if(onShop){const r=await fetch('/cart/add.js',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({items})});if(!r.ok)throw Error('add_failed');await window.SofieJourney?.cartAdded(items.map(p=>p.id));location.assign('/cart');}
      else{const url=new URL('https://sofiestore.net/cart/'+items.map(p=>p.id+':1').join(','));if(root.querySelector('[name=consent]')?.checked){url.searchParams.set('attributes[sofie_campaign]','sofie_knows_q4_2026');url.searchParams.set('attributes[sofie_content_id]',new URLSearchParams(location.search).get('utm_content') || 'adviser');}location.assign(url.toString());}
    }catch{busy=false;totals();message(T('تعذّر التأكيد أو الإضافة. جرّبي تاني أو افتحي صفحة المنتج.','We could not confirm or add these options. Try again or open the product page.'));}
  });
  mountTools();
  if(new URLSearchParams(location.search).get('resume')==='passport')loadPassport();
})();
