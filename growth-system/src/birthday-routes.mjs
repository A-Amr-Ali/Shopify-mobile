import { readFile } from 'node:fs/promises';
import { createHmac, randomBytes } from 'node:crypto';
import { secretMatches, privateActor } from './security.mjs';
import { takeBudget } from './db.mjs';
import { birthdayDashboard } from './birthdays.mjs';

const root = new URL('../private/', import.meta.url);
const secret = () => process.env.PROCUREMENT_KEY || process.env.STAFF_KEY;
const json = (res, status, data) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}); res.end(JSON.stringify(data)); };
function token(key, now = Date.now()) { const payload=Buffer.from(JSON.stringify({exp:now+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url'); return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url'); }
function validToken(value, key, now = Date.now()) { if(!key||typeof value!=='string'||value.length>1000)return false; const [payload,sig,...rest]=value.split('.'); if(rest.length||!payload||!sig||!secretMatches(sig,createHmac('sha256',key).update(payload).digest('base64url')))return false; try{const data=JSON.parse(Buffer.from(payload,'base64url'));return Number.isFinite(data.exp)&&data.exp>now&&data.exp<=now+8*3600000+60000;}catch{return false;} }
function authorized(req) { const bearer=String(req.headers.authorization||'').replace(/^Bearer /,''); const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sofie_ops='))?.slice(10); return secretMatches(bearer,secret())||validToken(cookie,secret()); }
function validOrigin(req){if(!req.headers.origin)return Boolean(req.headers.authorization);try{const origin=new URL(req.headers.origin);return origin.origin===process.env.PUBLIC_ORIGIN?.replace(/\/$/,'')||(process.env.NODE_ENV!=='production'&&origin.hostname==='localhost');}catch{return false;}}
async function body(req){const chunks=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>20000)throw new Error('invalid_body');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks));}catch{throw new Error('invalid_json');}}

export async function birthdayRoutes(req, res, url) {
  if (!url.pathname.startsWith('/ops/birthdays')) return false;
  res.setHeader('cache-control','no-store'); res.setHeader('x-frame-options','DENY'); res.setHeader('referrer-policy','no-referrer'); res.setHeader('x-robots-tag','noindex, nofollow, noarchive');
  res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const assets={'/ops/birthdays':['birthdays.html','text/html; charset=utf-8'],'/ops/birthdays/':['birthdays.html','text/html; charset=utf-8'],'/ops/birthdays/app.js':['birthdays.js','text/javascript; charset=utf-8'],'/ops/birthdays/style.css':['birthdays.css','text/css; charset=utf-8']};
  if(req.method==='GET'&&assets[url.pathname]){const [file,mime]=assets[url.pathname];res.writeHead(200,{'content-type':mime});res.end(await readFile(new URL(file,root)));return true;}
  if(req.method==='POST'&&!validOrigin(req)){json(res,403,{error:'origin_not_allowed'});return true;}
  if(url.pathname==='/ops/birthdays/session'&&req.method==='POST'){
    if(!await takeBudget('birthday_login',privateActor(req),15,3600)){json(res,429,{error:'too_many_attempts'});return true;}
    const data=await body(req); if(!secretMatches(data.password,secret())){json(res,401,{error:'incorrect_password'});return true;}
    res.setHeader('set-cookie','sofie_ops='+token(secret())+'; Path=/ops; HttpOnly; SameSite=Strict; Max-Age=28800'+(process.env.NODE_ENV==='production'?'; Secure':'')); json(res,200,{signedIn:true});return true;
  }
  if(!authorized(req)){json(res,401,{error:'sign_in_required'});return true;}
  if(url.pathname==='/ops/birthdays/logout'&&req.method==='POST'){res.setHeader('set-cookie','sofie_ops=; Path=/ops; HttpOnly; SameSite=Strict; Max-Age=0'+(process.env.NODE_ENV==='production'?'; Secure':''));json(res,200,{signedOut:true});return true;}
  if(url.pathname==='/ops/birthdays/data'&&req.method==='GET'){json(res,200,await birthdayDashboard());return true;}
  json(res,404,{error:'not_found'});return true;
}
