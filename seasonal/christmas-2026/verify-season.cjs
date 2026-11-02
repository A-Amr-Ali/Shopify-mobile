const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { Liquid } = require('liquidjs');

const theme = path.join(__dirname, 'theme');
const START = Date.parse('2026-11-02T00:00:00+02:00');
const END = Date.parse('2027-01-08T00:00:00+02:00');
const ACTIVE = Date.parse('2026-12-20T12:00:00+02:00');
const script = fs.readFileSync(path.join(theme, 'assets/sofie-christmas-2026.js'), 'utf8');
const parseJson = filename => { const text = fs.readFileSync(filename, 'utf8'); return JSON.parse(text.slice(text.indexOf('{'))); };
const en = parseJson(path.join(theme, 'locales/en.default.json'));
const ar = parseJson(path.join(theme, 'locales/ar.json'));
let checks = 0;
function check(name, fn) { fn(); checks += 1; console.log(`PASS ${name}`); }

function runtime(options = {}) {
  const { window, document } = parseHTML('<html><head><link id="sf-christmas-styles"></head><body><script id="sf-christmas-config" type="application/json"></script><span data-sf-festive id="logo"></span><div data-sf-festive data-sf-festive-snow></div><div data-sf-festive><button data-sf-festive-toggle aria-pressed="false"><span data-sf-festive-toggle-label></span></button></div><main><button id="buy">Buy</button></main></body></html>');
  delete window.sfChristmas2026;
  let now = options.now ?? ACTIVE;
  const config = { startsAt: START, expiresAt: END, snow: options.snow !== false, strings: { pause: 'Pause effects', resume: 'Resume effects', reduced: 'Motion reduced' } };
  document.getElementById('sf-christmas-config').textContent = JSON.stringify(config);
  const motion = { matches: !!options.reduced, addEventListener(type, callback) { this.onChange = callback; } };
  const timers = new Map();
  let id = 0;
  const storage = new Map(options.paused ? [['sofie-christmas-motion-2026', 'paused']] : []);
  window.setTimeout = (callback, delay) => { timers.set(++id, { callback, delay }); return id; };
  window.clearTimeout = timer => timers.delete(timer);
  window.matchMedia = query => query.includes('prefers-reduced') ? motion : { matches: !!options.mobile };
  const navigator = { connection: { saveData: !!options.saveData } };
  const localStorage = { getItem(key) { if (options.storageThrows) throw Error('Storage blocked'); return storage.get(key) || null; }, setItem(key, value) { if (options.storageThrows) throw Error('Storage blocked'); storage.set(key, value); } };
  const FakeDate = class extends Date { static now() { return now; } };
  const context = { window, document, navigator, localStorage, Date: FakeDate, Element: window.Element, AbortController, console };
  vm.runInNewContext(script, context);
  return { window, document, timers, motion, storage, config, setNow(value) { now = value; }, click() { document.querySelector('[data-sf-festive-toggle]').dispatchEvent(new window.Event('click', { bubbles: true })); } };
}

async function main() {
  check('Cairo cutoff is exactly 7 January 2027 at 22:00 UTC', () => assert.equal(END, 1799359200000));
  check('Desktop snow is bounded at 24 flakes', () => assert.equal(runtime().document.querySelectorAll('.sf-xmas-flake').length, 24));
  check('Mobile snow is bounded at 12 flakes', () => assert.equal(runtime({ mobile: true }).document.querySelectorAll('.sf-xmas-flake').length, 12));
  check('Pause and resume update controls and persisted preference', () => {
    const r = runtime(); r.click(); assert.equal(r.document.documentElement.getAttribute('data-sf-christmas-motion'), 'paused');
    assert.equal(r.storage.get('sofie-christmas-motion-2026'), 'paused'); assert.equal(r.document.querySelector('button').getAttribute('aria-pressed'), 'true');
    r.click(); assert.equal(r.document.documentElement.getAttribute('data-sf-christmas-motion'), 'running'); assert.equal(r.document.querySelectorAll('.sf-xmas-flake').length, 24);
  });
  check('A saved pause does not create snow until resumed', () => { const r = runtime({ paused: true }); assert.equal(r.document.querySelectorAll('.sf-xmas-flake').length, 0); r.click(); assert.equal(r.document.querySelectorAll('.sf-xmas-flake').length, 24); });
  check('Reduced motion prevents snow and disables animation control', () => { const r = runtime({ reduced: true }); assert.equal(r.document.querySelectorAll('.sf-xmas-flake').length, 0); assert.equal(r.document.documentElement.getAttribute('data-sf-christmas-motion'), 'paused'); assert.equal(r.document.querySelector('button').disabled, true); });
  check('Turning reduced motion on pauses an existing scene', () => { const r = runtime(); r.motion.matches = true; r.motion.onChange(); assert.equal(r.document.documentElement.getAttribute('data-sf-christmas-motion'), 'paused'); });
  check('Data saver and merchant snow toggle suppress snowfall', () => { assert.equal(runtime({ saveData: true }).document.querySelectorAll('.sf-xmas-flake').length, 0); assert.equal(runtime({ snow: false }).document.querySelectorAll('.sf-xmas-flake').length, 0); });
  check('Blocked local storage does not interrupt shopping or the layer', () => { const r = runtime({ storageThrows: true }); r.click(); assert.ok(r.document.getElementById('buy')); assert.equal(r.document.documentElement.getAttribute('data-sf-christmas-motion'), 'paused'); });
  check('An already-open tab removes all seasonal fragments at cutoff', () => { const r = runtime({ now: END - 500 }); assert.equal([...r.timers.values()][0].delay, 500); r.setNow(END); [...r.timers.values()][0].callback(); assert.equal(r.document.querySelectorAll('[data-sf-festive]').length, 0); assert.equal(r.document.documentElement.getAttribute('data-sf-christmas'), null); assert.equal(r.document.getElementById('sf-christmas-styles'), null); assert.equal(r.timers.size, 0); assert.ok(r.document.getElementById('buy')); });
  check('Before-season and post-season cached pages stay undecorated', () => { for (const now of [START - 1, END, END + 86400000]) { const r = runtime({ now }); assert.equal(r.document.querySelectorAll('[data-sf-festive]').length, 0); assert.equal(r.timers.size, 0); assert.ok(r.document.getElementById('buy')); } });
  check('English and Arabic seasonal translation keys match', () => assert.deepEqual(Object.keys(en.sf.christmas).sort(), Object.keys(ar.sf.christmas).sort()));

  const engine = new Liquid({ root: path.join(theme, 'snippets'), extname: '.liquid' });
  engine.registerTag('doc', { parse(token, tokens) { while (tokens.length) { const next = tokens.shift(); if (next.name === 'enddoc') break; } }, render() { return ''; } });
  engine.registerFilter('t', key => key.split('.').reduce((value, name) => value?.[name], en) || key);
  engine.registerFilter('asset_url', key => `/assets/${key}`);
  engine.registerFilter('json', value => JSON.stringify(value));
  let liquidNow = ACTIVE;
  engine.registerFilter('date', (value, format) => value === 'now' && format === '%s' ? String(Math.floor(liquidNow / 1000)) : value);
  const source = fs.readFileSync(path.join(theme, 'snippets/sofie-christmas-2026.liquid'), 'utf8');
  const base = { settings: {}, request: { page_type: 'index' }, routes: { collections_url: '/collections' }, collections: { 'value-gift-sets': { url: '/collections/value-gift-sets', products_count: 3 }, 'mini-size': { url: '/collections/mini-size', products_count: 2 } } };
  for (const placement of ['head', 'body', 'logo', 'footer']) {
    liquidNow = ACTIVE;
    const active = await engine.parseAndRender(source, { ...base, placement });
    check(`Liquid ${placement} renders during the season`, () => assert.ok(active.trim().length > 40));
    liquidNow = END;
    const ended = await engine.parseAndRender(source, { ...base, placement });
    check(`Liquid ${placement} emits no markup or asset requests at cutoff`, () => assert.equal(ended.trim(), ''));
    liquidNow = ACTIVE;
    const disabled = await engine.parseAndRender(source, { ...base, placement, settings: { sf_christmas_enabled: false } });
    check(`Merchant switch disables ${placement}`, () => assert.equal(disabled.trim(), ''));
  }
  liquidNow = ACTIVE;
  const product = await engine.parseAndRender(source, { ...base, placement: 'body', request: { page_type: 'product' } });
  check('Product pages get snow and controls without a homepage hero', () => { assert.ok(product.includes('data-sf-festive-snow')); assert.ok(product.includes('data-sf-festive-toggle')); assert.ok(!product.includes('sf-xmas-title')); });
  const empty = await engine.parseAndRender(source, { ...base, placement: 'body', collections: {} });
  check('Missing gift collections fall back to the full catalog', () => { assert.ok(empty.includes('href="/collections/all"')); assert.ok(!empty.includes('href=""')); });
  const head = await engine.parseAndRender(source, { ...base, placement: 'head', settings: { sf_christmas_snow: false } });
  check('Liquid configuration uses the same dates as the browser and merchant toggle', () => { const config = JSON.parse(head.match(/id="sf-christmas-config" type="application\/json">([\s\S]+?)<\/script>/)[1]); assert.equal(config.expiresAt, END); assert.equal(config.startsAt, START); assert.equal(config.snow, false); });
  console.log(`${checks} seasonal checks passed.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
