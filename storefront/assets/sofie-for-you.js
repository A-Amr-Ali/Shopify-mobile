(() => {
  'use strict';
  const config=document.getElementById('sf-for-you-config');
  if(!config || window.SofieForYou) return;
  const cfg=JSON.parse(config.textContent), host=document.querySelector('[data-sf-for-you]');
  const storageKey='sofie-for-you-v1', preferenceKey='sofie-for-you-consent';
  const read=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  const t=k=>cfg.strings[k]||k;
  let token=null, issuance=null, sessionId=null, active=false, generation=0, observer=null, viewTimer=null;
  const impressions=new Set();
  function allowed() {
    const p=window.Shopify?.customerPrivacy;
    return read(preferenceKey)!==false && read('sofie-measurement-consent')!==false &&
      p?.analyticsProcessingAllowed?.()===true && p?.preferencesProcessingAllowed?.()===true;
  }
  function session() {
    if(sessionId) return sessionId;
    let saved;try{saved=JSON.parse(sessionStorage.getItem('sofie-for-you-session'));}catch{}
    sessionId=saved && Date.now()-saved.at<1800000?saved.id:crypto.randomUUID();
    try{sessionStorage.setItem('sofie-for-you-session',JSON.stringify({id:sessionId,at:Date.now()}));}catch{}
    return sessionId;
  }
  async function post(path,data) {
    const r=await fetch(cfg.api+'/api/for-you/'+path,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(data),keepalive:path==='events',signal:AbortSignal.timeout(15000)});
    if(!r.ok) { if(r.status===401) {token=null;write(storageKey,null);} throw Error('recommendations_unavailable'); }
    return r.json();
  }
  async function identity() {
    if(!allowed()) return null;
    if(token) return token;
    const saved=read(storageKey);
    if(saved?.token && saved.expires>Date.now()) return token=saved.token;
    if(!issuance) {
      const started=generation;
      issuance=post('visitor',{consent:true}).then(data=>{
        if(started!==generation||!allowed()) return null;
        token=data.token;write(storageKey,{token,expires:Date.now()+data.expiresIn*1000});return token;
      }).finally(()=>{issuance=null;});
    }
    return issuance;
  }
  async function event(name,id,requestId=null) {
    if(!allowed()||!/^\d{1,20}$/.test(String(id))) return;
    const current=await identity();if(!current||!allowed())return;
    await post('events',{consent:true,token:current,sessionId:session(),events:[{
      eventId:crypto.randomUUID(),event:name,variantId:String(id),...(requestId?{requestId}:{})
    }]}).catch(()=>{});
  }
  function element(tag,className,text) { const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n; }
  function card(item,requestId) {
    if(!/^[\p{L}\p{N}\p{M}\p{S}_-]{1,200}$/u.test(item.handle)||!/^\d{1,20}$/.test(item.variantId)) return null;
    const article=element('article','sf-card sf-foryou-card');
    article.dataset.recoVariant=item.variantId;article.dataset.recoRequest=requestId;
    const url=cfg.root+'products/'+encodeURIComponent(item.handle)+'?variant='+item.variantId;
    const imageWrap=element('div','sf-card-image'), imageLink=element('a');imageLink.href=url;imageLink.tabIndex=-1;imageLink.setAttribute('aria-hidden','true');
    try {
      const src=new URL(item.image);
      if(src.protocol==='https:' && (src.hostname==='cdn.shopify.com'||src.hostname.endsWith('.shopify.com')||src.hostname==='sofiestore.net')) {
        const img=element('img');img.src=src.href;img.alt=item.title;img.loading='lazy';img.width=400;img.height=400;imageLink.append(img);
      }
    }catch{}
    imageWrap.append(imageLink);
    const info=element('div','sf-card-info');info.append(element('p','sf-vendor',item.brand));
    const heading=element('h3'),link=element('a',null,item.title);link.href=url;heading.append(link);info.append(heading);
    if(item.variantTitle && item.variantTitle!=='Default Title')info.append(element('p','sf-for-you-option',item.variantTitle));
    info.append(element('p','sf-price',new Intl.NumberFormat(cfg.locale,{style:'currency',currency:'EGP'}).format(item.price)));
    info.append(element('p','sf-for-you-reason',item.exploration?t('explore'):item.reason==='Based on your recent interests'?t('interests'):t('discover')));
    const dismiss=element('button','sf-for-you-dismiss',t('dismiss'));dismiss.type='button';dismiss.setAttribute('aria-label',t('dismiss')+': '+item.title);
    dismiss.addEventListener('click',()=>{event('dismiss',item.variantId,requestId);article.remove();});
    info.append(dismiss);article.append(imageWrap,info);
    article.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
      if(!allowed())return;
      event('click',item.variantId,requestId);
      fetch(cfg.root+'cart/update.js',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},
        body:JSON.stringify({attributes:{sofie_reco_request:requestId}})}).catch(()=>{});
    }));
    return article;
  }
  function observe() {
    observer?.disconnect();
    observer=new IntersectionObserver(entries=>{
      for(const e of entries) {
        clearTimeout(e.target.recoTimer);
        if(!e.isIntersecting||e.intersectionRatio<0.5)continue;
        e.target.recoTimer=setTimeout(()=>{
          if(!allowed()||document.hidden||!e.target.isConnected)return;
          const key=e.target.dataset.recoRequest+':'+e.target.dataset.recoVariant;
          if(!impressions.has(key)){impressions.add(key);event('impression',e.target.dataset.recoVariant,e.target.dataset.recoRequest);}
        },1000);
      }
    },{threshold:[0,0.5]});
    host?.querySelectorAll('[data-reco-variant]').forEach(n=>observer.observe(n));
  }
  async function recommend() {
    if(!host||!allowed())return;
    const current=await identity();if(!current)return;
    const started=generation;
    try {
      const data=await post('recommend',{consent:true,token:current,sessionId:session(),current:cfg.variant||null});
      if(started!==generation||!allowed()||!data.items?.length)return;
      const fragment=document.createDocumentFragment();
      for(const item of data.items) {const node=card(item,data.requestId);if(node)fragment.append(node);}
      if(fragment.childNodes.length) {
        host.querySelector('[data-for-you-items]').replaceChildren(fragment);
        host.querySelector('[data-for-you-intro]').textContent=t('intro');
        host.querySelector('[data-for-you-enable]').hidden=true;
        host.querySelector('[data-for-you-reset]').hidden=false;
        observe();
      }
    }catch{}
  }
  async function revoke() {
    const previous=token||read(storageKey)?.token;
    generation++;active=false;token=null;sessionId=null;observer?.disconnect();clearTimeout(viewTimer);
    write(storageKey,null);try{sessionStorage.removeItem('sofie-for-you-session');}catch{}
    host?.querySelectorAll('[data-reco-variant]').forEach(n=>{clearTimeout(n.recoTimer);n.remove();});
    if(host){host.querySelector('[data-for-you-enable]').hidden=false;host.querySelector('[data-for-you-reset]').hidden=true;host.querySelector('[data-for-you-intro]').textContent=t('off');}
    if(previous)await post('forget',{consent:true,token:previous}).catch(()=>{});
    fetch(cfg.root+'cart/update.js',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},
      body:JSON.stringify({attributes:{sofie_reco_request:''}})}).catch(()=>{});
  }
  function boot() {
    if(!allowed()){if(active)revoke();return;}
    if(active)return;active=true;
    identity().then(()=>{if(!allowed())return;recommend();if(cfg.variant)viewTimer=setTimeout(()=>{if(!document.hidden)event('view',cfg.variant);},4000);}).catch(()=>{active=false;});
  }
  host?.querySelector('[data-for-you-enable]').addEventListener('click',()=>{
    const p=window.Shopify?.customerPrivacy;
    if(!p?.setTrackingConsent){host.querySelector('[data-for-you-intro]').textContent=t('privacy_loading');return;}
    p.setTrackingConsent({analytics:true,preferences:true},()=>{
      write(preferenceKey,true);write('sofie-measurement-consent',true);boot();
    });
  });
  host?.querySelector('[data-for-you-reset]').addEventListener('click',()=>{write(preferenceKey,false);revoke();});
  document.addEventListener('visitorConsentCollected',boot);
  document.addEventListener('sofie:measurement',e=>{if(e.detail?.allowed===false)revoke();else boot();});
  window.addEventListener('storage',e=>{if([preferenceKey,'sofie-measurement-consent'].includes(e.key))boot();});
  document.addEventListener('sofie:journey:cart-added',e=>{for(const id of e.detail?.variantIds||[])event('cart',String(id));});
  document.addEventListener('change',e=>{if(e.target.matches('[name=id]')&&/^\d+$/.test(e.target.value)){clearTimeout(viewTimer);viewTimer=setTimeout(()=>event('view',e.target.value),4000);}});
  window.SofieForYou={refresh:recommend};
  if(window.Shopify?.loadFeatures)window.Shopify.loadFeatures([{name:'consent-tracking-api',version:'0.1'}],()=>boot());else boot();
})();
