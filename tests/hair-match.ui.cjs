const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const os=require('node:os');
const project=path.resolve(__dirname,'..');
const dir=process.env.HAIR_TEST_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(),'sofie-hair-ui-'));
const theme=path.join(project,'storefront');
const strings=JSON.parse(fs.readFileSync(path.join(theme,'locales/en.default.json'))).sf.hair;
const products=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/hair-products.json')));
const cfg={root:'/',collection:'/collections/all-hair',currency:'EGP',locale:'en',strings};
let requests=[];let cartRequests=[];let changedPrice=false;let noFeed=false;
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');requests.push(req.url);
  if(u.pathname.startsWith('/assets/')){res.setHeader('Content-Type',u.pathname.endsWith('.css')?'text/css':'application/javascript');return res.end(fs.readFileSync(path.join(theme,u.pathname)));}
  if(u.pathname==='/collections/all-hair' && u.searchParams.get('view')==='sfhair'){
    if(req.headers.accept==='application/json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({collection:{handle:'all-hair'}}));}
    res.setHeader('Content-Type','application/json');if(noFeed){res.statusCode=503;return res.end('{}');}
    const pg=Number(u.searchParams.get('page') || 1);return res.end(JSON.stringify({version:1,products:products.slice((pg-1)*3,pg*3),next:pg===1?'/collections/all-hair?page=2&view=sfhair':false}));
  }
  if(u.pathname.startsWith('/products/') && u.pathname.endsWith('.js')){
    const handle=decodeURIComponent(u.pathname.slice(10,-3));const p=products.find(p=>p.handle===handle);
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...p,variants:p.variants.map(v=>({...v,price:v.price+(changedPrice?100:0)}))}));
  }
  if(u.pathname==='/cart/add.js'){
    let data='';req.on('data',d=>data+=d);req.on('end',()=>{cartRequests.push(JSON.parse(data));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({items:JSON.parse(data).items}));});return;
  }
  if(u.pathname==='/cart.js'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({items:[]}));}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOFIE Hair Match test</title><link rel="stylesheet" href="/assets/sofie-hair-match.css"><style>body{margin:0;background:white;font-family:Arial,sans-serif}button,a,input,select{-webkit-tap-highlight-color:transparent}header.mock{font-family:Georgia,serif;letter-spacing:8px;text-align:center;padding:23px;border-bottom:1px solid #eee;font-size:24px}h1,h2,h3,p{overflow-wrap:break-word}</style><header class="mock">SOFIE</header><section class="sfhair" data-hair-match><header class="sfhair-hero"><div><p class="sfhair-kicker">SOFIE Hair Match</p><h1>'+strings.hero_title+'</h1></div><p>'+strings.hero_copy+'</p></header><div data-hair-app></div><script type="application/json" data-hair-config>'+JSON.stringify(cfg)+'</script></section><script src="/assets/sofie-hair-engine.js" defer></script><script src="/assets/sofie-hair-match.js" defer></script></html>');
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port+'/?preview_theme_id=161076838471');
  await page.getByRole('button',{name:'Find my hair ritual'}).waitFor();
  await page.screenshot({path:path.join(dir,'hair-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Find my hair ritual'}).click();
  const choose=async(name,value)=>{await page.locator('input[name="'+name+'"][value="'+value+'"]').check();await page.locator('[data-hair-act=next]').click();};
  assert.equal(await page.locator('[data-hair-act=next]').isDisabled(),true);
  await choose('pattern','curly');await choose('strand','fine');await choose('scalp','balanced');await choose('colour','natural');
  assert.equal(await page.locator('[value=brass]').count(),0);
  await page.locator('[value=dryness]').check();await page.locator('[value=frizz]').check();await page.locator('[value=damage]').click();
  await assert.equal(await page.locator('[value=damage]').isChecked(),false);
  assert.match(await page.locator('[data-hair-validation]').textContent(),/up to two/);
  await page.locator('[data-hair-act=next]').click();
  await choose('heat','never');await choose('wash','few_days');await choose('size','essential');
  assert.equal(await page.locator('[data-hair-act=next]').isEnabled(),true);
  await page.locator('[data-hair-act=next]').click();await page.locator('.sfhair-card').first().waitFor();
  assert.equal(await page.locator('.sfhair-card').count(),3);
  assert.ok(requests.some(x=>x.includes('page=2') && x.includes('preview_theme_id=161076838471')));
  await page.screenshot({path:path.join(dir,'hair-results-desktop.png'),fullPage:true});
  await page.locator('[data-hair-act=save_profile]').click();assert.match(await page.locator('[data-hair-status]').textContent(),/saved on this device/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sofie-hair-profile-v1')).answers.strand),'fine');
  await page.evaluate(()=>{window.savedPassport=null;window.SofiePassport={load:async()=>({version:4,passport:{saved:[{handle:'skin-care',variantId:'5'}],routine:[{handle:'old-skin-routine'}]}}),save:async(patch,options)=>{window.savedPassport={patch,options};}};});
  await page.locator('[data-hair-act=save_passport]').click();
  const saved=await page.evaluate(()=>window.savedPassport);assert.equal(saved.options.expectedVersion,4);assert.equal(saved.patch.saved[0].handle,'skin-care');assert.equal('routine' in saved.patch,false);
  await page.locator('[data-hair-act=add_all]').click();await page.waitForFunction(()=>document.querySelector('[data-hair-status]').textContent.includes('Added to your bag'));
  assert.equal(cartRequests.length,1);assert.equal(cartRequests[0].items.length,3);assert.equal(new Set(cartRequests[0].items.map(i=>i.id)).size,3);
  changedPrice=true;await page.locator('[data-hair-act=add_all]').click();await page.waitForFunction(()=>document.querySelector('[data-hair-status]').textContent.includes('changed price'));
  assert.equal(cartRequests.length,1);changedPrice=false;
  await page.locator('[data-hair-now]').check();await page.getByRole('heading',{name:'A ritual that feels like you.'}).waitFor();
  assert.equal(await page.locator('.sfhair-card').count(),0);assert.ok(await page.locator('.sfhair-gap').count()>=2);assert.equal(await page.locator('[data-hair-act=add_all]').isDisabled(),true);
  await page.locator('[data-hair-act=home]').click();await page.locator('[data-hair-act=resume]').click();await page.locator('.sfhair-card').first().waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(dir,'hair-results-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-hair-act=home]').click();await page.screenshot({path:path.join(dir,'hair-mobile.png'),fullPage:true});
  await page.locator('[data-hair-act=begin]').click();await choose('pattern','coily');await choose('strand','thick');await choose('scalp','pain');
  await page.getByRole('heading',{name:'Let’s start with professional care.'}).waitFor();assert.equal(await page.locator('.sfhair-card').count(),0);
  await page.screenshot({path:path.join(dir,'hair-referral-mobile.png'),fullPage:true});
  await page.locator('[data-hair-act=edit]').click();await choose('pattern','straight');await choose('strand','fine');await choose('scalp','balanced');await choose('colour','natural');
  await page.locator('[value=maintain]').check();await page.locator('[data-hair-act=next]').click();await choose('heat','never');await choose('wash','daily');await choose('size','essential');
  noFeed=true;await page.locator('[data-hair-act=next]').click();await page.locator('[data-hair-now]').click();await page.getByRole('heading',{name:'We couldn’t check the shelves.'}).waitFor();
  noFeed=false;await page.locator('[data-hair-act=retry]').click();await page.getByRole('heading',{name:'A ritual that feels like you.'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'passed',checks:['desktop and 390px mobile layouts','required answers and optional budget','two-concern limit','complete paginated catalog with preview parameter','available size choices','three unique cart items','stale price blocks cart','strict SOFIE NOW empty state','device save and resume','passport preserves skincare and existing saved items','painful scalp stops recommendations','catalog failure and retry'],pageErrors:errors,cartRequests:cartRequests.length},null,2));
  await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
