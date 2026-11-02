import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
const derive=secret=>{if(!secret)throw Error('identity_unconfigured');return createHash('sha256').update('SOFIE:reco:identity:v2:'+secret).digest();};
export function issueIdentity(customerId,shop,secret,now=Date.now()) {
 if(!/^gid:\/\/shopify\/Customer\/\d{1,20}$/.test(customerId)||!/^[-a-z0-9]+\.myshopify\.com$/.test(shop))throw Error('invalid_identity');
 const key=derive(secret),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.from(JSON.stringify({customerId,shop,aud:'sofie-for-you-v2',exp:now+120000}));
 const encrypted=Buffer.concat([cipher.update(body),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function readIdentity(ticket,shop,secret,now=Date.now()) {
 if(!secret||typeof ticket!=='string'||ticket.length>1000||!/^[-A-Za-z0-9_]+$/.test(ticket))return null;
 try{
  const data=Buffer.from(ticket,'base64url');if(data.length<29)return null;
  const key=derive(secret),decipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));
  decipher.setAuthTag(data.subarray(12,28));
  const claims=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]));
  if(claims.shop!==shop||claims.aud!=='sofie-for-you-v2'||!Number.isFinite(claims.exp)||claims.exp<=now||claims.exp>now+125000||
   !/^gid:\/\/shopify\/Customer\/\d{1,20}$/.test(claims.customerId))return null;
  return {customerId:claims.customerId,subject:createHmac('sha256',key).update(claims.customerId).digest('hex')};
 }catch{return null;}
}
