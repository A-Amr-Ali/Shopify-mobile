export const STORE = 'https://sofiestore.net';
export const CAMPAIGN = 'sofie_knows_q4_2026';
export const START = '2026-10-13';
export const END = '2027-01-12';
export const GOALS = {
  prep: { ar: 'الميك أب بيبان ناشف', en: 'Makeup looks dry', steps: [['prep', 'moisturizers-1'], ['primer', 'face-primer']] },
  lasting: { ar: 'عايزة ميك أب ثابت', en: 'Help my makeup last', steps: [['set', 'setting-spray-powder']] },
  everyday: { ar: 'لوك يومي بسيط', en: 'An easy everyday look', steps: [['cheek', 'blush'], ['lip', 'lip-balms-treatments-1']] },
  hydration: { ar: 'بشرتي محتاجة ترطيب', en: 'A hydration ritual', steps: [['moisturize', 'moisturizers-1'], ['lip', 'lip-balms-treatments-1']] },
  gift: { ar: 'بدور على هدية', en: 'Find a thoughtful gift', steps: [['gift', 'value-gift-sets']] },
  scent: { ar: 'عايزة ريحة تناسبني', en: 'Find my scent', steps: [['scent', 'perfume-1']] }
};
export const SKINS = ['unsure', 'normal', 'dry', 'oily', 'combo', 'sensitive'];
export const FINISHES = ['natural', 'radiant', 'matte'];
export const STEP_NAMES = {
  prep: ['تحضير البشرة', 'Skin prep'], primer: ['برايمر - خطوة اختيارية', 'Primer - optional'],
  set: ['تثبيت الميك أب', 'Set your makeup'], cheek: ['لون للخدود', 'Cheek colour'],
  lip: ['لمسة للشفايف', 'A lip finishing touch'], moisturize: ['ترطيب البشرة', 'Hydration'],
  gift: ['اختيار للهدية', 'A gift to consider'], scent: ['اختيار للعطر', 'A scent to explore']
};
export const SOURCES = [
  { name: 'Sephora creator commerce', url: 'https://newsroom.sephora.com/sephora-launches-my-sephora-storefront-to-empower-creators/', kind: 'strategy' },
  { name: 'TikTok Next 2026', url: 'https://ads.tiktok.com/business/en-GB/next', kind: 'format_forecast' },
  { name: 'Rhode official arrivals', url: 'https://www.rhodeskin.com/collections/all', kind: 'brand_arrivals' },
  { name: 'Charlotte Tilbury new arrivals', url: 'https://www.charlottetilbury.com/uk/products/new-arrivals', kind: 'brand_arrivals' }
];
