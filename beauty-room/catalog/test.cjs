const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync(__dirname+'/fixtures/first.html','utf8'),{url:'https://sofiestore.net/pages/sofie-beauty-room',runScripts:'outside-only'}),w=dom.window,d=w.document;
w.matchMedia=()=>({matches:false});w.requestAnimationFrame=fn=>{fn();return 1;};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
let renderCalls=0;w.SofieRoomCutouts={observe:()=>({add(){renderCalls++;},disconnect(){}})};
let response=fs.readFileSync(__dirname+'/fixtures/next.html','utf8'),requests=0,fail=false,release;
w.fetch=async()=>{requests++;await new Promise(resolve=>{release=resolve;});return {ok:!fail,text:async()=>response};};
w.eval(fs.readFileSync(__dirname+'/../theme/assets/sofie-beauty-room.js','utf8'));
const host=d.querySelector('sofie-beauty-room'),checks=[],check=(name,fn)=>{fn();checks.push({name,passed:true});};
(async()=>{
 check('Full catalog and 23 native brand destinations replace the fixed eight-product limit',()=>{
  assert.ok(Number(host.dataset.sfbrTotal)>1400);assert.equal(host.querySelectorAll('[data-sfbr-open]').length,12);
  const links=[...host.querySelectorAll('.sfbr-brand-options a')].slice(1);assert.equal(links.length,23);
  assert.ok(links.every(a=>new URL(a.href).searchParams.get('view')==='beauty-room'));
  assert.ok([...host.querySelectorAll('.sfbr-page-numbers a')].some(a=>Number(a.textContent)>100));
 });
 const oldGuides=[...host.querySelectorAll('[data-sfbr-mascot]')],oldIds=[...host.querySelectorAll('[data-sfbr-open]')].map(a=>a.dataset.sfbrOpen),firstLink=host.querySelector('[data-sfbr-load]');
 const pending=host.loadShelves(firstLink);host.loadShelves(firstLink);
 check('Repeated loading is guarded until the first request completes',()=>{assert.equal(requests,1);assert.equal(firstLink.getAttribute('aria-busy'),'true');});
 release();await pending;
 check('The next twelve real products append without duplicates and keep native pagination',()=>{
  const ids=[...host.querySelectorAll('[data-sfbr-open]')].map(a=>a.dataset.sfbrOpen);assert.equal(ids.length,24);assert.equal(new Set(ids).size,24);assert.deepEqual(ids.slice(0,12),oldIds);
  assert.equal(host.querySelector('[data-sfbr-range-end]').textContent,'24');assert.equal(new URL(host.querySelector('[data-sfbr-load]').href).searchParams.get('page'),'3');
 });
 check('Existing characters keep their DOM nodes while new shelves receive characters and image processing',()=>{
  assert.ok(oldGuides.every(g=>g.isConnected));assert.equal(host.querySelectorAll('[data-sfbr-mascot]').length,8);assert.equal(renderCalls,1);
 });
 const newProduct=host.querySelectorAll('[data-sfbr-open]')[12];newProduct.click();
 check('An appended product opens its own live variant form and preserves exact variant links',()=>{
  const source=host.querySelector(`[data-sfbr-product="${newProduct.dataset.sfbrOpen}"]`),content=host.querySelector('[data-sfbr-content]');
  assert.equal(content.querySelector('form').dataset.handle,source.content.querySelector('form').dataset.handle);
  const select=content.querySelector('select'),option=[...select.options].find(o=>o.value&&o.dataset.available==='true');assert.ok(option);select.value=option.value;select.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(content.querySelector('[type="submit"]').disabled,false);assert.equal(new URL(content.querySelector('[data-sfbr-details]').href).searchParams.get('variant'),option.value);
 });
 host.querySelector('[data-sfbr-dialog]').close();fail=true;const failing=host.querySelector('[data-sfbr-load]'),failed=host.loadShelves(failing);release();await failed;
 check('A network error preserves products and offers the real next page as a fallback',()=>{
  assert.equal(host.querySelectorAll('[data-sfbr-open]').length,24);assert.equal(failing.dataset.sfbrNative,'true');assert.equal(host.querySelector('[data-sfbr-load-status]').textContent,host.dataset.loadError);assert.equal(failing.hasAttribute('aria-busy'),false);
  const event=new w.MouseEvent('click',{bubbles:true,cancelable:true});Object.defineProperty(event,'target',{value:failing});host.onClick(event);assert.equal(event.defaultPrevented,false);
 });
 const modified=new w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});firstLink.dataset.sfbrNative='';
 Object.defineProperty(modified,'target',{value:host.querySelector('[data-sfbr-load]')});host.onClick(modified);
 check('Modified clicks keep normal browser navigation',()=>assert.equal(modified.defaultPrevented,false));
 fs.writeFileSync(__dirname+'/test-results.json',JSON.stringify({passed:checks.length,checks},null,2)+'\n');console.log(JSON.stringify({passed:checks.length,checks:checks.map(c=>c.name)}));w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
