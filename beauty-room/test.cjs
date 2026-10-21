const fs = require('node:fs');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const dom = new JSDOM(fs.readFileSync(__dirname + '/fixtures/room.html', 'utf8'), {url:'https://sofiestore.net/pages/sofie-beauty-room', runScripts:'outside-only'});
const w = dom.window;
const doc = w.document;
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
w.matchMedia = () => ({matches:false});
w.requestAnimationFrame = fn => { fn(); return 1; };
const results = [];
let addRequests = [];
let fail = false;
let release = null;
let pending = false;
w.fetch = async (url, args) => {
  if (url.endsWith('cart/add.js')) {
    addRequests.push(JSON.parse(args.body));
    if (pending) await new Promise(resolve => { release = resolve; });
    if (fail) return {ok:false, json:async () => ({description:'This option just sold out.'})};
    return {ok:true, json:async () => ({items:[{id:41007128150087}]})};
  }
  return {ok:true, json:async () => ({item_count:1})};
};
w.eval(fs.readFileSync(__dirname + '/theme/assets/sofie-beauty-room.js', 'utf8'));
const host = doc.querySelector('sofie-beauty-room');
const check = (name, fn) => { fn(); results.push({name, passed:true}); };
const open = key => host.querySelector(`[data-sfbr-open="${key}"]`).click();
const change = (select, value) => { select.value = value; select.dispatchEvent(new w.Event('change', {bubbles:true})); };
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  check('Eight real product links remain usable without JavaScript', () => {
    assert.equal(host.querySelectorAll('[data-sfbr-open]').length,8);
    assert.equal(host.querySelectorAll('[data-sfbr-bay]').length,3);
    assert.ok([...host.querySelectorAll('[data-sfbr-open]')].every(a=>a.pathname.startsWith('/products/')));
  });
  open('milk');
  let select = host.querySelector('[data-sfbr-content] select');
  let form = host.querySelector('[data-sfbr-content] form');
  check('Size or shade must be chosen before adding', () => {
    assert.equal(select.value,''); assert.equal(form.querySelector('button').disabled,true);
  });
  change(select,'41007128150087');
  check('Selected size sets its exact price and product URL', () => {
    assert.match(host.querySelector('[data-sfbr-price]').textContent,/4,450/);
    assert.equal(new URL(host.querySelector('[data-sfbr-details]').href).searchParams.get('variant'),'41007128150087');
    assert.equal(form.querySelector('button').disabled,false);
  });
  pending = true;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  check('Double submits generate only one cart request', () => {
    assert.equal(addRequests.length,1);
    assert.deepEqual(addRequests[0].items,[{id:'41007128150087',quantity:1}]);
  });
  pending = false; release(); await tick(); await tick();
  check('Successful cart add exposes bag link and updates count', () => {
    assert.equal(form.querySelector('[data-sfbr-view-bag]').hidden,false);
    assert.match(form.querySelector('[data-sfbr-status]').textContent,/added/);
    assert.equal(host.querySelector('[data-sfbr-cart-count]').textContent,'1');
  });
  fail = true;
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await tick(); await tick();
  check('Inventory rejection is visible and the form recovers', () => {
    assert.equal(form.querySelector('[data-sfbr-status]').textContent,'This option just sold out.');
    assert.equal(form.querySelector('button').disabled,false);
    assert.equal(select.disabled,false);
  });
  host.querySelector('[data-sfbr-close]').click();
  check('Closing restores focus to the selected product', () => {
    assert.equal(host.querySelector('[data-sfbr-dialog]').open,false);
    assert.equal(doc.activeElement.dataset.sfbrOpen,'milk');
  });
  const unavailable = [...host.querySelectorAll('template')].flatMap(t=>[...t.content.querySelectorAll('option[value]')]).find(o=>o.value&&o.disabled);
  if (unavailable) {
    const template = [...host.querySelectorAll('template')].find(t=>t.content.querySelector(`option[value="${unavailable.value}"]`));
    open(template.dataset.sfbrProduct); select=host.querySelector('[data-sfbr-content] select');
    change(select,unavailable.value);
    check('Sold-out variants cannot be added',()=>assert.equal(host.querySelector('[data-sfbr-content] [type="submit"]').disabled,true));
  }
  host.querySelector('[data-sfbr-dialog]').close();
  w.matchMedia = query => ({matches:query === '(hover: none)'});
  open('pocket');
  check('A touch first reveals a short product card', () => {
    assert.equal(host.querySelector('[data-sfbr-dialog]').open,false);
    assert.equal(host.querySelector('[data-sfbr-open="pocket"]').closest('.sfbr-piece').classList.contains('is-peek'),true);
  });
  host.querySelector('[data-sfbr-peek-open="pocket"]').click();
  check('Touch card opens the correct product options', () => {
    assert.equal(host.querySelector('[data-sfbr-dialog]').open,true);
    assert.equal(host.querySelector('[data-sfbr-content] form').dataset.handle,'pocket-blush');
  });
  check('Four distinct product characters move without a pause control', () => {
    const guides=[...host.querySelectorAll('[data-sfbr-mascot]')];
    assert.equal(guides.length,4);
    assert.equal(host.querySelector('[data-sfbr-motion]'),null);
    assert.equal(new Set(guides.map(g=>g.querySelector('img').src)).size,4);
    assert.ok(guides.some(g=>g.classList.contains('sfbr-mini-guide--pocket')));
    const css=fs.readFileSync(__dirname+'/theme/assets/sofie-beauty-room.css','utf8');
    assert.ok(!css.includes('animation-play-state:paused'));
  });
  check('All eight beauty departments link to real collections', () => {
    const links=[...host.querySelectorAll('.sfbr-department-links a')];
    assert.equal(links.length,8);
    assert.ok(links.every(a=>a.pathname.startsWith('/collections/')));
  });
  check('All eight shelf products use isolated assets and short notes', () => {
    const images=[...host.querySelectorAll('.sfbr-piece-image img')];
    assert.equal(images.length,8);
    assert.ok(images.every(image=>image.src.includes('sofie-beauty-room-')));
    assert.equal(host.querySelectorAll('.sfbr-peek p').length,8);
    assert.ok([...host.querySelectorAll('.sfbr-peek p')].every(p=>p.textContent.length>3&&!p.textContent.includes('translation missing')));
  });
  const file = __dirname + '/test-results.json';
  fs.writeFileSync(file,JSON.stringify({passed:results.length,checks:results},null,2)+'\n');
  console.log(JSON.stringify({passed:results.length,checks:results.map(x=>x.name)}));
  w.close();
})().catch(error => {console.error(error);w.close();process.exitCode=1;});
