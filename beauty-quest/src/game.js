(() => {
  'use strict';
  const root=document.getElementById('sofie-beauty-quest');
  if(!root||root.dataset.ready)return;
  root.dataset.ready='true';
  const R=window.SofieQuestRules;
  const screen=root.querySelector('[data-quest-screen]');
  const status=root.querySelector('[data-quest-status]');
  const route=window.Shopify?.routes?.root||'/';
  const configNode=document.querySelector('[data-match-config]');
  let matchConfig={};try{matchConfig=JSON.parse(configNode?.textContent||'{}');}catch{}
  const feeds={foundation:'foundation',skintint:'tinted-moisturizer',concealer:'concealer',cleanser:'cleansers',moisturizer:'moisturizers-1',spf:'sunscreen',eye:'eye-care',balm:'lip-balms-treatments-1',...matchConfig.feeds};
  const whatsapp=/^\d{8,16}$/.test(matchConfig.whatsapp||'')?matchConfig.whatsapp:'201007488707';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeURL=(s,fallback='#')=>{try{const u=new URL(s,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:fallback;}catch{return fallback;}};
  const money=p=>{try{return new Intl.NumberFormat('en-EG',{style:'currency',currency:currency,maximumFractionDigits:2}).format(p/100);}catch{return 'EGP '+(p/100).toLocaleString();}};
  let currency=matchConfig.currency||window.Shopify?.currency?.active||'EGP';
  const areas=[['forehead','Forehead'],['undereyes','Under eyes'],['cheeks','Cheeks'],['nose','Nose & T-zone'],['lips','Lips'],['jaw','Chin & jawline'],['all','Whole face']];
  const concerns=[['dryness','More hydration','Tightness or dry-looking skin'],['shine','Less shine','An oily-looking T-zone'],['dull','More radiance','Skin looks a little tired'],['uneven','A more even look','Uneven-looking tone'],['blemish','Blemish-prone care','Keep my routine gentle'],['redness','A calmer feel','Skin feels easily unsettled']];
  const skin=[['dry','Dry','Often feels tight'],['oily','Oily','Shiny across my face'],['combination','Combination','Shiny T-zone, drier cheeks'],['normal','Balanced','Usually comfortable']];
  const budgets=[['any','Explore freely','No price limit'],['b1','Up to EGP 3,000','Per product'],['b2','Up to EGP 5,000','Per product'],['b3','Up to EGP 8,000','Per product']];
  const steps={
    shade:[
      {id:'kind',tag:'CHOOSE YOUR TOOL',title:'What are we playing with?',hint:'Pick the product you would love to find.',opts:[['foundation','Foundation','Build your base'],['skintint','Skin tint','A lighter touch'],['concealer','Concealer','A little extra coverage']],tip:'Choose how you like to wear your base. We will explore formulas in that category.'},
      {id:'depth',tag:'PAINT YOUR PORTRAIT',title:'Find your closest canvas.',hint:'Choose the depth closest to your face in natural daylight. These are illustrations, not a camera scan.',type:'swatch',opts:R.depths.map(d=>[d[0],d[1],d[2]]),tip:'Compare along your jaw and neck in daylight. Screen colours are only a guide.'},
      {id:'tone',tag:'THE COLOUR CLUE',title:'Which undertone feels like you?',hint:'Think of the underlying tone of your bare skin. It is fine to be unsure.',opts:[['cool','Cool','Pink or rosy'],['neutral','Neutral','A balance of warm and cool'],['warm','Warm','Golden or peachy'],['olive','Olive','A green-grey cast'],['unsure','Not sure','Keep my options open']],tip:'Depth and undertone are different. Your best shade should blend into your jaw without leaving an edge.'},
      {id:'finish',tag:'SET THE MOOD',title:'Choose your finishing touch.',hint:'Your portrait changes with your choice. The illustration is just for play.',opts:[['glow','A little glow','Dewy and luminous'],['natural','Like my skin','Natural and easy'],['matte','Softly matte','A shine-free look']],tip:'Finish describes the look of the formula. We check the product details for your preference.'},
      {id:'skin',tag:'THE COMFORT CLUE',title:'How does your skin feel?',hint:'Choose what feels closest on a typical day.',opts:skin,tip:'Skin comfort helps us choose which formula details to prioritise.'},
      {id:'budget',tag:'YOUR FINAL KEY',title:'Any price limit?',hint:'Optional. Skip this round to explore without a price limit.',opts:budgets,optional:true,tip:'The limit applies to the actual shade or size you select, not a cheaper option on the same product.'}
    ],
    skin:[
      {id:'area',tag:'MAP YOUR MISSION',title:'Where shall we focus?',hint:'Tap the portrait or choose an area below.',type:'map',opts:areas,tip:'A face map helps keep recommendations relevant to the area you choose.'},
      {id:'concerns',tag:'CHOOSE YOUR QUEST',title:'What would you love to change?',hint:'Choose up to two cosmetic goals. There are no wrong answers.',type:'multi',max:2,opts:concerns,tip:'We focus on product care and appearance. This game does not diagnose a skin condition.'},
      {id:'skin',tag:'GET TO KNOW YOUR CANVAS',title:'How does your skin feel?',hint:'Choose the closest fit for an ordinary day.',opts:skin,tip:'A simple routine starts with understanding how your skin feels.'},
      {id:'sensitivity',tag:'A LITTLE CARE',title:'Does skin care often sting?',hint:'This helps us keep your product shortlist gentle.',opts:[['yes','Yes, quite easily','Prioritise fragrance-free details'],['no','Not usually','Keep the basics simple']],tip:'Introduce one product at a time and follow its label. Persistent irritation is a reason to seek professional advice.'},
      {id:'budget',tag:'YOUR FINAL KEY',title:'Any price limit?',hint:'Optional. Your limit is per product, not the total routine.',opts:budgets,optional:true,tip:'Every routine step stays optional. You can choose only the products you need.'}
    ]
  };
  let state={path:null,index:0,a:{},phase:'home',rows:[],missing:[],failed:false};
  let requestId=0;
  let saved=null;try{const s=JSON.parse(localStorage.getItem('sofie-beauty-quest-v1'));if(s&&steps[s.path]&&s.a&&typeof s.a==='object')saved=s;}catch{}
  function announce(message){status.textContent=message;clearTimeout(announce.timer);announce.timer=setTimeout(()=>{status.textContent='';},6500);}
  function analytics(name,variantId){
    if(window.SofieJourney?.consent?.()!==true)return;
    try{window.Shopify?.analytics?.publish?.('sofie_beauty_quest',{action:name,...(variantId?{variant_id:String(variantId)}:{})});}catch{}
    document.dispatchEvent(new CustomEvent('sofie:quest:event',{detail:{action:name}}));
  }
  function paint(){const d=R.depths.find(d=>d[0]===state.a.depth);root.style.setProperty('--q-skin',d?.[2]||'#c79373');root.style.setProperty('--q-glow',state.a.finish==='glow'?'.65':state.a.finish==='matte'?'0':'.22');}
  function render(html,focus=true){screen.innerHTML=html;paint();if(focus){const h=screen.querySelector('[data-quest-focus]');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}if(!root.matches(':hover')&&state.phase==='results')root.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}
  function portrait(map=false){
    const spots=map?areas.filter(x=>x[0]!=='all').map(x=>`<button type="button" class="sbq-hotspot" data-action="choose" data-v="${x[0]}" aria-label="${esc(x[1])}" aria-pressed="${state.a.area===x[0]}">${state.a.area===x[0]?'✓':'+'}</button>`).join(''):'';
    return `<div class="sbq-portrait"><svg class="sbq-face" viewBox="0 0 320 410" aria-hidden="true"><defs><radialGradient id="sbq-glow"><stop stop-color="#fff9db"/><stop offset="1" stop-color="#fff9db" stop-opacity="0"/></radialGradient></defs><path d="M58 410v-95q0-51 65-59h74q65 8 65 59v95" fill="#69765c"/><path d="M124 237v45q34 27 72 0v-45" class="face-fill"/><path d="M127 257q33 20 66 0" fill="none" stroke="#80563e" stroke-opacity=".2" stroke-width="5"/><path d="M72 149q-17-14-16 15t21 26M248 149q17-14 16 15t-21 26" class="face-fill"/><path d="M75 121q0-75 85-75t85 75v52q-5 76-85 105-80-29-85-105z" class="face-fill"/><path d="M72 151Q48 83 90 49q53-40 115-5 53 12 45 106-18-14-19-45-33-2-60-43-31 53-89 54z" fill="#35382b"/><path d="M94 143q18-11 37 0m58 0q18-11 37 0" fill="none" stroke="#5c4332" stroke-width="4" stroke-linecap="round"/><path d="M96 158q16 14 33 0m62 0q16 14 33 0" fill="none" stroke="#513c31" stroke-width="3" stroke-linecap="round"/><path d="M160 156l-10 36q10 7 20 0" fill="none" stroke="#8b6046" stroke-opacity=".5" stroke-width="2"/><ellipse cx="109" cy="188" rx="25" ry="12" class="face-blush"/><ellipse cx="211" cy="188" rx="25" ry="12" class="face-blush"/><path d="M135 218q12-11 25-4 13-7 25 4-24 26-50 0" fill="#a75e51"/><path d="M135 218q25 6 50 0" fill="none" stroke="#7f493d" stroke-width="1"/><ellipse cx="116" cy="176" rx="29" ry="16" fill="url(#sbq-glow)" class="face-glow"/><ellipse cx="206" cy="176" rx="29" ry="16" fill="url(#sbq-glow)" class="face-glow"/><ellipse cx="161" cy="113" rx="31" ry="27" fill="url(#sbq-glow)" class="face-glow"/><circle cx="76" cy="182" r="5" fill="#b89a64"/><circle cx="244" cy="182" r="5" fill="#b89a64"/></svg>${spots}${map?'<span class="sbq-map-caption">Choose one area to explore</span>':''}</div>`;
  }
  function scene(playing=false,map=false){
    const d=R.depths.find(x=>x[0]===state.a.depth);
    const first=state.path==='skin'?(areas.find(x=>x[0]===state.a.area)?.[1]||'Your skin ritual'):(d?.[1]||'Your colour story');
    const second=state.a.finish?({glow:'Dewy glow',natural:'Natural skin',matte:'Soft matte'}[state.a.finish]):state.path==='skin'?'Small steps. Thoughtful care.':'Beauty, on your terms.';
    return `<aside class="sbq-scene${playing?' is-playing':''}${map?' is-map':''}" aria-label="Your illustrated beauty portrait"><div class="sbq-orbit"></div>${portrait(map)}<div class="sbq-float sbq-float-a"><strong>✧ ${esc(first)}</strong><small>A discovery, made around you</small></div><div class="sbq-float sbq-float-b"><strong>${esc(second)}</strong><small>THE SOFIE EDIT</small></div><span class="sbq-star sbq-star-a" aria-hidden="true">✧</span><span class="sbq-star sbq-star-b" aria-hidden="true">✦</span><div class="sbq-charm" aria-hidden="true">SOFIE</div><p class="sbq-scene-label">YOUR PORTRAIT · JUST FOR PLAY</p></aside>`;
  }
  const shelf=()=>'<footer class="sbq-shelf"><span>No selfie. No sign-up to play. No wrong answers.</span><span>Beauty advice, with a little SOFIE magic.</span></footer>';
  function home(){
    const restarting=state.phase!=='home';
    requestId++;state={path:null,index:0,a:{},phase:'home',rows:[],missing:[],failed:false};
    render(`<div class="sbq-stage"><div class="sbq-main"><p class="sbq-kicker">PERSONALISED BY SOFIE · ABOUT 90 SECONDS</p><h2 data-quest-focus>Your beauty.<br><em>Unlocked.</em></h2><p class="sbq-lead">Play a little. Discover a lot. Collect your beauty clues and unlock a shade shortlist or a skin ritual made around you.</p><div class="sbq-paths"><button type="button" class="sbq-path" data-action="start" data-v="shade"><span>01</span><span><strong>Find my shade</strong><small>A colour quest for your next favourite base</small></span><span aria-hidden="true">↗</span></button><button type="button" class="sbq-path" data-action="start" data-v="skin"><span>02</span><span><strong>Build my skin ritual</strong><small>A face map. Your goals. Your next steps.</small></span><span aria-hidden="true">↗</span></button></div><p class="sbq-micro">Your reward: useful beauty discoveries. No purchase needed to play.</p>${saved?'<p class="sbq-resume"><button type="button" class="sbq-inline" data-action="resume">Revisit my saved quest ↗</button> · <button type="button" class="sbq-inline" data-action="forget">Forget my quest</button></p>':''}</div>${scene()}</div>${shelf()}`,false);
    if(restarting)root.scrollIntoView({block:'start',behavior:'instant'});
  }
  function question(){
    state.phase='question';
    const rounds=steps[state.path],step=rounds[state.index];
    if(!step)return results();
    const current=state.a[step.id];
    const tokens=rounds.map((_,i)=>`<span class="sbq-token${i<state.index?' is-earned':''}${i===state.index?' is-current':''}"></span>`).join('');
    const opts=step.opts.map(o=>{
      const selected=step.type==='multi'?(current||[]).includes(o[0]):current===o[0];
      return `<button type="button" class="sbq-option" data-action="choose" data-v="${o[0]}" aria-pressed="${selected}">${step.type==='swatch'?`<span class="sbq-swatch" style="background:${o[2]}" aria-hidden="true"></span>`:''}<strong>${esc(o[1])}</strong>${step.type!=='swatch'&&o[2]?`<small>${esc(o[2])}</small>`:''}</button>`;
    }).join('');
    const ready=step.optional||(Array.isArray(current)?current.length>0:!!current);
    const last=state.index===rounds.length-1;
    render(`<div class="sbq-stage"><div class="sbq-main sbq-question"><div class="sbq-tokens" role="progressbar" aria-label="Beauty clues collected" aria-valuemin="0" aria-valuemax="${rounds.length}" aria-valuenow="${state.index}">${tokens}<small>${state.index+1} / ${rounds.length}</small></div><p class="sbq-kicker">${step.tag}</p><h2 data-quest-focus>${step.title}</h2><p class="sbq-lead">${step.hint}</p><div class="sbq-options${step.type==='swatch'?' sbq-swatch-grid':''}" role="group" aria-label="${esc(step.title)}">${opts}</div><div class="sbq-nav"><button type="button" class="sbq-back" data-action="back">← Back</button><button type="button" class="sbq-button" data-action="next"${ready?'':' disabled'}>${last?(current?'Unlock my discoveries':'Skip price limit · Unlock'): 'Collect clue →'}</button></div><p class="sbq-tip"><b>✧ A beauty clue</b><br>${step.tip}</p><button type="button" class="sbq-inline" data-action="home">Start a different quest</button></div>${scene(true,step.type==='map')}</div>${shelf()}`);
  }
  async function getJSON(url,timeout=18000,accept='application/json'){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
    try{const res=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{accept},signal:ctl.signal});if(!res.ok)throw Error('shelf_unavailable');return await res.json();}finally{clearTimeout(timer);}
  }
  async function loadFeed(key){
    const handle=feeds[key];if(!/^[a-z0-9-]+$/.test(handle||''))throw Error('shelf_unavailable');
    const data=await getJSON(route+'collections/'+handle+'?view=sfm&sort_by=best-selling',18000,'text/html');
    if(!Array.isArray(data))throw Error('shelf_unavailable');
    return data.filter(p=>/^[a-z0-9-]+$/.test(p.h||'')&&Array.isArray(p.s));
  }
  function plain(html){const el=document.createElement('div');el.innerHTML=String(html||'');return el.textContent||'';}
  async function refreshProduct(row){
    const live=await getJSON(route+'products/'+row.p.h+'.js');
    const fitting=new Set(row.variants.map(v=>String(v.id)));
    const variants=(live.variants||[]).filter(v=>fitting.has(String(v.id))&&v.available&&R.withinBudget(Number(v.price),state.a.budget)).map(v=>({id:v.id,t:v.title,p:Number(v.price),a:1}));
    if(!variants.length)return null;
    const p={...row.p,t:live.title||row.p.t,v:live.vendor||row.p.v,d:plain(live.description),s:variants,i:live.featured_image||row.p.i};
    if(state.path==='skin'){
      const key=state.a.area==='lips'?'balm':state.a.area==='undereyes'?'eye':row.step.includes('Cleanse')?'cleanser':row.step.includes('Protect')?'spf':'moisturizer';
      const checked=R.skinRows({[key]:[p]},state.a).find(r=>r.key===key)?.item;
      if(!checked)return null;
      return {...checked,step:row.step};
    }
    return R.complexionRows([p],state.a)[0]||null;
  }
  async function results(){
    const id=++requestId;state.phase='loading';state.a.budget=state.a.budget||'any';
    render('<div class="sbq-loading"><div class="sbq-spinner" aria-hidden="true"></div><p class="sbq-kicker">YOUR CLUES ARE COLLECTED</p><h2 data-quest-focus>Unlocking your discoveries…</h2><p>Reading product details. Checking the selected shades, sizes and current prices.</p><button type="button" class="sbq-inline" data-action="edit">Edit my clues</button></div>');
    try{
      let candidates=[],groups=[],missing=[],failed=false;
      if(state.path==='shade'){candidates=R.complexionRows(await loadFeed(state.a.kind),state.a);groups=candidates.map(r=>[r]);}
      else{
        const keys=state.a.area==='lips'?['balm']:state.a.area==='undereyes'?['eye']:['cleanser','moisturizer','spf'];
        const loads=await Promise.allSettled(keys.map(loadFeed));
        if(loads.every(r=>r.status==='rejected'))throw Error('shelf_unavailable');
        failed=loads.some(r=>r.status==='rejected');
        const catalogues=Object.fromEntries(keys.map((k,i)=>[k,loads[i].status==='fulfilled'?loads[i].value:[]]));
        const rows=R.skinRows(catalogues,state.a);
        candidates=rows.filter(r=>r.item).map(r=>r.item);groups=rows.filter(r=>r.item).map(r=>[r.item,...r.alternatives]);missing=rows.filter(r=>!r.item).map(r=>r.step);
      }
      if(id!==requestId)return;
      const live=await Promise.allSettled(groups.map(async group=>{
        const checked=await Promise.allSettled(group.map(refreshProduct));
        const first=checked.find(r=>r.status==='fulfilled'&&r.value);
        if(first)return first.value;
        if(checked.every(r=>r.status==='rejected'))throw Error('shelf_unavailable');
        return null;
      }));
      if(candidates.length&&live.every(r=>r.status==='rejected'))throw Error('shelf_unavailable');
      live.forEach((r,i)=>{if(r.status==='rejected'){failed=true;missing.push(candidates[i].step);}else if(!r.value)missing.push(candidates[i].step);});
      if(id!==requestId)return;
      state.rows=live.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value);state.missing=[...new Set(missing)];state.failed=failed;state.phase='results';
      try{const cart=await getJSON(route+'cart.js',6000);currency=cart.currency||currency;}catch{}
      if(id!==requestId)return;
      renderResults();analytics('complete');
    }catch(e){if(id!==requestId)return;console.warn('SOFIE Beauty Quest: shelf check failed',e.message);state.phase='error';render('<div class="sbq-loading"><p class="sbq-kicker">YOUR CLUES ARE SAFE IN THIS ROUND</p><h2 data-quest-focus>A little connection pause.</h2><p>We could not check the SOFIE shelves. Try again to see current products.</p><button type="button" class="sbq-button" data-action="retry">Try the shelves again ↗</button> <button type="button" class="sbq-inline" data-action="edit">Edit my clues</button></div>');}
  }
  function profile(){return steps[state.path].flatMap(s=>{
    const v=state.a[s.id];if(!v)return[];return(Array.isArray(v)?v:[v]).map(x=>s.opts.find(o=>o[0]===x)?.[1]).filter(Boolean);
  });}
  function advisorURL(){return 'https://wa.me/'+whatsapp+'?text='+encodeURIComponent('Hi SOFIE! I played Beauty Quest and would like help choosing a '+(state.path==='shade'?'shade':'skin-care product')+'.');}
  function card(row,index){
    const p=row.p;
    const img=safeURL(p.i,'');
    const single=row.variants.length===1 && state.path==='skin';
    const variantLabel=state.path==='shade'?'Choose a shade to try':'Choose your size or option';
    const choices=row.variants.map(v=>`<option value="${v.id}"${single?' selected':''}>${esc(v.t)} · ${money(v.p)}</option>`).join('');
    const selected=single?row.variants[0]:null;
    const url=route+'products/'+p.h+(selected?'?variant='+selected.id:'');
    return `<article class="sbq-card" data-card="${index}"><a class="sbq-card-image" href="${esc(url)}" data-product-link>${img?`<img src="${esc(img)}" alt="${esc(p.t)}" width="400" height="400" loading="lazy">`:'<span>SOFIE</span>'}</a><div class="sbq-card-body"><p class="sbq-card-step">${esc(row.step)}</p><p class="sbq-vendor">${esc(p.v)}</p><h3><a href="${esc(url)}" data-product-link>${esc(p.t)}</a></h3><p class="sbq-price" data-price>${single?money(selected.p):'From '+money(Math.min(...row.variants.map(v=>v.p)))}</p><ul class="sbq-reasons">${row.why.map(w=>'<li>'+esc(w)+'</li>').join('')}</ul>${state.path==='shade'?`<p class="sbq-variant-note">${row.shadeSuggested?'Shades to try, based on written shade descriptions.':'Formula discovery: these shade names do not include enough depth detail to verify a shade match.'}</p>`:''}<form class="sbq-card-form" data-add-form="${index}"><label for="sbq-option-${index}">${variantLabel}</label><select id="sbq-option-${index}" name="variant" data-variant="${index}" required>${single?'':`<option value="">${variantLabel}…</option>`}${choices}</select><button type="submit" class="sbq-button"${single?'':' disabled'}>Add my pick to bag +</button><p class="sbq-card-status" role="status" data-card-status></p><a class="sbq-inline" href="${esc(url)}" data-product-link>Explore this product ↗</a></form></div></article>`;
  }
  function renderResults(){
    const skinPath=state.path==='skin',area=state.a.area;
    const title=skinPath?(area==='lips'?'A little lip ritual.':area==='undereyes'?'A little eye-area care.':'Your everyday skin ritual.'):'Your colour discoveries.';
    const intro=skinPath?'A simple starting point, chosen from product details and your clues.':'A shortlist to explore. Your final shade deserves a daylight check.';
    const care=skinPath?'These are cosmetic-care suggestions, not a diagnosis or treatment plan. Follow each product label and introduce products one at a time. Persistent or painful breakouts, redness or irritation need a dermatologist.': 'Shade suggestions use your answers and written product descriptions. Screen colours and shade names cannot guarantee an exact match. Test along your jaw in daylight or ask SOFIE to help before buying.';
    const details=skinPath?(area==='lips'?'Use only as directed on the lip-care label.':area==='undereyes'?'Use only products labelled for the eye area, following their directions.':'Keep the routine simple: cleanse, moisturise and use broad-spectrum SPF 30+ in the morning. Follow the sunscreen label for application and reapplication.'):'An unknown shade description stays a formula discovery. We do not guess skin depth from a shade number.';
    const grid=state.rows.length?`<div class="sbq-result-grid">${state.rows.map(card).join('')}</div>`:`<div class="sbq-empty"><h3>No confident discovery this round.</h3><p>We could not verify a product option for all your clues today. Your budget and preferences have stayed in place.</p><p class="sbq-micro">Try different clues, or let our team help you choose.</p></div>`;
    const missing=state.missing.length?`<p style="margin-top:12px">${state.failed?'Some product checks were unavailable.':'No verified option for:'} ${esc(state.missing.join(' · '))}. We have left these steps open.</p>`:'';
    render(`<div class="sbq-results"><div class="sbq-results-head"><div><p class="sbq-kicker">QUEST COMPLETE · YOUR BEAUTY, DISCOVERED</p><h2 data-quest-focus>${title}</h2><p class="sbq-lead">${intro}</p></div><div class="sbq-seal" aria-hidden="true"><b>✧</b>BEAUTY<br>UNLOCKED</div></div><div class="sbq-profile" aria-label="Your beauty clues">${profile().map(x=>'<span class="sbq-pill">'+esc(x)+'</span>').join('')}</div><div class="sbq-result-actions"><button type="button" class="sbq-inline" data-action="edit">Edit my clues</button><button type="button" class="sbq-inline" data-action="retry">Recheck availability</button><button type="button" class="sbq-inline" data-action="save">Save this quest on my device</button></div>${grid}<div class="sbq-result-note"><strong>✧ Your final beauty clue</strong>${details}${missing}<p style="margin-top:12px">${care}</p></div><p class="sbq-micro">Available to order does not mean express local stock. Confirm delivery for your exact shade or size and address. <a href="${route}pages/shipping-policy" class="sbq-inline">Delivery details ↗</a></p><div class="sbq-result-foot"><a class="sbq-button" href="${advisorURL()}" target="_blank" rel="noopener">Ask a SOFIE beauty advisor ↗</a><a class="sbq-button sbq-button-outline" href="${route}cart">View my bag ↗</a><button type="button" class="sbq-inline" data-action="home">Play another quest</button>${window.SofiePassport?.save?'<button type="button" class="sbq-inline" data-action="passport">Save picks to Beauty Passport</button>':''}</div><p class="sbq-micro">Saving is optional. Device saves remain in this browser until you forget them. Your answers are not added to your order.</p></div>${shelf()}`);
  }
  async function add(form){
    const index=Number(form.dataset.addForm),row=state.rows[index];
    if(!row)return;
    const select=form.elements.variant,id=String(select.value),pick=row.variants.find(v=>String(v.id)===id);
    if(!pick)return;
    const button=form.querySelector('button'),note=form.querySelector('[data-card-status]');
    button.disabled=true;button.textContent='Checking your pick…';note.textContent='';
    try{
      const live=await getJSON(route+'products/'+row.p.h+'.js');
      const v=live.variants?.find(v=>String(v.id)===id);
      if(!v?.available)throw Error('This option is no longer available. Please recheck the shelves.');
      if(!R.withinBudget(Number(v.price),state.a.budget))throw Error('This option is now above your price limit. Please recheck your discoveries.');
      if(Number(v.price)!==Number(pick.p)){
        pick.p=Number(v.price);form.closest('[data-card]').querySelector('[data-price]').textContent=money(pick.p);
        select.selectedOptions[0].textContent=v.title+' · '+money(pick.p);
        throw Error('The price has changed. Check the updated price, then add again.');
      }
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),18000);
      let res;try{res=await fetch(route+'cart/add.js',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({items:[{id:Number(id),quantity:1}]}),signal:ctl.signal});}finally{clearTimeout(timer);}
      let data={};try{data=await res.json();}catch{}
      if(!res.ok)throw Error(data.description||data.message||'Your pick could not be added. Please try again.');
      note.innerHTML='Added to your bag. <a href="'+route+'cart" class="sbq-inline">View bag ↗</a>';button.textContent='Add another +';
      announce('Your beauty discovery is in your bag.');analytics('add_to_cart',id);
      try{const cart=await getJSON(route+'cart.js',5000);document.querySelectorAll('[data-cart-count]').forEach(n=>{n.textContent=cart.item_count;});}catch{}
      document.dispatchEvent(new CustomEvent('sofie:quest:cart-added',{detail:{variantId:id}}));
    }catch(e){note.textContent=e.name==='AbortError'?'The connection timed out. Check your bag before trying again.':e.message;button.textContent='Add my pick to bag +';}
    finally{button.disabled=false;}
  }
  root.addEventListener('click',async e=>{
    const b=e.target.closest('[data-action]');if(!b||!root.contains(b))return;
    const action=b.dataset.action;
    if(action==='start'){
      requestId++;state={path:b.dataset.v,index:0,a:{},phase:'question',rows:[],missing:[],failed:false};question();analytics('start');
    }else if(action==='home')home();
    else if(action==='back'){if(!state.index)home();else{state.index--;question();}}
    else if(action==='choose'){
      if(state.phase!=='question')return;
      const step=steps[state.path][state.index],v=b.dataset.v;if(!step.opts.some(o=>o[0]===v))return;
      if(step.type==='multi'){
        const values=(state.a[step.id]||[]).slice(),i=values.indexOf(v);
        if(i>=0)values.splice(i,1);else if(values.length<step.max)values.push(v);else{announce('Choose up to '+step.max+' goals. Tap a selected goal to change it.');return;}
        state.a[step.id]=values;
      }else state.a[step.id]=v;
      question();
      const again=screen.querySelector('.sbq-options [data-v="'+v+'"]');again?.focus({preventScroll:true});
    }else if(action==='next'){
      if(state.phase!=='question')return;const step=steps[state.path][state.index],v=state.a[step.id];
      if(!step.optional&&(!v||(Array.isArray(v)&&!v.length)))return;
      state.index++;question();
    }else if(action==='retry')results();
    else if(action==='edit'){requestId++;state.index=0;question();}
    else if(action==='save'){
      saved={path:state.path,a:{...state.a},at:Date.now()};
      try{localStorage.setItem('sofie-beauty-quest-v1',JSON.stringify(saved));announce('Quest saved on this device. You can revisit it here.');}catch{saved=null;announce('Your browser could not save this quest. You can still explore your picks.');}
    }else if(action==='forget'){
      try{localStorage.removeItem('sofie-beauty-quest-v1');}catch{}saved=null;home();announce('Your saved quest has been forgotten.');
    }else if(action==='resume'&&saved){
      const a={};steps[saved.path].forEach(step=>{const allowed=step.opts.map(o=>o[0]),v=saved.a[step.id];if(Array.isArray(v))a[step.id]=v.filter(x=>allowed.includes(x)).slice(0,step.max||2);else if(allowed.includes(v))a[step.id]=v;});
      state={path:saved.path,index:0,a,phase:'loading',rows:[],missing:[],failed:false};
      const missing=steps[state.path].findIndex(s=>!s.optional&&(!a[s.id]||(Array.isArray(a[s.id])&&!a[s.id].length)));
      if(missing>=0){state.index=missing;question();}else results();
    }else if(action==='passport'){
      b.disabled=true;
      try{
        const current=await window.SofiePassport.load(),existing=current.passport?.saved||[];
        const chosen=state.rows.flatMap((r,i)=>{const id=root.querySelector('[data-variant="'+i+'"]')?.value,v=r.variants.find(v=>String(v.id)===id);return v?[{handle:r.p.h,title:r.p.t,variantId:String(v.id),variantTitle:v.t}]:[];});
        if(!chosen.length)throw Error('Choose a shade or size first, then save your picks.');
        const unique=[...new Map([...existing,...chosen].map(x=>[x.handle+'|'+(x.variantId||''),x])).values()];
        await window.SofiePassport.save({saved:unique},{expectedVersion:current.version});announce('Selected picks saved to Beauty Passport.');
      }catch(e){announce(e.message||'Your picks could not be saved.');}finally{b.disabled=false;}
    }
  });
  root.addEventListener('change',e=>{
    const select=e.target.closest('[data-variant]');if(!select)return;
    const index=Number(select.dataset.variant),row=state.rows[index],v=row?.variants.find(v=>String(v.id)===String(select.value));
    const card=select.closest('[data-card]');card.querySelector('button[type=submit]').disabled=!v;
    if(v){card.querySelector('[data-price]').textContent=money(v.p);card.querySelectorAll('[data-product-link]').forEach(a=>a.href=route+'products/'+row.p.h+'?variant='+v.id);}
  });
  root.addEventListener('submit',e=>{const form=e.target.closest('[data-add-form]');if(form){e.preventDefault();add(form);}});
  root.querySelector('.sbq-wordmark').href=route;
  root.querySelector('.sbq-bag').href=route+'cart';
  home();
})();
