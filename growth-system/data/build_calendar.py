"""Deterministic three-month editorial queue; all slots are Cairo-local."""
import json
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from urllib.parse import urlencode

WEEKS = [
 ('Choose for you, not the hype','Match','prep',
  ['مش كل تريند مناسب ليكي.','الميك أب بيبان ناشف؟ نبدأ من التحضير.','ميزانيتك تختار معاكي، مش ضدك.'],
  ['اختيار ذكي في أربع خطوات','قبل ما تشتري المنتج المنتشر']),
 ('Makeup prep and lasting wear','Match','lasting',
  ['كل ما تزودي فاونديشن، اللوك بيتقل؟','البرايمر مش خطوة إجبارية لكل الناس.','تحضير خفيف قبل يوم طويل.'],
  ['ترطيب ولا برايمر؟ افهمي الفرق','روتين بسيط قبل الميك أب']),
 ('Your lips and cheeks edit','Match','everyday',
  ['درجة البلشر اللي حبيتيها عليها ممكن تحتاج تجربة عليكي.','جلوسي ولا مطفي؟ ابدئي باللمسة اللي بتحبيها.','الميني ممكن يكون بداية ذكية، لو حجمه مناسب.'],
  ['لونك، لمستك، اختيارك','راجعي الدرجة والحجم قبل الإضافة']),
 ('Your signature scent','Match','scent',
  ['اختاري العطر لذوقك، مش لاسم الترند.','النوتات بداية، وتجربة البشرة هي اللي تحسم.','العطر والميست مش نفس الاختيار.'],
  ['أربع أسئلة قبل هدية العطر','دليلك لوصف النوتات']),
 ('Freshness and fulfillment','Match','prep',
  ['SOFIE NOW للخيار المتاح، مش كل درجات المنتج.','Fresh عند صوفي: اكتشافات نراجعها معاكي.','خدي نفس اختياراتك من الموقع للمتجر.'],
  ['دليلك لـ SOFIE NOW','ورّي الفريق اختيارك']),
 ('Build a useful White Friday wishlist','White Friday','gift',
  ['قبل عروض الجمعة، اكتبي اللي محتاجاه فعلًا.','العرض الحلو هو اللي يناسب استخدامك.','قارني الحجم قبل ما تقارني السعر.'],
  ['قائمة رغبات من غير مشتريات مكررة','اختيارات داخل ميزانيتك']),
 ('White Friday, with a clear choice','White Friday','everyday',
  ['اشتري اختيار يناسبك، مش سلة من غير خطة.','خلي ميزانيتك واضحة قبل ما تفتحي العروض.','الدرجة المتاحة هي اللي تنفع تتحط في السلة.'],
  ['راجعي اختياراتك قبل الدفع','لو مش لاقية الدرجة، اسألي صوفي']),
 ('Make your purchases work for you','Repeat','hydration',
  ['اشتريتي منتج جديد؟ ابدئي بطريقة استخدامه.','خطوة جديدة واحدة ممكن تكون كفاية.','اسألي عن اختيارك بدل ما تشتري بديل عشوائي.'],
  ['روتينك بعد الشراء','خلي التوصية على أساس احتياجك']),
 ('Thoughtful gifting','Gifting','gift',
  ['هدية بيوتي حلوة تبدأ بذوق الشخص.','مش متأكدة من درجتها؟ اختاري معاها.','ميزانية الهدية جزء من الاختيار، مش إحراج.'],
  ['أربع أسئلة لهدية أذكى','قائمة هدايا حسب التفضيل']),
 ('Comfortable winter beauty','Gifting','hydration',
  ['إحساس الجفاف؟ خففي الروتين وراجعي الترطيب.','تحضير بشرتك قبل اللوك الشتوي.','الشفايف كمان تستحق اختيار على قد احتياجها.'],
  ['روتين ترطيب بسيط','طبقات خفيفة، اختيار مدروس']),
 ('Your event-ready edit','Gifting','lasting',
  ['لوك المناسبة يبدأ باختيارات تعرفي تستخدميها.','خلي لون الخدود والشفايف على ذوقك.','قبل ما تخرجي، راجعي التثبيت حسب نوع اللوك.'],
  ['قائمة تجهيز قبل المناسبة','اختيارك للمناسبة داخل ميزانيتك']),
 ('A calmer beauty reset','Repeat','prep',
  ['السنة الجديدة مش محتاجة عشرة منتجات جديدة.','راجعي اللي عندك قبل ما تزودي خطوة.','اختيار واحد مدروس أحسن من سلة من غير احتياج.'],
  ['ابدئي من استخدامك الحقيقي','صوفي تساعدك تختاري الخطوة الجاية']),
 ('Keep what works for you','Repeat','hydration',
  ['منتج قرب يخلص؟ راجعي نفس الحجم والخيار.','اختيار صاحبِتك مش لازم يبقى اختيارك.','قولي لنا إيه ساعدك تختاري بثقة.'],
  ['احفظي اختياراتك المفضلة','شاركي التوصية مع صاحبتك'])
]
TIPS = {
 'prep':'لو الميك أب بيبان ناشف، جربي طبقات خفيفة من الترطيب قبل ما تزودي تغطية. سيبي كل طبقة تستقر، وخلي البرايمر خطوة حسب احتياجك. راجعي وصف المنتج ومقاسه بدل ما تختاري على أساس الاسم بس.',
 'lasting':'ابدئي بطبقات خفيفة، وراجعي الأماكن اللي بتلمع خلال اليوم. التثبيت بيعتمد على التحضير وطريقة استخدام المنتج والطقس. راجعي تعليمات العبوة، وخلي أي خطوة جديدة على قد احتياج اللوك.',
 'everyday':'ابدئي باللمسة اللي بتحبيها: طبيعية، مضيئة أو مطفية. لون الخدود والشفايف محتاج مراجعة للدرجة الحقيقية، مش اسمها بس. خدي وقتك في صفحة المنتج وشوفي الحجم والدرجة قبل ما تضيفي للسلة.',
 'hydration':'خلي الترطيب بسيط ومنتظم، وراجعي المكونات وطريقة الاستخدام. جربي أي منتج جديد على منطقة صغيرة الأول. لو عندك حساسية شديدة أو سؤال طبي، خدي رأي مختص بدل ما تعتمدي على توصية تجميلية.',
 'gift':'اسألي عن ذوق الشخص، واستخدامه الحقيقي، والميزانية اللي تناسبك. لو الهدية فيها درجات، الأفضل تتأكدي من اختياره. الحجم ومحتويات الهدية مهمين، وفريق صوفي يقدر يساعدك تقارنيهم.',
 'scent':'ابدئي بعائلات النوتات اللي بتحبيها، وبالمناسبة اللي هتلبسي فيها العطر. قارني الحجم والتركيز، وافتكري إن وصف الريحة بداية للتجربة. لو مش متأكدة، اسألي الفريق عن الاختيارات المتاحة.'
}
CTA='ادخلي على موقع صوفي، واختاري احتياجك وتفضيلاتك وميزانية الروتين بالكامل. هتشوفي اختيارات متاحة وسبب كل اختيار. راجعي الحجم والدرجة، وخدي نفس الاختيارات لفريقنا في ميفيدا لو محتاجة مساعدة.'
start=date(2026,10,13)
rows=[]
for index,(theme,campaign,goal,hooks,carousels) in enumerate(WEEKS,1):
 base=start+timedelta(weeks=index-1)
 slots=[(0,'R1','reel',hooks[0],'Solve'),(1,'C1','carousel',carousels[0],'Choose'),(2,'R2','reel',hooks[1],'Solve'),
        (3,'ST','stories','اختاري سؤال الأسبوع مع صوفي','Community'),(4,'R3','reel',hooks[2],'Discover'),(5,'C2','carousel',carousels[1],'Gift' if campaign=='Gifting' else 'Choose')]
 if index==7: slots=[(3 if suffix=='R3' else offset,suffix,fmt,hook,pillar) for offset,suffix,fmt,hook,pillar in slots]
 for offset,suffix,fmt,hook,pillar in slots:
  content_id=f'W{index:02d}-{suffix}'
  local=datetime.combine(base+timedelta(days=offset),datetime.min.time()).replace(hour=19,minute=30,tzinfo=ZoneInfo('Africa/Cairo'))
  landing='https://sofiestore.net/pages/sofie-knows?'+urlencode({'utm_source':'instagram','utm_medium':'organic_social','utm_campaign':'sofie_knows_q4_2026','utm_content':content_id,'goal':goal})
  spoken=hook+' أنا نور، دليلتك الافتراضية من صوفي. '+TIPS[goal]+' '+CTA
  caption=hook+'\n\n'+TIPS[goal]+'\n\nاختاري روتينك من لينك البايو في SOFIE. ولو محتاجة مساعدة، فريقنا معاكي في The Place Mall، بوابة 8، ميفيدا.\nنور شخصية افتراضية بالذكاء الاصطناعي، والتوصيات للتجميل والعناية العامة.\n#SOFIE #SofieStore #BeautyEgypt'
  slides=[hook,'ابدئي من احتياجك، مش من شهرة المنتج.',TIPS[goal],'راجعي الحجم والدرجة والسعر الحالي.','خلّي صوفي تختار معاكي.\nاختاري روتينك من لينك البايو.']
  story_plan=[{'day':d+1,'frames':['اسألي سؤال التفضيل','قدمي نصيحة واحدة','اعرضي خيارًا متاحًا بعد المراجعة','تصويت بسيط على التفضيل','لينك توصية صوفي']} for d in range(7)]
  rows.append({'id':content_id,'campaign_id':'sofie_knows_q4_2026','title':theme+' | '+suffix,'goal':goal,'channel':'instagram','format':fmt,'pillar':pillar,
   'scheduled_for':local.isoformat(),'status':'draft','hook_ar':hook,'script_ar':spoken,'caption_ar':caption,'landing_url':landing,
   'product_handles':[],'variant_ids':[],'asset_status':'missing','blocker':'Finished asset and verified Instagram account required.',
   'metadata':{'week':index,'theme':theme,'campaign_phase':campaign,'timezone':'Africa/Cairo','budget':10000,'target_seconds':45 if fmt=='reel' else None,
    'duration_measured':False,'ai_character':fmt=='reel','ai_disclosed':True,'claims_checked':False,'slides':slides if fmt=='carousel' else None,'daily_stories':story_plan if fmt=='stories' else None,
    'production':'0–3s problem hook; 3–12s why it matters; 12–32s practical tip; 32–42s real site demonstration; 42–48s CTA. Measure Egyptian-Arabic voice timing before publishing. Never show generated skin changes as real results.'}})
Path(__file__).with_name('calendar.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(json.dumps({'records':len(rows),'reels':sum(r['format']=='reel' for r in rows),'carousels':sum(r['format']=='carousel' for r in rows),'story_packages':sum(r['format']=='stories' for r in rows),'first':rows[0]['scheduled_for'],'last':rows[-1]['scheduled_for']},ensure_ascii=False))
