(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const fmt=(n,locale='en')=>Number(n||0).toLocaleString(locale==='ar'?'ar-EG':'en-EG');
  async function api(url,body){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||d.error){const e=new Error(d.error||'error');e.data=d;throw e;}return d;}
  function productPoints(root){
    const parent=root.closest('[data-product]');if(!parent)return;
    let rules={divisor:10,multiplier:1};
    const title=$('[data-points-estimate]',root),note=$('[data-points-note]',root);
    const variants=JSON.parse($('[data-variants]',parent)?.textContent||'[]');
    function render(){
      const currency=root.dataset.currency;
      if(currency!=='EGP'){title.textContent=root.dataset.currencyNote;note.hidden=true;return;}
      if(root.dataset.giftCard==='true'){title.textContent=root.dataset.giftNote;note.hidden=true;return;}
      const id=$('[name="id"]',parent)?.value,variant=variants.find(v=>String(v.id)===String(id))||variants[0];
      if(!variant)return;
      if(!variant.available){title.textContent=root.dataset.unavailable;note.hidden=true;return;}
      const q=Number($('[name="quantity"]',parent)?.value||1);
      const points=Number.isSafeInteger(q)&&q>0?Math.floor(Math.floor(Math.round(variant.price*q/100)/rules.divisor)*rules.multiplier):0;
      title.textContent=root.dataset.earn.replace('[points]',fmt(points,document.documentElement.lang));
      note.textContent=root.dataset.note;note.hidden=false;
    }
    parent.addEventListener('change',render);parent.addEventListener('input',render);document.addEventListener('variant:change',render);render();
    api(root.dataset.proxy+'/rewards?view=estimate').then(data=>{rules=data.rules||rules;render();}).catch(()=>{});
  }
  document.querySelectorAll('[data-rewards-product]').forEach(productPoints);
  const hub=$('[data-rewards-hub]');if(!hub)return;
  const base=hub.dataset.proxy,locale=hub.dataset.locale,strings=JSON.parse($('[data-rewards-strings]',hub).textContent);
  const t=k=>strings[k]||strings.error;let state=null,busy=false;
  const message=(text,error=false)=>{const n=$('[data-rewards-message]',hub);if(n){n.textContent=text;n.classList.toggle('is-error',error);}};
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,click)=>{const b=node('button',text);b.type='button';b.addEventListener('click',click);return b;};
  async function perform(fn){if(busy)return;busy=true;hub.querySelectorAll('button').forEach(b=>b.disabled=true);message(t('loading'));try{await fn();await load();}catch(e){message(strings[e.message]||t('error'),true);await load(false).catch(()=>{});}finally{busy=false;render();}}
  function codeCard(code,label,expires){
    const box=node('div',null,'sfr-code');box.append(node('strong',label),node('code',code));
    const link=node('a',t('apply_code'));link.href=hub.dataset.root+'discount/'+encodeURIComponent(code)+'?redirect='+encodeURIComponent('/cart');box.append(link);
    box.append(button(t('copy'),async e=>{try{await navigator.clipboard.writeText(code);e.target.textContent=t('copied');}catch{message(code);}}));
    if(expires)box.append(node('p',t('expires')+' '+new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(expires))));return box;
  }
  function renderBirthday(){
    const form=$('[data-birthday-form]',hub),status=$('[data-birthday-status]',hub),optout=$('[data-birthday-opt-out]',hub);status.replaceChildren();
    form.hidden=!!state.birthdayOptIn;optout.hidden=!state.birthdayOptIn;
    if(state.birthday){const [m,d]=state.birthday.split('-');form.elements.month.value=Number(m);form.elements.day.value=Number(d);status.append(node('p',t('birthday_saved')+' '+Number(d)+' / '+Number(m)));}
    const grant=state.birthdayGrant,window=state.birthdayWindow;
    if(grant?.status==='issued_online'&&grant.code&&new Date(grant.expires_at)>new Date()){status.append(codeCard(grant.code,t('birthday_online'),grant.expires_at));return;}
    if(['issued_store','used_online'].includes(grant?.status)&&grant.year===window.year){status.append(node('p',t('birthday_used')));return;}
    if(state.birthdayOptIn&&window.eligible){
      if(grant?.year===window.year&&grant.channel==='store')return;
      status.append(node('p',t('birthday_ready').replace('[value]',fmt(grant?.year===window.year?grant.egp_value:state.rules.birthdayValues[state.tier],locale))));
      const claim=button(t('birthday_online'),()=>perform(async()=>{const d=await api(base+'/birthday',{action:'claim_online'});message(t('birthday_online')+' '+d.code);}));claim.disabled=busy;status.append(claim);
    }
  }
  async function redeem(pointsCost,requestId){
    const key='sofieRewardPending:'+state.memberId;
    const saved={pointsCost,requestId:requestId||crypto.randomUUID()};sessionStorage.setItem(key,JSON.stringify(saved));
    const result=await api(base+'/redeem',saved);sessionStorage.removeItem(key);message(t('online_code')+' '+result.code);
  }
  function render(){
    if(!state||!state.loggedIn||!$('[data-rewards-balance]',hub))return;
    $('[data-rewards-balance]',hub).textContent=fmt(state.balance,locale);$('[data-member-tier]',hub).textContent={insider:'Insider',vip:'VIP',icon:'Icon'}[state.tier]||state.tier;
    $('[data-member-id]',hub).textContent=state.memberId;const p=state.progress;
    $('[data-tier-progress]',hub).textContent=p.next?t('next_tier').replace('[value]',fmt(p.toNextEgp,locale)).replace('[tier]',p.next.label):t('top_tier');$('[data-tier-bar]',hub).value=p.pct;
    const options=$('[data-reward-options]',hub);options.replaceChildren();
    state.rules.rewards.forEach(r=>{const b=button('',()=>{if(window.confirm(t('confirm_redeem').replace('[points]',fmt(r.pointsCost,locale)).replace('[value]',fmt(r.egpValue,locale))))perform(()=>redeem(r.pointsCost));});b.append(node('strong',fmt(r.egpValue,locale)+' EGP '+t('off')),node('small',fmt(r.pointsCost,locale)+' '+t('points')),node('span',t('redeem_online')));b.disabled=busy||state.balance<r.pointsCost;options.append(b);});
    renderBirthday();
    const wallet=$('[data-reward-wallet]',hub);wallet.replaceChildren();
    (state.redemptions||[]).forEach(r=>{if(r.channel==='store'){wallet.append(node('p',t('store_reward')+' '+fmt(r.egp_value,locale)+' EGP · '+r.discount_code));return;}if(r.status==='pending'){const card=node('div',null,'sfr-code');card.append(node('p',t('pending')));const retry=button(t('retry'),()=>perform(()=>redeem(r.points_spent,r.request_key?.split(':').pop())));retry.disabled=busy;card.append(retry);wallet.append(card);}else if(r.discount_code)wallet.append(codeCard(r.discount_code,t('online_code')));});
    if(!wallet.childElementCount)wallet.append(node('p',t('no_rewards')));
    const activity=$('[data-rewards-activity]',hub);activity.replaceChildren();const list=node('ul');
    (state.activity||[]).forEach(a=>{const row=node('li');row.append(node('span',new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeZone:'Africa/Cairo'}).format(new Date(a.created_at))+' · '+a.reason.replaceAll('_',' ')),node('strong',(a.delta>0?'+':'')+fmt(a.delta,locale)+' '+t('points')));list.append(row);});activity.append(list);
    hub.querySelectorAll('button').forEach(b=>{if(!b.closest('[data-reward-options]'))b.disabled=busy;});
  }
  async function load(showError=true){try{state=await api(base+'/rewards');render();}catch(e){if(showError)message(t('error'),true);throw e;}}
  const form=$('[data-birthday-form]',hub);
  if(form){
    Array.from(form.elements.month.options).forEach(o=>{if(o.value)o.textContent=new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en-GB',{month:'long'}).format(new Date(2000,Number(o.value)-1,1));});
    form.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;perform(async()=>{await api(base+'/birthday',{month:Number(form.elements.month.value),day:Number(form.elements.day.value),consent:form.elements.consent.checked});message(t('saved'));});});
    $('[data-birthday-opt-out]',hub).addEventListener('click',()=>perform(async()=>{await api(base+'/birthday',{action:'opt_out'});message(t('birthday_opted_out'));}));
    load().catch(()=>{});
  }
})();
