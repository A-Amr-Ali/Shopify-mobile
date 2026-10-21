(() => {
  'use strict';
  const host=document.querySelector('[data-quest-invite]');
  if(!host||host.dataset.initialized)return;
  host.dataset.initialized='true';
  const dialog=host.querySelector('[data-quest-popup]');
  const launcher=host.querySelector('[data-quest-reopen]');
  if(!dialog||typeof dialog.showModal!=='function')return;
  const path=(host.dataset.path||location.pathname).replace(/\/$/,'');
  if(/\/(?:cart|checkout|checkouts|account|password)(?:\/|$)/.test(path)||/\/pages\/(?:beauty-quest|sofie-beauty-room)$/.test(path)||new URLSearchParams(location.search).get('view')==='beauty-room')return;
  const key='sofie-beauty-quest-invited-v1';
  let seen=false,timer=null,opener=null;
  try{seen=sessionStorage.getItem(key)==='1';}catch{}
  const record=()=>{seen=true;try{sessionStorage.setItem(key,'1');}catch{}};
  function event(action){
    if(window.SofieJourney?.consent?.()!==true)return;
    try{window.Shopify?.analytics?.publish?.('sofie_beauty_quest_invitation',{action});}catch{}
  }
  function blocked(){
    return document.hidden||Array.from(document.querySelectorAll('dialog[open]')).some(d=>d!==dialog)||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  }
  function show(manual=false){
    if(!host.isConnected||dialog.open||(!manual&&seen))return;
    if(blocked()){if(!manual)timer=setTimeout(()=>show(),2000);return;}
    opener=document.activeElement;
    try{dialog.showModal();}catch{return;}
    record();launcher.hidden=true;event('view');
    host.querySelector('[data-quest-play]')?.focus({preventScroll:true});
  }
  function close(){if(dialog.open)dialog.close();}
  host.querySelectorAll('[data-quest-dismiss]').forEach(b=>b.addEventListener('click',close));
  host.querySelector('[data-quest-play]')?.addEventListener('click',()=>{record();event('play');});
  launcher.addEventListener('click',()=>show(true));
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();});
  dialog.addEventListener('close',()=>{record();launcher.hidden=false;event('dismiss');if(opener?.isConnected)opener.focus({preventScroll:true});});
  document.addEventListener('shopify:section:unload',e=>{if(e.target.contains(host))clearTimeout(timer);});
  window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
  if(seen)launcher.hidden=false;
  else timer=setTimeout(()=>show(),Math.min(30000,Math.max(5000,Number(host.dataset.delay)||8000)));
})();

