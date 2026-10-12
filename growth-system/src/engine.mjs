import { GOALS, SKINS, FINISHES, STEP_NAMES, STORE, CAMPAIGN } from './config.mjs';

export function cleanProfile(body = {}) {
  const budget = Number(body.budget ?? 6000);
  if (!Number.isFinite(budget) || budget < 100 || budget > 100000) throw new Error('invalid_budget');
  if (body.goal && !GOALS[body.goal]) throw new Error('invalid_goal');
  if (body.skin && !SKINS.includes(body.skin)) throw new Error('invalid_skin');
  if (body.finish && !FINISHES.includes(body.finish)) throw new Error('invalid_finish');
  return { goal: body.goal || 'prep', skin: body.skin || 'unsure', finish: body.finish || 'natural',
    budget: Math.round(budget * 100) / 100, today: body.today === true, lang: body.lang === 'en' ? 'en' : 'ar',
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
  if (p.today && !card.now) return null;
  if (p.today && card.now) { score += 4; reasons.push(ar ? 'الخيار ده مؤهل لـ SOFIE NOW؛ أكّدي المنطقة والميعاد مع الفريق' : 'This option is eligible for SOFIE NOW; confirm area and timing with the team'); }
  if (/mini|travel|\b50\s?ml\b|\b34\s?ml\b/i.test(card.variantTitle)) reasons.push(ar ? 'حجم صغير؛ اتأكدي إنه الحجم اللي محتاجاه' : 'A smaller size; check that it suits what you need');
  if (!reasons.length) reasons.push(ar ? 'اختيار من فئة المنتج اللي طلبتيها' : 'An option in the category you requested');
  return { ...card, score, reasons };
}

// Enumerate small candidate groups so the TOTAL basket respects the budget.
// Optional steps may be skipped; duplicate product/variant picks are excluded.
export function chooseRoutine(cards, p) {
  const groups = GOALS[p.goal].steps.map(([step]) => cards.filter(c => c.step === step && c.price <= p.budget)
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
      if (total + card.price > p.budget + 0.001 || chosen.some(c => c.handle === card.handle)) continue;
      chosen.push(card); explore(i + 1, chosen, total + card.price, score + card.score); chosen.pop();
    }
  }
  explore(0, [], 0, 0);
  return { items: best.cards.map(({ text, score, rank, productNowSignal, ...c }) => ({ ...c, stepName: STEP_NAMES[c.step][p.lang === 'en' ? 1 : 0] })),
    total: Math.round(best.total * 100) / 100, currency: 'EGP', budget: p.budget,
    missingSteps: GOALS[p.goal].steps.filter(([s]) => !best.cards.some(c => c.step === s)).map(([s]) => STEP_NAMES[s][p.lang === 'en' ? 1 : 0]) };
}

export function ruleAdvice(p, items) {
  if (medicalQuestion(p.note)) return p.lang === 'en'
    ? 'This question needs advice from a qualified clinician. Our beauty matching tool can help with cosmetic preferences after you have that guidance.'
    : 'السؤال ده محتاج رأي مختص. نقدر نساعدك في اختيارات التجميل بعد ما تاخدي الإرشاد المناسب.';
  if (!items.length) return p.lang === 'en' ? 'There is no confident available match within these choices today. Try a different budget or ask our team.'
    : 'مفيش اختيار واضح متاح يناسب الاختيارات دي دلوقتي. جرّبي ميزانية مختلفة أو اسألي فريق صوفي.';
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
