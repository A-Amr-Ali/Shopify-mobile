import { GOALS, SKINS, FINISHES, STEP_NAMES, STORE, CAMPAIGN } from './config.mjs';
export const FACE_AREAS = ['forehead', 'under-eyes', 'around-eyes', 'cheeks', 'nose', 'lips', 'chin-jaw', 'whole-face'];
export const CONCERNS = ['breakouts', 'dark-circles', 'dark-spots', 'dryness', 'fine-lines', 'pores', 'redness', 'texture', 'dullness', 'oiliness', 'puffiness'];
function validateChoices(value, allowed, field) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 3 || value.some(x => typeof x !== 'string' || !allowed.includes(x))) throw new Error('invalid_' + field);
  return [...new Set(value)];
}
export function routineSteps(p) {
  const steps = [...GOALS[p.goal].steps];
  if (p.goal === 'gift' || p.goal === 'scent') return steps;
  if (p.faceAreas?.some(a => a === 'under-eyes' || a === 'around-eyes')) steps.push(['eye', 'eye-care']);
  if (p.faceAreas?.includes('lips') && !steps.some(([s]) => s === 'lip')) steps.push(['lip', 'lip-balms-treatments-1']);
  return steps;
}

export function cleanProfile(body = {}) {
  const specified = body.budget !== undefined && body.budget !== null && String(body.budget).trim() !== '';
  const budget = specified ? Number(body.budget) : null;
  if (specified && (!Number.isFinite(budget) || budget < 100 || budget > 100000)) throw new Error('invalid_budget');
  const faceAreas = validateChoices(body.faceAreas, FACE_AREAS, 'face_areas');
  const concerns = validateChoices(body.concerns, CONCERNS, 'concerns');
  if (body.goal && !GOALS[body.goal]) throw new Error('invalid_goal');
  if (body.skin && !SKINS.includes(body.skin)) throw new Error('invalid_skin');
  if (body.finish && !FINISHES.includes(body.finish)) throw new Error('invalid_finish');
  return { goal: body.goal || 'prep', skin: body.skin || 'unsure', finish: body.finish || 'natural',
    budget: budget === null ? null : Math.round(budget * 100) / 100,
    faceAreas, concerns, today: body.today === true, lang: body.lang === 'en' ? 'en' : 'ar',
    note: String(body.note || '').slice(0, 500).trim() };
}

export function medicalQuestion(note) {
  return /pregnan|breastfeed|eczema|psoriasis|prescri|isotretin|allergic reaction|burning|bleeding|infection|حامل|رضاع|اكزيما|إكزيما|صدفي|حساسية شديدة|حرقان|نزيف|التهاب شديد/i.test(note);
}

export function normalizeFeed(rows, step) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((p, rank) => {
    if (!/^[a-z0-9-]+$/i.test(p.h || '')) return [];
    const text = [p.t, p.y, p.g, p.d].join(' ').toLowerCase();
    return (p.s || []).filter(v => v.a === 1 && Number(v.p) > 0 && /^\d+$/.test(String(v.id))).map(v => ({
      handle: p.h, title: String(p.t || ''), brand: String(p.v || ''), description: String(p.d || '').slice(0, 700),
      variantId: String(v.id), variantTitle: String(v.t || ''), price: Number(v.p) / 100,
      image: p.i?.startsWith('//') ? 'https:' + p.i : p.i || '', step, rank, text,
      now: false, stockChecked: false, productNowSignal: p.n === 1,
      url: STORE + '/products/' + p.h + '?variant=' + encodeURIComponent(String(v.id))
    }));
  });
}

const AREA_MATCH = {
  'forehead': /forehead|t.zone|face|complexion/,
  'under-eyes': /under.eye|eye.cream|eye.serum|eye.patch|dark.circle|eye.area/,
  'around-eyes': /eye|eyelid|lash|brow/,
  'cheeks': /cheek|blush|face|complexion/,
  'nose': /nose|t.zone|pore|face/,
  'lips': /lip|balm|gloss/,
  'chin-jaw': /jaw|chin|face|complexion/
};
const CONCERN_MATCH = {
  'breakouts': /acne|blemish|breakout|spots?|salicylic/,
  'dark-circles': /dark.circle|under.eye|brighten|caffeine/,
  'dark-spots': /dark.spot|hyperpigment|uneven.tone|brighten/,
  'dryness': /hydrat|dry.skin|moisturi|ceramide|glycerin/,
  'fine-lines': /fine.line|wrinkl|plump|peptid/,
  'pores': /pore|t.zone|oil.control/,
  'redness': /redness|calm|sooth|centella/,
  'texture': /textur|smooth|exfoliat/,
  'dullness': /dull|glow|radiant|brighten/,
  'oiliness': /oily|shine.control|matte|oil.free/,
  'puffiness': /puff|eye.patch|caffeine/
};
export function scoreCard(card, p) {
  const text = card.text || '';
  let score = 15 + Math.max(0, 6 - card.rank / 5);
  const reasons = [];
  const ar = p.lang !== 'en';
  if (p.skin === 'sensitive') {
    if (/retinol|retinoid|glycolic|salicylic|exfoliat|\baha\b|\bbha\b/.test(text)) return null;
    if (!/sensitive|gentle|soothing|fragrance[- ]free/.test(text)) return null;
    reasons.push(ar ? 'وصف المنتج يذكر اللطف أو البشرة الحساسة؛ راجعي المكونات وجرّبي على منطقة صغيرة' : 'The listing mentions gentle or sensitive-skin use; check ingredients and patch test');
    score += 4;
  }
  if ((p.skin === 'dry' || p.goal === 'prep' || p.goal === 'hydration') && /hydrat|moisturi|ceramide|glycerin|squalane/.test(text)) {
    score += 8; reasons.push(ar ? 'وصفه يذكر الترطيب' : 'The listing describes hydration');
  }
  if ((p.skin === 'oily' || p.skin === 'combo') && /oil[- ]free|matte|mattif|shine|balanc/.test(text)) {
    score += 7; reasons.push(ar ? 'وصفه يذكر تقليل اللمعان أو لمسة مطفية' : 'The listing mentions shine control or a matte finish');
  }
  if (p.finish === 'radiant' && /glow|radiant|dewy|glaz/.test(text)) { score += 5; reasons.push(ar ? 'لمسة مضيئة حسب وصفه' : 'A radiant finish according to its listing'); }
  if (p.finish === 'matte' && /matte|mattif/.test(text)) { score += 5; reasons.push(ar ? 'لمسة مطفية حسب وصفه' : 'A matte finish according to its listing'); }
  if (p.goal !== 'gift' && p.goal !== 'scent') {
    const areas = (p.faceAreas || []).filter(a => a !== 'whole-face');
    if (areas.some(a => AREA_MATCH[a]?.test(text))) {
      score += 10;
      reasons.push(ar ? 'وصف المنتج مناسب للمنطقة اللي اخترتيها' : 'The listing matches your chosen face area');
    }
    if (areas.includes('under-eyes') && card.step === 'eye') score += 12;
    if (areas.includes('around-eyes') && card.step === 'eye') score += 12;
    if (areas.includes('lips') && card.step === 'lip') score += 12;
    for (const concern of p.concerns || []) {
      if (CONCERN_MATCH[concern]?.test(text)) {
        score += 9;
        reasons.push(ar ? 'الوصف بيذكر نقطة مرتبطة باهتمامك' : 'The product listing mentions your concern');
      }
    }
  }
  if (p.today && !card.now) return null;
  if (p.today && card.now) { score += 4; reasons.push(ar ? 'الخيار ده مؤهل لـ SOFIE NOW؛ أكّدي المنطقة والميعاد مع الفريق' : 'This option is eligible for SOFIE NOW; confirm area and timing with the team'); }
  if (/mini|travel|\b50\s?ml\b|\b34\s?ml\b/i.test(card.variantTitle)) reasons.push(ar ? 'حجم صغير؛ اتأكدي إنه الحجم اللي محتاجاه' : 'A smaller size; check that it suits what you need');
  if (!reasons.length) reasons.push(ar ? 'اختيار من فئة المنتج اللي طلبتيها' : 'An option in the category you requested');
  return { ...card, score, reasons };
}

// Enumerate small candidate groups so the TOTAL basket respects the budget.
// Optional steps may be skipped; duplicate product/variant picks are excluded.
export function chooseRoutine(cards, p) {
  const steps = routineSteps(p);
  const groups = steps.map(([step]) => cards.filter(c => c.step === step && (p.budget === null || c.price <= p.budget))
    .map(c => scoreCard(c, p)).filter(Boolean).sort((a, b) => b.score - a.score || a.price - b.price).slice(0, 8));
  let best = { value: -1, cards: [], total: 0 };
  function explore(i, chosen, total, score) {
    if (i === groups.length) {
      const value = score + chosen.length * 30;
      if (value > best.value || (value === best.value && total < best.total)) best = { value, cards: [...chosen], total };
      return;
    }
    explore(i + 1, chosen, total, score);
    for (const card of groups[i]) {
      if ((p.budget !== null && total + card.price > p.budget + 0.001) || chosen.some(c => c.handle === card.handle)) continue;
      chosen.push(card); explore(i + 1, chosen, total + card.price, score + card.score); chosen.pop();
    }
  }
  explore(0, [], 0, 0);
  return { items: best.cards.map(({ text, score, rank, productNowSignal, ...c }) => ({ ...c, stepName: STEP_NAMES[c.step][p.lang === 'en' ? 1 : 0] })),
    total: Math.round(best.total * 100) / 100, currency: 'EGP', budget: p.budget,
    missingSteps: steps.filter(([s]) => !best.cards.some(c => c.step === s)).map(([s]) => STEP_NAMES[s][p.lang === 'en' ? 1 : 0]) };
}

export function routineAlternatives(cards, p, items) {
  return items.flatMap(item => {
    const remaining = p.budget === null ? Infinity : p.budget - items.filter(x => x !== item).reduce((n,x) => n + x.price, 0);
    const seen = new Set([item.handle]);
    return cards.filter(c => c.step === item.step && c.price <= remaining).map(c => scoreCard(c,p)).filter(Boolean)
      .sort((a,b) => b.score-a.score || a.price-b.price).filter(c => !seen.has(c.handle) && seen.add(c.handle)).slice(0,5)
      .map(c => ({step:c.step,variantId:c.variantId,handle:c.handle,title:c.title,variantTitle:c.variantTitle,price:c.price,image:c.image,brand:c.brand,url:c.url,reasons:c.reasons}));
  });
}

export function ruleAdvice(p, items) {
  if (medicalQuestion(p.note)) return p.lang === 'en'
    ? 'This question needs advice from a qualified clinician. Our beauty matching tool can help with cosmetic preferences after you have that guidance.'
    : 'السؤال ده محتاج رأي مختص. نقدر نساعدك في اختيارات التجميل بعد ما تاخدي الإرشاد المناسب.';
  if (!items.length) return p.lang === 'en'
    ? (p.budget === null ? 'There is no confidently available match for these preferences today. Try another preference or ask our team.' : 'There is no confident available match within these choices today. Try a different budget or ask our team.')
    : (p.budget === null ? 'مفيش اختيار واضح متاح يناسب احتياجاتك دلوقتي. جرّبي تفضيل مختلف أو اسألي فريق صوفي.' : 'مفيش اختيار واضح متاح يناسب الاختيارات دي دلوقتي. جرّبي ميزانية مختلفة أو اسألي فريق صوفي.');
  const advice = {
    prep: ['جرّبي طبقات خفيفة من الترطيب قبل الميك أب، وسيبي كل طبقة تستقر. البرايمر خطوة اختيارية حسب احتياجك. خلي اختيارك على أساس بشرتك، مش شهرة المنتج.', 'Try light layers of hydration before makeup and let each layer settle. Primer is optional. Choose for your preferences, rather than the hype.'],
    lasting: ['طبقات خفيفة وتثبيت الأماكن اللي بتلمع ممكن يساعدوا اللوك. اتبعي طريقة استخدام المنتج؛ النتيجة بتختلف حسب التحضير والطقس.', 'Thin layers and setting the areas that get shiny may help your look. Follow the product directions; results depend on prep and conditions.'],
    everyday: ['ابدئي بلمسة لون خفيفة للخدود والشفايف وزوّدي تدريجي. الدرجة المناسبة بتعتمد على ذوقك ولون بشرتك؛ شوفي الدرجة الحقيقية في صفحة المنتج.', 'Start with a light touch of colour on cheeks and lips. Check the real shade on the product page and build gradually.'],
    hydration: ['خلي الترطيب خطوة بسيطة ومنتظمة. راجعي المكونات وجرّبي أي منتج جديد على منطقة صغيرة. الخطوات دي للتجميل والعناية العامة.', 'Keep hydration simple and consistent. Check ingredients and patch test new products. This is general cosmetic care.'],
    gift: ['اختاري على أساس ذوق الشخص والميزانية. الحجم والمحتويات مهمين زي اسم البراند. لو مش متأكدة، فريق صوفي يساعدك في الهدية.', 'Choose for the recipient and your budget. Size and contents matter as much as the brand. Our team can help with gifting.'],
    scent: ['وصف النوتات يساعدك تبدأي؛ تجربة العطر على البشرة هي اللي تحسم. قارني الحجم والتركيز في صفحة المنتج، واسألي الفريق لو محتاجة مساعدة.', 'Notes are a starting point; trying a scent on skin is the best way to decide. Compare size and concentration on the product page.']
  };
  return advice[p.goal][p.lang === 'en' ? 1 : 0];
}

export function campaignUrl(contentId = 'adviser', source = 'instagram', goal = '') {
  const url = new URL(STORE + '/pages/sofie-knows');
  url.searchParams.set('utm_source', source); url.searchParams.set('utm_medium', source === 'store' ? 'qr' : 'organic_social');
  url.searchParams.set('utm_campaign', CAMPAIGN); url.searchParams.set('utm_content', contentId);
  if (GOALS[goal]) url.searchParams.set('goal', goal);
  return url.toString();
}
