import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {procurementRoutes} from '../src/procurement-routes.mjs';

const source=readFileSync(new URL('../private/procurement.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../private/procurement.html',import.meta.url),'utf8');
function client(){
  const node=()=>({value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,open:false,dataset:{},classList:{toggle(){}},addEventListener(){},reset(){},showModal(){this.open=true;},close(){this.open=false;}});
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],node()]));
  for(const id of ['status-filter','region-filter'])elements.get(id).value='all';
  const filters=node(),writes=[];
  const document={getElementById:id=>{assert.ok(elements.has(id),'Missing DOM element '+id);return elements.get(id);},querySelector:()=>filters,querySelectorAll:selector=>{
    const attribute=selector.match(/^\[data-([^\]]+)\]$/)?.[1];if(!attribute)return [];
    const markup=attribute==='tab'?html:elements.get('content').innerHTML;
    return [...markup.matchAll(new RegExp('data-'+attribute+'="([^"]+)"','g'))].map(m=>{const n=node();n.dataset[attribute.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=m[1];return n;});
  }};
  const now=new Date().toISOString(),line={variantId:'gid://shopify/ProductVariant/123',title:'Example <exact> product',brand:'BUBBLE',option:'4.4g',status:'needs_sourcing',quantity:2,outstanding:2,source:{inferred:true},orders:[{orderName:'#2452',quantity:2}],offers:[{url:'https://hellobubble.com/products/tell-all-juicy-secret',retailer:'Bubble',region:'US',stock_status:'unverified',price:9,currency:'USD'}],research:{finishedAt:now,nextRetryAt:now,attempts:[{supplier:'Sephora UAE',status:'blocked',detail:'Stock was not assumed.'}]}};
  const data={summary:{openOrders:1,needToBuy:2,uniqueOptions:1,ready:0,purchased:0,localSkipped:0,missingWeights:1},runs:[],lines:[line],demand:[line],purchases:[],routingNotice:'Review inferred sources.',sourcingPriority:'Sephora UAE → US → UK → official → Ulta',jobRunning:false,sourcingRunning:false};
  const context=vm.createContext({document,Intl,Date,console,crypto:{randomUUID:()=> 'qa'},setTimeout(){},setInterval(){},fetch:async(url,init={})=>{if(init.method==='POST'){writes.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify(url.endsWith('/source-link')?{result:{message:'Exact option verified and saved.'}}:{started:true}));}return new Response(JSON.stringify(data));}});
  vm.runInContext(source,context);
  return {context,elements,writes,ready:()=>vm.runInContext('load()',context),run:code=>vm.runInContext(code,context)};
}
test('buying desk renders honest supplier trace and escapes product text',async()=>{
  const c=client();await c.ready();assert.equal(c.elements.get('workspace').hidden,false);
  const content=c.elements.get('content').innerHTML;
  assert.match(content,/Automated access blocked/);assert.match(content,/Candidate only — stock\/option NOT verified/);assert.match(content,/Example &lt;exact&gt; product/);assert.doesNotMatch(content,/Open exact product/);
});
test('known-link verification and product research submit only their intended fields',async()=>{
  const c=client();await c.ready();
  // Invoke the bound event handler using a captured UI button.
  c.run("globalThis.qaButton=null;const oldQuery=document.querySelectorAll;document.querySelectorAll=s=>{const rows=oldQuery(s);if(s==='[data-source-link]')globalThis.qaButton=rows[0];return rows;};bindRowActions();qaButton.onclick();document.querySelectorAll=oldQuery;");
  assert.equal(c.elements.get('source-link').open,true);
  c.elements.get('source-link-url').value='https://hellobubble.com/products/tell-all-juicy-secret';c.elements.get('source-link-region').value='US';
  await c.elements.get('source-link-form').onsubmit({preventDefault(){},submitter:{disabled:false}});
  assert.deepEqual(c.writes[0],{url:'/ops/procurement/source-link',body:{variantId:'gid://shopify/ProductVariant/123',url:'https://hellobubble.com/products/tell-all-juicy-secret',region:'US'}});
  assert.equal(c.elements.get('source-link').open,false);
  await c.elements.get('research-all').onclick();assert.equal(c.writes[1].url,'/ops/procurement/research');assert.deepEqual(c.writes[1].body,{});
});
test('new sourcing endpoints remain private without a valid session',async()=>{
  for(const path of ['research','source-link']){
    let status,body;const res={setHeader(){},writeHead(s){status=s;},end(value){body=JSON.parse(value);}};
    const req={method:'POST',headers:{authorization:'Bearer not-a-valid-operations-key'}};
    await procurementRoutes(req,res,new URL('https://example.com/ops/procurement/'+path));
    assert.equal(status,401);assert.equal(body.error,'sign_in_required');
  }
});
