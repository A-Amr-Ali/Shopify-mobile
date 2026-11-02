/* SOFIE · Find My Match (v6)
   A client-side matching engine that reads the live, in-stock catalogue
   (/collections/<handle>?view=sfm&sort_by=best-selling) and scores every product
   against the shopper's answers: skin type, finish, coverage, depth & undertone,
   concerns, notes, colour story, hair type, budget, brand love and SOFIE NOW speed.
   It explains every pick, suggests shades to try and adds to bag in place. */
(() => {
'use strict';
if (window.SofieMatch) return;
const root = document.querySelector('[data-match-root]');
if (!root) return;
const cfg = JSON.parse(root.querySelector('[data-match-config]').textContent || '{}');
const app = root.querySelector('[data-match-app]');
const LS_KEY = 'sofie-match';
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = cents => {
  const v = (cents || 0) / 100;
  const fmt = cfg.moneyFormat;
  if (fmt && /\{\{\s*\w+\s*\}\}/.test(fmt)) {
    const grp = (n, d) => n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (m, k) => k === 'amount_no_decimals' ? grp(v, 0) : k === 'amount_with_comma_separator' ? v.toFixed(2).replace('.', ',') : grp(v, v % 1 ? 2 : 0)).replace(/<[^>]*>/g, '');
  }
  try { return new Intl.NumberFormat(cfg.locale || 'en', { style: 'currency', currency: cfg.currency || 'EGP', maximumFractionDigits: 0 }).format(v); }
  catch (e) { return Math.round(v).toLocaleString() + ' ' + (cfg.currency || 'EGP'); }
};
const imgW = (u, w) => { if (!u) return ''; try { const x = new URL(u, location.origin); x.searchParams.set('width', w); return x.href; } catch (e) { return u; } };
const uniq = a => Array.from(new Set(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------------------------------------------------------- knowledge */
const RX = {
  finish: {
    dewy: /dewy|glow|radian|lumin|glass[- ]?skin|illuminat|satin glow|hydra[- ]?glow|skin[- ]?tint|serum/,
    natural: /natural|skin[- ]?like|second[- ]?skin|satin|weightless|breathable|serum foundation|skin tint|blur/,
    matte: /matte|mattif|velvet|blur|oil[- ]?control|shine[- ]?control|pore|powder/,
    longwear: /long[- ]?wear|24[- ]?h|24-hour|36[- ]?h|16[- ]?h|all[- ]?day|transfer[- ]?(proof|resist)|waterproof|sweat|humidity|stay[- ]in[- ]place/
  },
  coverage: {
    sheer: /sheer|skin[- ]?tint|tinted moistur|light coverage|lightweight coverage|serum foundation|bb cream|cc cream/,
    medium: /medium coverage|buildable|medium[- ]to[- ]full|natural coverage/,
    full: /full[- ]?coverage|full cover|high[- ]?coverage|maximum coverage|double wear|longwear foundation/
  },
  skin: {
    dry: /dry skin|for dry|hydrat|moistur|hyaluron|ceramide|nourish|squalane|plump|dewy|rich/,
    oily: /oily|oil[- ]?control|mattif|shine|pore|sebum|salicylic|niacinamide|matte|blot/,
    combination: /combination|balanc|all skin types|t-zone/,
    normal: /all skin types|normal skin|every skin/,
    sensitive: /sensitive|sooth|calm|gentle|fragrance[- ]?free|centella|cica|redness|barrier|hypoallergenic|non[- ]?irritat/
  },
  concern: {
    breakouts: /acne|blemish|breakout|salicylic|bha\b|benzoyl|spot|pimple|clarif|congest|patch/,
    darkspots: /dark spot|hyperpig|discolou?r|tranexamic|arbutin|vitamin c|brighten|even (skin )?tone|melasma/,
    dull: /dull|glow|radian|vitamin c|aha\b|glycolic|lactic|exfoli|brighten|luminous/,
    aging: /retin|peptide|collagen|firm|wrinkle|fine line|lift|age|bakuchiol|longevity|pdrn/,
    dryness: /dry|hydrat|hyaluron|ceramide|barrier|moist|squalane|nourish|plump/,
    redness: /redness|sooth|calm|centella|cica|sensitive|barrier|azelaic|ectoin/,
    pores: /pore|niacinamide|bha\b|salicylic|refin|blur|smooth|texture/,
    oiliness: /oil[- ]?control|mattif|sebum|shine|niacinamide|clay|balance/
  },
  pref: {
    fragrancefree: /fragrance[- ]?free|unscented|without fragrance/,
    clean: /clean|vegan|cruelty[- ]?free|non[- ]?toxic|plant/,
    kbeauty: /cosrx|laneige|beauty of joseon|anua|some by mi|dr\.?jart|innisfree|belif|snail|korean|k-beauty/,
    luxury: /dior|chanel|la mer|charlotte tilbury|tom ford|ysl|yves saint laurent|armani|estee|est[ée]e lauder|lanc[oô]me|givenchy|guerlain|sisley|tatcha|westman/
  },
  family: {
    vanilla: /vanilla|gourmand|caramel|marshmallow|sugar|praline|tonka|cookie|cake|pistachio|gelato|cocoa|chocolate|honey|milk|cream|butter|almond/,
    floral: /floral|rose|jasmine|peony|tuberose|orange blossom|neroli|gardenia|lily|iris|violet|magnolia|sakura|cherry blossom|orchid|bouquet/,
    fresh: /fresh|citrus|bergamot|lemon|grapefruit|yuzu|mandarin|orange|aquatic|marine|ocean|green|tea|matcha|mint|clean|sea salt|beach/,
    woody: /wood|oud|sandalwood|santal|cedar|vetiver|patchouli|smok|leather|tobacco|incense|hinoki/,
    musky: /musk|skin scent|cashmere|soft|powder|ambrette|clean skin|white musk/,
    amber: /amber|spic|saffron|cinnamon|pepper|cardamom|resin|warm|labdanum|benzoin|myrrh/,
    fruity: /fruit|berry|cherry|peach|pear|apple|plum|fig|guava|mango|coconut|pineapple|raspberry|strawberry|lychee|blackcurrant|passion/
  },
  format: {
    mist: /mist|body spray|hair (&|and) body|hair and body|body & hair|splash/,
    perfume: /eau de parfum|\bedp\b|parfum|perfume|extrait|elixir|eau de toilette|\bedt\b|cologne|fragrance/
  },
  intensity: {
    soft: /mist|body spray|eau de toilette|\bedt\b|cologne|skin scent|soft|sheer/,
    noticeable: /eau de parfum|\bedp\b/,
    statement: /extrait|parfum intense|intense|elixir|absolu|oud/
  },
  colour: {
    nude: /nude|beige|naked|bare|buff|sand|taupe|toffee|caramel|latte|biscuit|skin/,
    pink: /pink|rose|blush|ballet|petal|candy|bubblegum|fuchsia|flamingo|peony/,
    berry: /berry|plum|wine|mauve|raisin|cherry|burgund|grape|merlot|currant|violet/,
    red: /\bred\b|scarlet|crimson|ruby|cherry red|rouge|poppy/,
    coral: /coral|peach|apricot|orange|terracotta|papaya|mango|melon|tangerine|sunset/,
    brown: /brown|cocoa|chocolate|espresso|mocha|cinnamon|brick|chestnut|bronze|caramel/
  },
  lipfinish: {
    glossy: /gloss|shine|glaze|glass|vinyl|lacquer|oil|jelly|plump/,
    satin: /satin|cream|butter|balm|hydra/,
    matte: /matte|velvet|mousse|blur|powder|suede/,
    sheer: /tint|stain|sheer|balm|oil|wash/
  },
  hair: {
    fine: /fine|thin|volum|lightweight|weightless|lift|body/,
    medium: /all hair types|every hair|medium/,
    thick: /thick|coarse|rich|nourish|smooth|frizz/,
    curly: /curl|wave|defin|bounce/,
    coily: /coil|4c|kinky|textured|curl|moistur/
  },
  hairConcern: {
    frizz: /frizz|smooth|humid|sleek|anti[- ]frizz/,
    damage: /repair|bond|damage|break|strength|keratin|k18|olaplex|reconstruct|peptide/,
    volume: /volum|thicken|plump|lift|body|root/,
    dryness: /hydrat|moist|dry|nourish|mask|oil|butter/,
    oilyscalp: /scalp|oily|clarif|detox|purif|dry shampoo|refresh/,
    colour: /colou?r[- ]?(safe|protect|treated|care)|brass|toning|purple|blonde|gloss/,
    growth: /growth|thinning|density|hair fall|scalp serum|rosemary|amla|longevity/
  }
};
const LABEL = {
  dewy: 'Dewy, glowing finish', natural: 'Natural, skin-like finish', matte: 'Soft-matte finish', longwear: 'Long-wear formula',
  sheer: 'Sheer, breathable coverage', medium: 'Buildable medium coverage', full: 'Full coverage',
  dry: 'Loves dry skin', oily: 'Keeps oily skin fresh', combination: 'Balances combination skin', normal: 'Great for all skin types', sensitive: 'Gentle on sensitive skin',
  breakouts: 'Targets breakouts', darkspots: 'Fades dark spots', dull: 'Boosts radiance', aging: 'Firms & smooths', dryness: 'Deep hydration', redness: 'Calms redness', pores: 'Refines pores', oiliness: 'Controls shine',
  fragrancefree: 'Fragrance-free', clean: 'Clean formula', kbeauty: 'K-beauty favourite', luxury: 'Luxury icon',
  vanilla: 'Vanilla & gourmand notes', floral: 'Floral heart', fresh: 'Fresh & citrus', woody: 'Woody & oud depth', musky: 'Soft musky skin scent', amber: 'Warm amber & spice', fruity: 'Juicy fruity notes',
  mist: 'Light body & hair mist', perfume: 'Eau de parfum',
  soft: 'Soft, close to the skin', noticeable: 'Noticeable all day', statement: 'Statement projection',
  nude: 'Your nude', pink: 'Pink tones', berry: 'Berry tones', red: 'True reds', coral: 'Coral & peach', brown: 'Brown & cocoa',
  glossy: 'Glossy shine', satin: 'Comfortable satin', matteLip: 'Velvety matte', sheerLip: 'Sheer wash of colour',
  fine: 'Weightless for fine hair', thick: 'Tames thick hair', curly: 'Defines curls', coily: 'Moisture for coils',
  frizz: 'Fights frizz', damage: 'Repairs damage', volume: 'Adds volume', hdry: 'Hydrates dry hair', oilyscalp: 'Refreshes oily scalp', colour: 'Colour care', growth: 'Scalp & density care'
};

/* ----------------------------------------------------------------- journeys */
const BUDGET = { opts: [['any', 'No budget limit — show my best matches'], ['b1', 'Under ' + money(300000)], ['b2', money(300000) + ' – ' + money(500000)], ['b3', money(500000) + ' – ' + money(800000)], ['b4', money(800000) + '+']] };
const inBudget = (p, b) => { const e = p.p / 100; return b === 'b1' ? e < 3000 : b === 'b2' ? e >= 3000 && e <= 5000 : b === 'b3' ? e > 5000 && e <= 8000 : b === 'b4' ? e > 8000 : true; };
const DEPTHS = [['fair', 'Fair', '#f6dfcf', .06], ['light', 'Light', '#efcfb3', .2], ['lightmed', 'Light-medium', '#e2b48f', .34], ['medium', 'Medium', '#cf9a6f', .48], ['tan', 'Tan', '#b57d52', .62], ['deep', 'Deep', '#8a5634', .8], ['rich', 'Rich', '#5c3520', .94]];
const UNDERTONES = [['cool', 'Cool', 'Pink or rosy, veins look blue'], ['neutral', 'Neutral', 'A balance of pink and golden'], ['warm', 'Warm', 'Golden or peachy, veins look green'], ['olive', 'Olive', 'Green-grey cast, tans easily'], ['unsure', 'Not sure', 'We will show versatile shades']];

const JOURNEYS = {
  base: { title: 'Complexion', sub: 'Foundation, skin tint & concealer — with shades to try', steps: [
    { id: 'kind', q: 'What are we matching?', type: 'single', opts: [['foundation', 'Foundation'], ['skintint', 'Skin tint'], ['concealer', 'Concealer'], ['powder', 'Setting powder']] },
    { id: 'faceArea', q: 'Which area of your face concerns you?', type: 'multi', max: 3, opts: [['forehead','Forehead'],['undereyes','Under eyes'],['eyes','Around eyes'],['cheeks','Cheeks'],['nose','Nose'],['lips','Lips'],['jaw','Chin & jawline'],['all','Entire face']] }, { id: 'skin', q: 'How does your skin feel by midday?', type: 'single', opts: [['dry', 'Dry or tight'], ['normal', 'Comfortable'], ['combination', 'Shiny T-zone only'], ['oily', 'Shiny all over'], ['sensitive', 'Easily irritated']] },
    { id: 'finish', q: 'Which finish do you love?', type: 'single', opts: [['dewy', 'Dewy glow'], ['natural', 'Natural skin'], ['matte', 'Soft matte'], ['longwear', 'Long-wear, no touch-ups']] },
    { id: 'coverage', q: 'How much coverage?', type: 'single', skipIf: a => a.kind === 'powder', opts: [['sheer', 'Sheer — just even out'], ['medium', 'Medium & buildable'], ['full', 'Full — cover it all']] },
    { id: 'depth', q: 'Your skin depth', type: 'swatch', skipIf: a => a.kind === 'powder', opts: DEPTHS.map(d => [d[0], d[1], d[2]]) },
    { id: 'tone', q: 'Your undertone', type: 'single', skipIf: a => a.kind === 'powder', opts: UNDERTONES.map(u => [u[0], u[1], u[2]]) },
    { id: 'budget', optional: true, q: 'Budget per product', type: 'single', opts: BUDGET.opts }
  ] },
  skin: { title: 'Skincare routine', sub: 'A step-by-step routine for your skin and concerns', steps: [
    { id: 'faceArea', q: 'Which area of your face concerns you?', type: 'multi', max: 3, opts: [['forehead','Forehead'],['undereyes','Under eyes'],['eyes','Around eyes'],['cheeks','Cheeks'],['nose','Nose'],['lips','Lips'],['jaw','Chin & jawline'],['all','Entire face']] }, { id: 'skin', q: 'Your skin type', type: 'single', opts: [['dry', 'Dry'], ['normal', 'Normal'], ['combination', 'Combination'], ['oily', 'Oily'], ['sensitive', 'Sensitive']] },
    { id: 'concerns', q: 'Top concerns (pick up to 2)', type: 'multi', max: 2, opts: [['breakouts', 'Breakouts'], ['darkspots', 'Dark spots'], ['dull', 'Dullness'], ['aging', 'Fine lines'], ['dryness', 'Dehydration'], ['redness', 'Redness'], ['pores', 'Large pores'], ['oiliness', 'Excess shine']] },
