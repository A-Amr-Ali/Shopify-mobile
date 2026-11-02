const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Liquid } = require('liquidjs');

const theme = path.join(__dirname, 'theme');
const engine = new Liquid({ root: path.join(theme, 'snippets'), extname: '.liquid' });
for (const name of ['doc', 'stylesheet']) engine.registerTag(name, {
  parse(token, tokens) { while (tokens.length && tokens.shift().name !== 'end' + name) {} },
  render() { return ''; }
});
const localeText = fs.readFileSync(path.join(theme, 'locales/en.default.json'), 'utf8');
const locale = JSON.parse(localeText.slice(localeText.indexOf('{')));
engine.registerFilter('money', n => 'LE ' + (n / 100).toFixed(2));
engine.registerFilter('t', (key, ...args) => {
  let text = key.split('.').reduce((v, k) => v?.[k], locale) || key;
  for (const [k, v] of args) text = text.replaceAll('{{ ' + k + ' }}', String(v));
  return text;
});
engine.registerFilter('date', () => '1793610000');
engine.registerFilter('image_url', image => image?.src || '/gift.webp');
engine.registerFilter('image_tag', url => '<img src="' + url + '" alt="">');

function fixture() {
  const components = [11, 22].map(id => {
    const product = { collections: [{ handle: 'sofie-hours' }], variants: [], metafields: { custom: {} } };
    const v = { id, available: true, inventory_quantity: 3, image: { src: '/original-' + id + '.webp' }, product };
    product.variants.push(v);
    return v;
  });
  const parent = { id: 100, available: true, inventory_quantity: 3, price: 439000, compare_at_price: 485000 };
  const product = { tags: ['sofie-curated-bundle'], has_only_default_variant: true, featured_image: { src: '/bundle-box.webp' }, variants: [parent], collections: [],
    metafields: { custom: { sofie_bundle_components: { value: components }, sofie_bundle_quantities: { value: { '11': 1, '22': 1 } } } } };
  return { product, parent, components };
}
const ready = context => engine.renderFile('sf-now-ready', { settings: {}, ...context }).then(s => s.trim());
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS ' + name); }

async function main() {
  await check('A bundle inherits NOW from every component without changing the NOW collection', async () => {
    const f = fixture(); assert.equal(await ready(f), ',100,'); assert.equal(f.product.collections.length, 0);
  });
  await check('A component outside the NOW collection removes eligibility', async () => {
    const f = fixture(); f.components[1].product.collections = []; assert.equal(await ready(f), '');
  });
  await check('Continue selling does not make an out-of-stock component ready', async () => {
    const f = fixture(); f.components[1].inventory_quantity = 0; f.components[1].inventory_policy = 'continue'; assert.equal(await ready(f), '');
  });
  await check('An exact option excluded by a valid NOW option list is rejected', async () => {
    const f = fixture(); const other = { id: 23, available: true, inventory_quantity: 3 };
    f.components[1].product.variants.push(other);
    f.components[1].product.metafields.custom.sofie_hours_variants = { value: [other] };
    assert.equal(await ready(f), '');
  });
  await check('Requested quantity and per-bundle component quantities must fit stock', async () => {
    const f = fixture(); assert.equal(await ready({ ...f, quantity: 4 }), '');
    f.components[0].inventory_quantity = 1;
    f.product.metafields.custom.sofie_bundle_quantities.value['11'] = 2;
    assert.equal(await ready(f), '');
  });
  await check('Missing component references fail closed', async () => {
    const f = fixture(); f.components.pop(); assert.equal(await ready(f), '');
  });
  await check('Two bundles sharing a component cannot both promise unavailable stock', async () => {
    const f = fixture(); const g = fixture(); f.components[0].inventory_quantity = 1;
    const bag = { items: [{ product: f.product, variant: f.parent, quantity: 1 }, { product: g.product, variant: { id: 200 }, quantity: 1 }] };
    assert.equal(await ready({ ...f, quantity: 1, bag }), '');
  });
  await check('Loose products and bundles share the same component stock', async () => {
    const f = fixture(); f.components[0].inventory_quantity = 1;
    const bag = { items: [{ product: f.product, variant: f.parent, quantity: 1 }, { product: f.components[0].product, variant: f.components[0], quantity: 1 }] };
    assert.equal(await ready({ ...f, quantity: 1, bag }), '');
  });
  await check('Existing individual-product NOW collection behaviour is preserved', async () => {
    const f = fixture(); assert.equal(await ready({ product: f.components[0].product }), ',11,');
    f.components[0].product.collections = []; assert.equal(await ready({ product: f.components[0].product }), '');
  });
  await check('Bundle savings include the exact amount and a separate-purchase basis', async () => {
    const f = fixture(); const html = await engine.renderFile('sf-bundle-savings', { product: f.product, variant: f.parent });
    assert.ok(html.includes('LE 460.00')); assert.ok(html.includes('Compared with buying these products separately'));
  });
  await check('The Christmas ribbon, hero CTA and nested gift card use the new collection', async () => {
    const gift = { handle: 'christmas-at-sofie-gift-bundles', url: '/collections/christmas-at-sofie-gift-bundles', products_count: 6, image: {}, products: [{ price: 439000 }] };
    const html = await engine.renderFile('sofie-christmas-2026', { placement: 'body', settings: {}, routes: { collections_url: '/collections' }, request: { page_type: 'index' }, collections: { 'christmas-at-sofie-gift-bundles': gift } });
    assert.equal((html.match(/href="\/collections\/christmas-at-sofie-gift-bundles"/g) || []).length, 3);
    assert.ok(html.includes('data-sf-gift-bundles')); assert.ok(html.includes('Six thoughtful beauty gifts')); assert.ok(html.includes('LE 4390.00'));
  });
  const homeFixture = () => {
    const f = fixture();
    return { handle: 'home-meets-beauty-christmas-gift-bundles', url: '/collections/home-meets-beauty-christmas-gift-bundles', products_count: 12, image: { alt: 'Home and beauty gifts' }, products: [f.product] };
  };
  const renderWorld = (pageType, pageHandle, gifts) => engine.renderFile('sofie-christmas-2026', {
    placement: 'body', settings: {}, routes: { collections_url: '/collections' },
    request: { page_type: pageType }, page: { handle: pageHandle },
    collections: gifts ? { 'home-meets-beauty-christmas-gift-bundles': gifts } : {}
  });
  await check('Home & Living gets its own mixed-gift hero and collection links without a price range', async () => {
    const html = await renderWorld('page', 'sofies-home', homeFixture());
    assert.ok(html.includes('data-sf-home-beauty-hero')); assert.ok(html.includes('Home meets'));
    assert.equal((html.match(/href="\/collections\/home-meets-beauty-christmas-gift-bundles"/g) || []).length, 2);
    assert.ok(!html.includes('data-sf-gift-bundles')); assert.ok(!html.includes('bundle_from')); assert.ok(!html.includes('LE '));
    assert.ok(html.includes('data-sf-gift-box-photo')); assert.ok(html.includes('src="/bundle-box.webp"'));
    assert.ok(!html.includes('src="/original-11.webp"')); assert.ok(!html.includes('src="/original-22.webp"'));
    assert.ok(html.includes('Gift presentation is illustrative'));
  });
  await check('The main homepage exposes mixed gifts and makeup keeps its existing hero', async () => {
    const index = await renderWorld('index', '', homeFixture());
    const makeup = await renderWorld('page', 'sofies-makeup', homeFixture());
    assert.ok(index.includes('data-sf-home-beauty-entry')); assert.ok(!index.includes('data-sf-home-beauty-hero'));
    assert.ok(!makeup.includes('data-sf-home-beauty-entry')); assert.ok(!makeup.includes('data-sf-home-beauty-hero'));
    assert.ok(makeup.includes('id="sf-xmas-title"'));
  });
  await check('The mixed-gift NOW message disappears when no complete set is ready', async () => {
    const gifts = homeFixture(); assert.ok((await renderWorld('page', 'sofies-home', gifts)).includes('data-sf-home-beauty-now'));
    gifts.products[0].metafields.custom.sofie_bundle_components.value[0].inventory_quantity = 0;
    assert.ok(!(await renderWorld('page', 'sofies-home', gifts)).includes('data-sf-home-beauty-now'));
  });
  await check('Missing or empty mixed gifts fall back to the existing seasonal hero', async () => {
    for (const gifts of [undefined, { ...homeFixture(), products_count: 0 }]) {
      const html = await renderWorld('page', 'sofies-home', gifts);
      assert.ok(!html.includes('data-sf-home-beauty-hero')); assert.ok(html.includes('id="sf-xmas-title"')); assert.ok(!html.includes('href=""'));
    }
  });
  console.log(checks + ' bundle behaviour checks passed.');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
