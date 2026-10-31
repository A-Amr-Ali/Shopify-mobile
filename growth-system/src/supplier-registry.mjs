// Approved brand domains only; market currency is rechecked for every offer.
// Unknown brands are an explicit setup exception, never a claim that no product exists.
export const normalizeBrand = value => String(value||'').replace(/[™®©]/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const OFFICIAL_BRANDS = [
  ['rhode',['rhodeskin.com']],['k18',['k18hair.com','k18hair.ae','k18hair.co.uk']],['clinique',['clinique.com','clinique.co.uk','clinique-me.com']],
  ['tarte',['tartecosmetics.com']],['briogeo',['briogeohair.com']],['charlotte tilbury',['charlottetilbury.com']],['huda beauty',['hudabeauty.com']],
  ['makeup by mario',['makeupbymario.com']],['milk makeup',['milkmakeup.com']],['kosas',['kosas.com']],['dior',['dior.com']],
  ['one size',['onesizebeauty.com']],['kiehl',['kiehls.com','kiehls.ae','kiehls.co.uk']],['stanley',['stanley1913.com','stanley1913.ae','uk.stanley1913.com']],
  ['smeg',['smeg.com','smeguk.com','smeggulf.com']],['blond amsterdam',['blond-amsterdam.com']],['beauty blender',['beautyblender.com','beautyblender.co.uk']],
  ['sol de janeiro',['soldejaneiro.com']],['ouai',['theouai.com','theouai.co.uk']],['owala',['owalalife.com']],['slip',['slip.com','slip.co.uk']],
  ['josie maran',['josiemaran.com']],['24bottle',['24bottles.com']],['fenty',['fentybeauty.com','fentyskin.com']],
  ['patrick ta',['patrickta.com']],['living proof',['livingproof.com']],['rare beauty',['rarebeauty.com']],['tower 28',['tower28beauty.com']],
  ['grande',['grandecosmetics.com']],['benefit',['benefitcosmetics.com']],['amika',['loveamika.com']],['color wow',['colorwowhair.com']],
  ['smashbox',['smashbox.com','smashbox.co.uk']],['summer fridays',['summerfridays.com']],['saie',['saiehello.com']],['hourglass',['hourglasscosmetics.com']],['byoma',['byoma.com']]
].concat([
  ['bubble',['hellobubble.com']],['sincerely yours',['sincerely-yours.com']],
  ['refy',['refybeauty.com']],['westman atelier',['westman-atelier.com']],
  ['haus labs',['hauslabs.com']],['wonderskin',['wonderskin.com']],
  ['salt stone',['saltandstone.com']],['salt and stone',['saltandstone.com']],['vacation',['vacation.inc']],
  ['gisou',['gisou.com']],['olaplex',['olaplex.com']],['starface',['starface.world']],['snif',['snif.co']],
  ['natasha denona',['natashadenona.com']],['too faced',['toofaced.com']],['nars',['narscosmetics.com']],
  ['yves saint laurent',['yslbeautyus.com']],['ninja',['sharkninja.com']]
]);
const US_STORES = [...[['rhode','https://www.rhodeskin.com'],['tarte','https://tartecosmetics.com'],['hourglass','https://www.hourglasscosmetics.com'],['k18','https://www.k18hair.com'],['briogeo','https://www.briogeohair.com'],['makeup by mario','https://www.makeupbymario.com'],['kosas','https://kosas.com'],['one size','https://www.onesizebeauty.com'],['beauty blender','https://beautyblender.com'],['sol de janeiro','https://soldejaneiro.com'],['ouai','https://theouai.com'],['owala','https://owalalife.com'],['josie maran','https://www.josiemaran.com'],['patrick ta','https://patrickta.com'],['rare beauty','https://www.rarebeauty.com'],['tower 28','https://www.tower28beauty.com'],['grande','https://grandecosmetics.com'],['amika','https://loveamika.com'],['color wow','https://colorwowhair.com'],['summer fridays','https://summerfridays.com'],['saie','https://saiehello.com']],...[['stanley','https://www.stanley1913.com'],['living proof','https://www.livingproof.com'],['byoma','https://byoma.com'],['huda beauty','https://hudabeauty.com/en-us']],
  ['bubble','https://hellobubble.com'],['sincerely yours','https://sincerely-yours.com'],
  ['refy','https://us.refybeauty.com'],['westman atelier','https://www.westman-atelier.com'],
  ['haus labs','https://www.hauslabs.com'],['wonderskin','https://wonderskin.com'],
  ['salt stone','https://www.saltandstone.com'],['salt and stone','https://www.saltandstone.com'],
  ['vacation','https://vacation.inc'],['gisou','https://gisou.com'],['olaplex','https://olaplex.com'],
  ['starface','https://starface.world'],['snif','https://snif.co'],['natasha denona','https://natashadenona.com'],
  ['too faced','https://www.toofaced.com'],['nars','https://www.narscosmetics.com'],['yves saint laurent','https://www.yslbeautyus.com'],
  ['clinique','https://www.clinique.com'],['charlotte tilbury','https://www.charlottetilbury.com/us'],
  ['milk makeup','https://milkmakeup.com'],['dior','https://www.dior.com/en_us/beauty'],
  ['kiehl','https://www.kiehls.com'],['fenty','https://fentybeauty.com'],['slip','https://www.slip.com'],
  ['benefit','https://www.benefitcosmetics.com/en-us'],['smashbox','https://www.smashbox.com'],['ninja','https://www.sharkninja.com']
];
const REGIONAL_STORES = {
  AE: [['huda beauty','https://hudabeauty.com/en-ae']],
  UK: [['smeg','https://shop.smeguk.com'],['rhode','https://www.rhodeskin.com/en-gb'],
    ['stanley','https://uk.stanley1913.com'],['huda beauty','https://hudabeauty.com/en-gb'],
    ['refy','https://refybeauty.com']]
};
export function officialDomains(brand) {
  const name=normalizeBrand(brand);
  return OFFICIAL_BRANDS.filter(([b])=>name.includes(b)).flatMap(([,domains])=>domains);
}
export function officialStores(brand,region) {
  const name=normalizeBrand(brand);
  return [...new Set((region==='US'?US_STORES:REGIONAL_STORES[region]||[]).filter(([b])=>name.includes(b)).map(([,base])=>base))];
}
export function sourcePriority(source) {
  let host;try{host=new URL(source.url).hostname.replace(/^www\./,'');}catch{return 999;}
  const market={AE:0,US:1,UK:2}[source.region];
  if(market===undefined)return 999;
  if(['sephora.me','sephora.ae','sephora.com','sephora.co.uk'].includes(host))return market;
  if(host==='ulta.com')return source.region==='US'?6:999;
  return 3+market;
}
// Exact identity learned from the merchant-supplied official product and the
// matching Sephora UAE 4.4 g SKU. This is net fill identity, NEVER shipping weight.
export function documentedOption(line,variant) {
  if(normalizeBrand(line.brand).includes('bubble')&&normalizeBrand(line.title)==='tell all juicy secrets berry lip balm'&&String(variant?.barcode||variant?.gtin12||'').replace(/^0+/,'')==='850020056828')
    return {text:'4.4 g',evidence:'Product identity: Bubble barcode 850020056828 matches Tell All Juicy Secret; 4.4 g documented by Sephora UAE SKU 783019.'};
  return null;
}
export const PRODUCT_HINTS = [
  {brand:'bubble',titles:['Tell All - Juicy Secrets Berry Lip Balm','Tell All Juicy Secret'],sources:[
    {region:'AE',url:'https://www.sephora.me/ae-en/p/tell-all-juicy-secrets-berry-lip-balm/P10062586'},
    {region:'US',url:'https://hellobubble.com/products/tell-all-juicy-secret'},
    {region:'US',url:'https://www.ulta.com/p/tell-all-lip-balm-pimprod2046769?sku=2627110'}]}
];
export function productHints(line) {
  return PRODUCT_HINTS.filter(x=>normalizeBrand(line.brand).includes(x.brand)&&x.titles.some(t=>normalizeBrand(t)===normalizeBrand(line.title))).flatMap(x=>x.sources);
}

