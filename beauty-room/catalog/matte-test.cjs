const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const scope={window:{},Uint8ClampedArray,Uint8Array,Int32Array,Map,WeakSet,Math,Promise};
vm.runInNewContext(fs.readFileSync(__dirname+'/../theme/assets/sofie-room-cutouts.js','utf8'),scope);
const matte=scope.window.SofieRoomCutouts.matte,checks=[];
function image(w,h,rgb,alpha=255){const a=new Uint8ClampedArray(w*h*4);for(let i=0;i<a.length;i+=4){a[i]=rgb[0];a[i+1]=rgb[1];a[i+2]=rgb[2];a[i+3]=alpha;}return a;}
function rect(a,w,x1,y1,x2,y2,rgb){for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++){const p=(y*w+x)*4;a[p]=rgb[0];a[p+1]=rgb[1];a[p+2]=rgb[2];a[p+3]=255;}}
const check=(name,fn)=>{fn();checks.push({name,passed:true});};
const w=90,h=120,white=image(w,h,[255,255,255]);
rect(white,w,28,17,63,105,[130,130,130]);rect(white,w,30,19,61,103,[252,252,252]);
const before=white.slice(),result=matte(white,w,h);
check('Outside white backdrop becomes transparent',()=>assert.equal(result.data[3],0));
check('White packaging inside its contour stays opaque',()=>assert.equal(result.data[(60*w+45)*4+3],255));
check('Product colors are preserved',()=>assert.deepEqual(Array.from(result.data.slice((60*w+45)*4,(60*w+45)*4+3)),[252,252,252]));
check('Original source pixels are never mutated',()=>assert.deepEqual(white,before));
const pink=image(w,h,[225,205,195]);rect(pink,w,30,12,61,108,[110,30,45]);rect(pink,w,35,58,56,73,[255,250,240]);
const pinkResult=matte(pink,w,h);
check('A flat colored backdrop also becomes transparent',()=>assert.equal(pinkResult.data[3],0));
check('A light label on a colored bottle stays intact',()=>assert.equal(pinkResult.data[(65*w+45)*4+3],255));
const isolated=image(w,h,[0,0,0],0);rect(isolated,w,32,10,58,110,[185,122,94]);const isolatedResult=matte(isolated,w,h);
check('Existing isolated assets retain their alpha and colors',()=>{assert.equal(isolatedResult.isolated,true);assert.deepEqual(Array.from(isolatedResult.data),Array.from(isolated));});
check('Blank photos are rejected rather than inventing a product',()=>assert.equal(matte(image(w,h,[255,255,255]),w,h).bounds,null));
fs.writeFileSync(__dirname+'/matte-test-results.json',JSON.stringify({passed:checks.length,checks},null,2)+'\n');
console.log(JSON.stringify({passed:checks.length,checks:checks.map(c=>c.name)}));
