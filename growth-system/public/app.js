(() => {
  'use strict';
  const root = document.querySelector('[data-sofie-growth]');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const base = (root.dataset.api || '').replace(/\/$/, '');
  const shop = /^www\./.test(location.hostname) ? location.hostname.slice(4) : location.hostname;
  const onShop = shop === 'sofiestore.net';
  root.classList.toggle('sg-embedded', onShop);
  const query = new URLSearchParams(location.search);
  let lang = query.get('lang') === 'en' ? 'en' : 'ar';
  let selectedGoal = ['prep','lasting','everyday','hydration','gift','scent'].includes(query.get('goal')) ? query.get('goal') : 'prep';
  let routine = null;
  const E = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const T = (ar, en) => lang === 'en' ? en : ar;
  const price = n => new Intl.NumberFormat(lang === 'en' ? 'en-EG' : 'ar-EG',{maximumFractionDigits:2}).format(n) + ' ' + T('ج.م','EGP');
  let sessionId;
  try { sessionId = sessionStorage.getItem('sofie-growth-session') || crypto.randomUUID(); sessionStorage.setItem('sofie-growth-session', sessionId); } catch { sessionId = crypto.randomUUID(); }
  const contentId = (query.get('utm_content') || 'adviser').slice(0,100);
  const source = (query.get('utm_source') || 'direct').slice(0,30);
  const goals = { prep:['الميك أب بيبان ناشف','Makeup looks dry'],lasting:['عايزة ميك أب ثابت','Help my makeup last'],everyday:['لوك يومي بسيط','An easy everyday look'],hydration:['بشرتي محتاجة ترطيب','A hydration ritual'],gift:['بدور على هدية','Find a thoughtful gift'],scent:['عايزة ريحة تناسبني','Find my scent'] };
  function choices(name, values, selected, cls) {
    return '<div class="'+cls+'">'+values.map(([v,a,b])=>'<label class="sg-choice"><input type="radio" name="'+name+'" value="'+v+'" '+(v===selected?'checked':'')+'><span>'+E(T(a,b))+'</span></label>').join('')+'</div>';
  }
  function multiChoices(name, values) {
    return '<div class="sg-chips sg-multi">'+values.map(([v,a,b])=>'<label class="sg-choice"><input type="checkbox" name="'+name+'" value="'+v+'"><span>'+E(T(a,b))+'</span></label>').join('')+'</div>';
  }
  function render() {
    root.setAttribute('dir',lang === 'ar' ? 'rtl' : 'ltr'); root.setAttribute('lang',lang);
    root.innerHTML = `<nav class="sg-nav" aria-label="SOFIE"><a class="sg-wordmark" href="https://sofiestore.net">SOFIE</a><div class="sg-navsmall"><a href="https://sofiestore.net/collections/fresh-at-sofie">${T('Fresh at SOFIE','Fresh at SOFIE')}</a><a href="https://sofiestore.net/pages/my-rewards">${T('مكافآتك','Your rewards')}</a><button type="button" class="sg-lang" data-lang>${T('English','العربية')}</button></div></nav><div class="sg-embedlang"><button type="button" class="sg-lang" data-lang>${T('English','العربية')}</button></div>
    <section class="sg-hero"><div class="sg-hero-copy"><p class="sg-eyebrow">SOFIE KNOWS YOUR BEAUTY</p><h1>${T('جمالك.<br><em>باختيار أذكى.</em>','Your beauty.<br><em>A wiser choice.</em>')}</h1><p class="sg-lead">${T('مش كل تريند مناسب ليكي. قولي لنا محتاجة إيه وإيه اللي مضايقك في بشرتك، ونختار معاكي منتجات مناسبة. الميزانية اختيارية.','Not every trend fits. Tell us which part of your face concerns you and find suitable options. Setting a budget is optional.')}</p><div class="sg-actions"><a class="sg-button" href="#sg-quiz">${T('اختاري روتينك','Find my routine')} ↗</a><a class="sg-button secondary" href="#sg-visit">${T('زورينا في ميفيدا','Visit us in Mivida')}</a></div><p class="sg-note">${T('اختيارات للتجميل والعناية العامة. كل بشرة مختلفة.','Cosmetic and general-care guidance. Every skin is different.')}</p></div><div class="sg-portrait"><img src="${E(base)}/nour.jpg" alt="${T('نور، شخصية صوفي الافتراضية للتوعية بالجمال','Nour, SOFIE’s fictional virtual beauty educator')}"><span class="sg-portrait-note">${T('نور · دليلتك الافتراضية من SOFIE','Nour · SOFIE’s virtual beauty guide')}</span></div></section>
    <div class="sg-trust"><span>${T('اختيارات من كتالوج SOFIE الحقيقي','Real options from the SOFIE catalogue')}</span><span>${T('ميزانيتك اختيارية','Your budget is optional')}</span><span>${T('تعرفي ليه كل اختيار مناسب','A clear reason for every choice')}</span></div>
    <section class="sg-section" id="sg-quiz"><div class="sg-section-head"><div><p class="sg-eyebrow">YOUR PERSONAL EDIT</p><h2>${T('نبدأ باحتياجك.','Start with what you need.')}</h2><p class="sg-note">${T('اختاري اهتماماتك من غير ميزانية إجبارية.','Tell us your concerns without a required budget.')}</p></div><a href="https://wa.me/201007488707" target="_blank" rel="noopener" class="sg-note">${T('اسألي فريق صوفي ↗','Ask the SOFIE team ↗')}</a></div>
    <form class="sg-form" data-form><fieldset><legend>1. ${T('محتاجة إيه النهارده؟','What would you like help with?')}</legend>${choices('goal',Object.entries(goals).map(([v,x])=>[v,...x]),selectedGoal,'sg-goals')}</fieldset>
    <fieldset><legend>2. ${T('بشرتك غالبًا...','Your skin usually feels...')}</legend>${choices('skin',[['unsure','مش متأكدة','Not sure'],['normal','عادية','Normal'],['dry','جافة','Dry'],['oily','دهنية','Oily'],['combo','مختلطة','Combination'],['sensitive','حساسة','Sensitive']],'unsure','sg-chips')}</fieldset>
    <fieldset><legend>3. ${T('اللمسة اللي بتحبيها','The finish you prefer')}</legend>${choices('finish',[['natural','طبيعية','Natural'],['radiant','مضيئة','Radiant'],['matte','مطفية','Matte']],'natural','sg-chips')}</fieldset>
    <fieldset><legend>4. ${T('أنهي مناطق في وشّك حابة تهتمي بيها؟ (اختاري لحد 3)','Which areas of your face concern you? (Choose up to 3)')}</legend>${multiChoices('faceAreas', [
      ['forehead','الجبهة','Forehead'],['under-eyes','تحت العين','Under eyes'],['around-eyes','حوالين العين','Around eyes'],['cheeks','الخدود','Cheeks'],
      ['nose','الأنف','Nose'],['lips','الشفايف','Lips'],['chin-jaw','الدقن والفك','Chin & jawline'],['whole-face','الوش كله','Entire face']
    ])}<p class="sg-note">${T('اختياري — اختاري أكتر من منطقة أو سيبيها فاضية.','Optional — choose more than one area or leave this blank.')}</p></fieldset>
    <fieldset><legend>5. ${T('إيه أكتر حاجة مضايقاكي؟ (اختاري لحد 3)','What are your main concerns? (Choose up to 3)')}</legend>${multiChoices('concerns', [
      ['breakouts','حبوب وبثور','Breakouts'],['dark-circles','هالات تحت العين','Dark circles'],['dark-spots','بقع وآثار غامقة','Dark spots'],
      ['dryness','جفاف','Dryness'],['fine-lines','خطوط رفيعة','Fine lines'],['pores','مسام واسعة','Visible pores'],
      ['redness','احمرار','Redness'],['texture','ملمس غير متساوي','Uneven texture'],['dullness','بهتان','Dullness'],
      ['oiliness','دهون ولمعان','Oiliness'],['puffiness','انتفاخ تحت العين','Under-eye puffiness']
    ])}<p class="sg-note">${T('هنا بنطابق كلام وصف المنتج مع اهتماماتك، مش بنشخّص مشاكل طبية.','We match product listing details to your concerns; this is not a medical diagnosis.')}</p></fieldset>
    <div class="sg-row"><div class="sg-field"><label for="sg-budget">6. ${T('ميزانية الروتين (اختياري، ج.م)','Routine budget (optional, EGP)')}</label><input class="sg-input" id="sg-budget" name="budget" type="number" min="100" max="100000" step="100" placeholder="${T('سيبيها فاضية لأفضل اختيارات بدون حد أقصى','Leave blank for best matches at any price')}" inputmode="numeric"><p class="sg-note">${T('لو سيبتيها فاضية هنعرض الأنسب من غير سقف سعر. التوصيل بيتحسب لوحده.','Leave blank to see the best matches without a price limit. Delivery is separate.')}</p></div><div class="sg-field"><label for="sg-note">${T('تفضيل تحبي نقوله؟ (اختياري)','Any preferences? (optional)')}</label><textarea class="sg-input" id="sg-note" name="note" maxlength="500" placeholder="${T('مثلاً: بحب اللوك الخفيف، أو دي أول مرة أشتري برايمر','For example: I prefer a light look, or I’m new to primer')}"></textarea></div></div>
    <label class="sg-check"><input type="checkbox" name="today"><span>${T('عايزة اختيارات مؤهلة لـ SOFIE NOW فقط. الفريق يؤكد المنطقة وميعاد التوصيل بعد تأكيد الطلب.','Show SOFIE NOW eligible options only. Our team confirms your area and delivery timing after order confirmation.')}</span></label>
    <label class="sg-check"><input type="checkbox" name="consent"><span>${T('أوافق على تسجيل تفاعلي مع التوصيات لقياس التجربة وتحسينها. الاختيار ده اختياري ومش اشتراك في رسائل تسويقية.','I agree to recording my recommendation interactions to measure and improve the experience. This is optional and does not subscribe me to marketing.')} <a href="https://sofiestore.net/policies/privacy-policy">${T('الخصوصية','Privacy')}</a></span></label>
    <div class="sg-submitbar"><button type="submit" class="sg-button" data-submit>${T('شوفي اختياراتي','Show my edit')} ↗</button><p class="sg-note">${T('محتاجة درجة فاونديشن؟','Need a foundation shade?')} <a href="https://sofiestore.net" ${onShop?'data-match-open="base"':''}>Find My Match</a></p></div><div class="sg-status" role="status" aria-live="polite" data-status></div></form><div class="sg-results" data-results aria-live="polite"></div></section>
    <section class="sg-section sg-store" id="sg-visit"><div><p class="sg-eyebrow">THE SOFIE EXPERIENCE</p><h2>${T('نفس الاختيار.<br>اهتمام شخصي في المتجر.','The same edit.<br>A personal touch in store.')}</h2><p>${T('خدي صورة لاختياراتك ووريها لفريق صوفي. نساعدك تقارني المقاسات والدرجات وتختاري بثقة.','Save your edit and show the SOFIE team. We can help compare sizes and shades so you choose confidently.')}</p></div><div><h3>SOFIE · Mivida</h3><p>${T('The Place Mall، بوابة 8، ميفيدا، القاهرة الجديدة','The Place Mall, Gate 8, Mivida, New Cairo')}<br>${T('كل يوم من 10 صباحًا لـ 10 مساءً','Every day, 10 am–10 pm')}</p><a class="sg-button secondary" href="https://wa.me/201007488707?text=${encodeURIComponent(T('أهلاً صوفي، عايزة مساعدة في اختياراتي وزيارة المتجر.','Hi SOFIE, I would like help with my edit and visiting the store.'))}" target="_blank" rel="noopener">${T('تواصلي مع الفريق','Talk to our team')} ↗</a></div></section>
    <footer class="sg-footer"><span>SOFIE · ${T('جمال باهتمام شخصي','Beauty with a personal touch')}</span><span>${T('نور شخصية افتراضية بالذكاء الاصطناعي؛ التوصيات تعليمية.','Nour is a fictional AI character; recommendations are educational.')}<a href="https://sofiestore.net/policies/privacy-policy">${T('الخصوصية','Privacy')}</a></span></footer>`;
  }
  function consent() { return root.querySelector('[name=consent]')?.checked === true; }
  async function event(name, ids=[]) {
    if (!consent()) return;
    try { await fetch(base+'/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consent:true,eventId:crypto.randomUUID(),sessionId,event:name,goal:root.querySelector('[name=goal]:checked')?.value,contentId,source,variantIds:ids})}); } catch { /* matching does not depend on analytics */ }
  }
  function showRoutine(data) {
    const r = root.querySelector('[data-results]'); routine = data;
    const cards = (data.items||[]).map(p=>`<article class="sg-card"><div class="sg-card-photo">${p.image?`<img src="${E(p.image)}" alt="${E(p.title)}" loading="lazy">`:''}</div><div class="sg-card-body"><p class="sg-step">${E(p.stepName)}</p><div class="sg-vendor">${E(p.brand)}</div><h3>${E(p.title)}</h3><p class="sg-variant">${E(p.variantTitle)}</p>${p.now?'<span class="sg-pill">SOFIE NOW</span>':''}<p class="sg-price">${price(p.price)}</p><p class="sg-reason">${E((p.reasons||[]).join(' · '))}</p><a class="sg-card-link" href="${E(p.url)}" target="_top" data-product="${E(p.variantId)}">${T('شوفي التفاصيل والدرجة','See details and shade')} ↗</a></div></article>`).join('');
    r.innerHTML = `<div class="sg-advice"><p class="sg-kicker">${T('اختيارات صوفي ليكي','YOUR SOFIE EDIT')}</p><p>${E(data.advice)}</p></div><div class="sg-cards">${cards}</div>${data.items?.length?`<div class="sg-total"><div><p class="sg-note">${T('إجمالي اختياراتك - من غير التوصيل','Your edit total - excluding delivery')}</p><strong>${price(data.total)}</strong><p class="sg-note">${T('المقاسات والدرجات ظاهرة فوق؛ راجعيها قبل الإضافة.','Sizes and shades are shown above; review them before adding.')}</p></div><div><label class="sg-check"><input type="checkbox" data-confirm><span>${T('راجعت المقاسات والدرجات اللي ظاهرة','I have checked the listed sizes and shades')}</span></label><button type="button" class="sg-button" data-cart disabled>${T('ضيفي اختياراتي للسلة','Add my edit to bag')} +</button></div></div>`:''}${data.missingSteps?.length?`<p class="sg-note">${data.budget == null ? T('مضفناش خطوات ملقيناش لها منتج مناسب ومتاح.','We left out steps without a suitable available product.') : T('مضفناش خطوات خارج الميزانية أو من غير اختيار مناسب.','We left out steps without a suitable option within budget.')}</p>`:''}<p class="sg-note">${T('السعر والتوفر بيتغيروا؛ المراجعة النهائية عند الإضافة والسلة. مؤهلة لـ SOFIE NOW حسب الخيار والمنطقة وساعات التشغيل.','Prices and availability may change; we check again when adding. SOFIE NOW depends on the option, area and operating hours.')}</p>`;
    r.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
  }
  root.addEventListener('submit', async ev => {
    if (!ev.target.matches('[data-form]')) return; ev.preventDefault();
    const form = new FormData(ev.target); const button = root.querySelector('[data-submit]'); const status = root.querySelector('[data-status]');
    const profile = {goal:form.get('goal'),skin:form.get('skin'),finish:form.get('finish'),budget:form.get('budget')?.trim() ? Number(form.get('budget')) : null,faceAreas:form.getAll('faceAreas'),concerns:form.getAll('concerns'),note:form.get('note'),today:form.get('today')==='on',lang};
    selectedGoal=profile.goal; button.disabled=true; status.textContent='';
    root.querySelector('[data-results]').innerHTML='<div class="sg-loading">'+T('بنراجع المنتجات المتاحة حسب اهتماماتك…','Matching available products to your concerns…')+'</div>';
    try { const r = await fetch(base+'/api/match',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(profile)}); if (!r.ok) throw new Error(r.status); const data = await r.json(); showRoutine(data); await event('match_complete',(data.items||[]).map(p=>p.variantId)); if(source==='store') await event('qr_scan'); }
    catch(err) { root.querySelector('[data-results]').innerHTML=''; status.textContent=String(err.message)==='429'?T('جرّبي تاني بعد شوية، أو اسألي فريق صوفي.','Try again a little later, or ask our team.'):T('مش قادرين نراجع الاختيارات دلوقتي. جرّبي تاني أو اسألي الفريق.','We cannot check options right now. Please try again or ask our team.'); }
    finally { button.disabled=false; }
  });
  root.addEventListener('change', ev=>{
    if(ev.target.matches('[data-confirm]')) root.querySelector('[data-cart]').disabled=!ev.target.checked;
    if(ev.target.matches('input[name="faceAreas"],input[name="concerns"]') && ev.target.checked){
      const count=root.querySelectorAll('input[name="'+ev.target.name+'"]:checked').length;
      if(count>3){
        ev.target.checked=false;
        root.querySelector('[data-status]').textContent=T('اختاري بحد أقصى 3 اختيارات في السؤال.','Please choose up to 3 options for this question.');
      } else root.querySelector('[data-status]').textContent='';
    }
  });
  root.addEventListener('click', async ev => {
    if(ev.target.closest('[data-lang]')) {lang=lang==='ar'?'en':'ar';routine=null;render();return;}
    const product=ev.target.closest('[data-product]');if(product){event('product_click',[product.dataset.product]);return;}
    const b=ev.target.closest('[data-cart]');if(!b||b.disabled||!routine?.items?.length)return;
    b.disabled=true;const original=b.textContent;b.textContent=T('بنضيف اختياراتك…','Adding your edit…');
    const items=routine.items.map(p=>({id:Number(p.variantId),quantity:1}));
    try {
      if(onShop){
        const r=await fetch('/cart/add.js',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({items})});
        if(!r.ok)throw new Error('add_failed');
        if(consent())try{await fetch('/cart/update.js',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({attributes:{sofie_campaign:'sofie_knows_q4_2026',sofie_content_id:contentId,sofie_match_session:sessionId}})});}catch{}
        await event('cart_add',items.map(p=>p.id));document.dispatchEvent(new CustomEvent('sofie:cart:added'));
        location.assign('/cart');
      }else{
        const url=new URL('https://sofiestore.net/cart/'+items.map(p=>p.id+':1').join(','));
        if(consent()){url.searchParams.set('attributes[sofie_campaign]','sofie_knows_q4_2026');url.searchParams.set('attributes[sofie_content_id]',contentId);url.searchParams.set('attributes[sofie_match_session]',sessionId);}
        await event('cart_add',items.map(p=>p.id));location.assign(url.toString());
      }
    }catch{b.disabled=false;b.textContent=original;root.querySelector('[data-status]').textContent=T('التوفر ممكن يكون اتغير. راجعي صفحة المنتج أو جرّبي تاني.','Availability may have changed. Check the product page or try again.');}
  });
  render();
})();
