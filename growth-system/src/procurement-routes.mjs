import { readFile } from 'node:fs/promises';
import { createHmac, randomBytes } from 'node:crypto';
import { secretMatches, privateActor } from './security.mjs';
import { takeBudget } from './db.mjs';
import { procurementDashboard, syncProcurement, refreshProcurementSources, discoverProcurementSources, saveOption, saveSource, recordPurchase, undoPurchase, costEstimate, exportCsv } from './procurement.mjs';

const root=new URL('../private/',import.meta.url);
const secret=()=>process.env.PROCUREMENT_KEY||process.env.STAFF_KEY;
const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
export function sessionToken(key,now=Date.now()) {
  const payload=Buffer.from(JSON.stringify({exp:now+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}
export function checkSession(token,key,now=Date.now()) {
  if(!key||typeof token!=='string'||token.length>1000)return false;
  const [payload,sig,...rest]=token.split('.');if(rest.length||!payload||!sig)return false;
  if(!secretMatches(sig,createHmac('sha256',key).update(payload).digest('base64url')))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url'));return Number.isFinite(data.exp)&&data.exp>now&&data.exp<=now+8*3600000+60000;}catch{return false;}
}
function authorized(req){const bearer=String(req.headers.authorization||'').replace(/^Bearer /,'');return secretMatches(bearer,secret())||checkSession(String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sofie_ops='))?.slice(10),secret());}
function validOrigin(req){if(!req.headers.origin)return Boolean(req.headers.authorization);try{const o=new URL(req.headers.origin);return o.origin===process.env.PUBLIC_ORIGIN?.replace(/\/$/,'')||(process.env.NODE_ENV!=='production'&&o.hostname==='localhost');}catch{return false;}}
async function body(req){const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>20000)throw new Error('invalid_body');chunks.push(c);}try{return JSON.parse(Buffer.concat(chunks));}catch{throw new Error('invalid_json');}}
let running=false;
let sourcingRunning=false;
function background(task){if(running)return false;running=true;task().catch(e=>console.warn('procurement job:',e.message)).finally(()=>{running=false;});return true;}
function research(){if(sourcingRunning)return;sourcingRunning=true;discoverProcurementSources().catch(e=>console.warn('procurement sourcing:',e.message)).finally(()=>{sourcingRunning=false;});}
export async function procurementRoutes(req,res,url) {
  if(!url.pathname.startsWith('/ops/procurement'))return false;
  res.setHeader('cache-control','no-store');res.setHeader('x-frame-options','DENY');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-robots-tag','noindex, nofollow, noarchive');
  res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const assets={'/ops/procurement':['procurement.html','text/html; charset=utf-8'],'/ops/procurement/':['procurement.html','text/html; charset=utf-8'],
    '/ops/procurement/app.js':['procurement.js','text/javascript; charset=utf-8'],'/ops/procurement/style.css':['procurement.css','text/css; charset=utf-8']};
  if(req.method==='GET'&&assets[url.pathname]){const [file,mime]=assets[url.pathname];res.writeHead(200,{'content-type':mime});res.end(await readFile(new URL(file,root)));return true;}
  if(req.method==='POST'&&!validOrigin(req)){json(res,403,{error:'origin_not_allowed'});return true;}
  if(url.pathname==='/ops/procurement/session'&&req.method==='POST'){
    if(!await takeBudget('procurement_login',privateActor(req),15,3600)){json(res,429,{error:'too_many_attempts'});return true;}
    const data=await body(req);
    if(!secretMatches(data.password,secret())){json(res,401,{error:'incorrect_password'});return true;}
    res.setHeader('set-cookie','sofie_ops='+sessionToken(secret())+'; Path=/ops/procurement; HttpOnly; SameSite=Strict; Max-Age=28800'+(process.env.NODE_ENV==='production'?'; Secure':''));
    json(res,200,{signedIn:true});return true;
  }
  if(!authorized(req)){json(res,401,{error:'sign_in_required'});return true;}
  if(url.pathname==='/ops/procurement/logout'&&req.method==='POST'){res.setHeader('set-cookie','sofie_ops=; Path=/ops/procurement; HttpOnly; SameSite=Strict; Max-Age=0; Secure');json(res,200,{signedOut:true});return true;}
  if(url.pathname==='/ops/procurement/data'&&req.method==='GET'){const data=await procurementDashboard();json(res,200,{...data,jobRunning:running,sourcingRunning,shopAdmin:process.env.SHOP_DOMAIN?'https://'+process.env.SHOP_DOMAIN+'/admin/orders/':null});return true;}
  if(url.pathname==='/ops/procurement/export.csv'&&req.method==='GET'){const csv=exportCsv(await procurementDashboard());res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="SOFIE-Purchase-Queue.csv"'});res.end(csv);return true;}
  if(req.method==='POST'){
    if(url.pathname==='/ops/procurement/sync'){const started=background(async()=>{await syncProcurement();research();});json(res,202,{started});return true;}
    const data=await body(req);let result;
    if(url.pathname==='/ops/procurement/option')result=await saveOption(data);
    else if(url.pathname==='/ops/procurement/source')result=await saveSource(data);
    else if(url.pathname==='/ops/procurement/purchase')result=await recordPurchase(data);
    else if(url.pathname==='/ops/procurement/undo')result=await undoPurchase(data.id);
    else if(url.pathname==='/ops/procurement/calculate')result=costEstimate(data.region,data.price,data.weightKg,data.quantity||1);
    else{json(res,404,{error:'not_found'});return true;}
    json(res,200,{result});return true;
  }
  json(res,404,{error:'not_found'});return true;
}
export function startProcurementJobs(){if(process.env.PROCUREMENT_ENABLED!=='true')return;const run=()=>background(async()=>{await syncProcurement();research();});setTimeout(run,5000).unref();setInterval(run,5*60000).unref();
  setInterval(()=>refreshProcurementSources().catch(e=>console.warn('procurement source refresh:',e.message)),60*60000).unref();}
