const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(process.env.QUEST_PROMO_JS||path.join(__dirname,'theme/assets/sofie-quest-promo.js'),'utf8');
const passes=[];
function check(name,fn){fn();passes.push(name);}
function setup({url='https://sofiestore.net/products/example',seen=false,other=false,input=false,support=true}={}){
 const dom=new JSDOM(`<button id="before">Shop</button>${other?'<dialog id="other" open></dialog>':''}<input id="email"><div data-quest-invite data-delay="8000"><dialog data-quest-popup><button data-quest-dismiss>Close</button><a data-quest-play href="/pages/beauty-quest?utm_source=sofie_storefront&utm_medium=popup&utm_campaign=beauty_quest">Play</a><button data-quest-dismiss>Later</button></dialog><button data-quest-reopen hidden>Beauty Quest</button></div>`,{url,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,timers=[];
 w.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;};w.clearTimeout=()=>{};
 const popup=d.querySelector('[data-quest-popup]');
 if(support){popup.showModal=()=>popup.setAttribute('open','');popup.close=()=>{popup.removeAttribute('open');popup.dispatchEvent(new w.Event('close'));};}
 if(seen)w.sessionStorage.setItem('sofie-beauty-quest-invited-v1','1');
 if(input)d.querySelector('input').focus();else d.querySelector('#before').focus();
 w.eval(source);return{w,d,popup,timers,run(){const job=timers.shift();if(job)job.fn();},close:()=>w.close()};
}
{
 const x=setup();
 check('New visitors get an eight-second invitation delay',()=>{assert.equal(x.popup.open,false);assert.equal(x.timers[0].ms,8000);});
 x.run();
 check('The popup opens and focuses the play link',()=>{assert.equal(x.popup.open,true);assert.equal(x.d.activeElement.hasAttribute('data-quest-play'),true);});
 check('Displaying the invitation marks this session as seen',()=>assert.equal(x.w.sessionStorage.getItem('sofie-beauty-quest-invited-v1'),'1'));
 x.d.querySelector('[data-quest-dismiss]').click();
 check('Dismissal closes the popup, restores focus and exposes a reopen button',()=>{assert.equal(x.popup.open,false);assert.equal(x.d.activeElement.id,'before');assert.equal(x.d.querySelector('[data-quest-reopen]').hidden,false);});
 x.d.querySelector('[data-quest-reopen]').click();
 check('Customers can deliberately reopen the invitation',()=>assert.equal(x.popup.open,true));x.close();
}
{
 const x=setup({seen:true});check('Navigating in the same session does not trigger another automatic popup',()=>{assert.equal(x.timers.length,0);assert.equal(x.d.querySelector('[data-quest-reopen]').hidden,false);});x.close();
}
{
 const x=setup({other:true});x.run();check('Another open dialog postpones the invitation',()=>{assert.equal(x.popup.open,false);assert.equal(x.timers[0].ms,2000);});x.d.querySelector('#other').removeAttribute('open');x.run();check('The invitation resumes after another dialog closes',()=>assert.equal(x.popup.open,true));x.close();
}
{
 const x=setup({input:true});x.run();check('Typing in a field postpones the invitation',()=>assert.equal(x.popup.open,false));x.d.querySelector('input').blur();x.run();check('The invitation can open after the shopper leaves the field',()=>assert.equal(x.popup.open,true));x.close();
}
for(const [name,url] of [['cart','https://sofiestore.net/cart'],['account','https://sofiestore.net/account/orders'],['game','https://sofiestore.net/pages/beauty-quest']]){const x=setup({url});check('No invitation on the '+name+' page',()=>assert.equal(x.timers.length,0));x.close();}
{
 const x=setup({support:false});check('Unsupported dialog browsers fail without disrupting the store',()=>assert.equal(x.timers.length,0));x.close();
}
const result={status:'passed',checks:passes.length,passes};fs.writeFileSync(path.join(__dirname,'test-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
