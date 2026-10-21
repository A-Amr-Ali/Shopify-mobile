(() => {
  'use strict';
  if (window.SofieRoomCutouts) return;
  const cache = new Map();
  const distance = (r,g,b,c) => Math.max(Math.abs(r-c[0]),Math.abs(g-c[1]),Math.abs(b-c[2]));
  function bounds(data,w,h) {
    let left=w,top=h,right=-1,bottom=-1,count=0;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(data[(y*w+x)*4+3]>50) {
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;
    }
    return right<left ? null : {left,top,right,bottom,count};
  }
  // Only a background connected to the outside is masked. White packaging inside
  // a product's contour is retained; the original catalog image is never changed.
  function matte(source,w,h) {
    const data=new Uint8ClampedArray(source),n=w*h;
    let clear=0;
    for(let p=3;p<data.length;p+=4) if(data[p]<32) clear++;
    if(clear>n*.01) return {data,bounds:bounds(data,w,h),score:1,isolated:true};
    const corners=[];
    for(const [sx,sy] of [[0,0],[w-5,0],[0,h-5],[w-5,h-5]]) {
      const values=[[],[],[]];
      for(let y=Math.max(0,sy);y<Math.min(h,sy+5);y++) for(let x=Math.max(0,sx);x<Math.min(w,sx+5);x++) {
        const p=(y*w+x)*4;for(let c=0;c<3;c++) values[c].push(data[p+c]);
      }
      corners.push(values.map(v=>v.sort((a,b)=>a-b)[Math.floor(v.length/2)]||0));
    }
    const barrier=new Uint8Array(n),visited=new Uint8Array(n),queue=new Int32Array(n);
    function bgDistance(x,y,p) {
      const fx=x/Math.max(1,w-1),fy=y/Math.max(1,h-1),interpolated=[0,0,0];
      for(let c=0;c<3;c++) interpolated[c]=(corners[0][c]*(1-fx)+corners[1][c]*fx)*(1-fy)+(corners[2][c]*(1-fx)+corners[3][c]*fx)*fy;
      let d=distance(data[p],data[p+1],data[p+2],interpolated);
      for(const corner of corners) d=Math.min(d,distance(data[p],data[p+1],data[p+2],corner));
      return d;
    }
    for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) {
      const p=(y*w+x)*4;let edge=0;
      for(let c=0;c<3;c++) edge=Math.max(edge,Math.abs(data[p-4+c]-data[p+4+c]),Math.abs(data[p-w*4+c]-data[p+w*4+c]));
      if(edge>13) barrier[y*w+x]=1;
    }
    let head=0,tail=0;
    function offer(x,y) {
      if(x<0||x>=w||y<0||y>=h)return;
      const i=y*w+x;if(visited[i]||barrier[i])return;
      const p=i*4,d=bgDistance(x,y,p);
      if(d>24) {
        // Smooth neutral cast shadows belong to the backdrop, not the bottle.
        const spread=Math.max(data[p],data[p+1],data[p+2])-Math.min(data[p],data[p+1],data[p+2]);
        if(d>64||spread>24)return;
      }
      visited[i]=1;queue[tail++]=i;
    }
    for(let x=0;x<w;x++){offer(x,0);offer(x,h-1);}
    for(let y=0;y<h;y++){offer(0,y);offer(w-1,y);}
    while(head<tail) {const i=queue[head++],x=i%w,y=Math.floor(i/w);offer(x-1,y);offer(x+1,y);offer(x,y-1);offer(x,y+1);}
    for(let i=0;i<n;i++) if(visited[i])data[i*4+3]=0;
    // Feather the exterior edge without affecting enclosed white details.
    for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++) {
      const i=y*w+x;if(visited[i])continue;
      if(!(visited[i-1]||visited[i+1]||visited[i-w]||visited[i+w]))continue;
      const p=i*4,d=bgDistance(x,y,p);
      if(d<38)data[p+3]=Math.round(data[p+3]*Math.max(.15,Math.min(1,(d-9)/29)));
    }
    const box=bounds(data,w,h),removed=tail/n;
    if(!box||box.count<n*.004)return {data:new Uint8ClampedArray(source),bounds:null,score:0,isolated:false};
    let noise=0;
    for(const [sx,sy,c] of [[0,0,corners[0]],[w-5,0,corners[1]],[0,h-5,corners[2]],[w-5,h-5,corners[3]]])
      for(let y=Math.max(0,sy);y<Math.min(h,sy+5);y++)for(let x=Math.max(0,sx);x<Math.min(w,sx+5);x++){const p=(y*w+x)*4;noise+=distance(source[p],source[p+1],source[p+2],c);}
    noise/=100;
    const touches=Number(box.left<2)+Number(box.top<2)+Number(box.right>w-3)+Number(box.bottom>h-3);
    const density=box.count/((box.right-box.left+1)*(box.bottom-box.top+1)),slender=(box.right-box.left+1)/(box.bottom-box.top+1)<.35;
    const confidence=slender&&density<.5?density/.65:1;
    const score=Math.max(0,Math.min(1,(.42+removed*.58-noise*.025-touches*.055)*confidence));
    return {data,bounds:box,score,removed,isolated:false};
  }
  const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  let worker=null,workerBlocked=false,sequence=0;
  const pendingWork=new Map();
  function compute(source,w,h) {
    if(!worker&&!workerBlocked&&typeof Worker==='function') {
      try {
        const code='const distance='+distance.toString()+';const bounds='+bounds.toString()+';const matte='+matte.toString()+';self.onmessage=event=>{const {id,buffer,w,h}=event.data;try{const result=matte(new Uint8ClampedArray(buffer),w,h);self.postMessage({id,result},[result.data.buffer]);}catch(error){self.postMessage({id,error:String(error)});}};';
        const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
        worker=new Worker(url);URL.revokeObjectURL(url);
        worker.onmessage=event=>{const job=pendingWork.get(event.data.id);if(!job)return;pendingWork.delete(event.data.id);if(event.data.error)job.reject(new Error(event.data.error));else job.resolve(event.data.result);};
        worker.onerror=()=>{workerBlocked=true;worker?.terminate();worker=null;for(const job of pendingWork.values())job.reject(new Error('Image worker unavailable'));pendingWork.clear();};
      }catch{workerBlocked=true;worker=null;}
    }
    if(!worker)return nextFrame().then(()=>matte(source,w,h));
    return new Promise((resolve,reject)=>{const id=++sequence;pendingWork.set(id,{resolve,reject});const copy=source.slice();worker.postMessage({id,buffer:copy.buffer,w,h},[copy.buffer]);}).catch(()=>nextFrame().then(()=>matte(source,w,h)));
  }
  function load(src) {
    return new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Image unavailable'));image.src=src;});
  }
  async function prepareImage(src,crop) {
    const cacheKey=src+(crop||'');
    if(cache.has(cacheKey)){const result=cache.get(cacheKey);cache.delete(cacheKey);cache.set(cacheKey,result);return result;}
    const image=await load(src);let area=[0,0,1,1];
    if(crop){const parts=crop.split(',').map(Number);if(parts.length===4&&parts.every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&parts[2]>0&&parts[3]>0&&parts[0]+parts[2]<=1&&parts[1]+parts[3]<=1)area=parts;}
    const sw=image.naturalWidth*area[2],sh=image.naturalHeight*area[3],scale=Math.min(1,640/Math.max(sw,sh));
    const w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));
    const surface=document.createElement('canvas');surface.width=w;surface.height=h;
    const context=surface.getContext('2d',{willReadFrequently:true});context.drawImage(image,image.naturalWidth*area[0],image.naturalHeight*area[1],sw,sh,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h),result=await compute(pixels.data,w,h);
    if(!result.bounds)return result;
    context.putImageData(new ImageData(result.data,w,h),0,0);
    const b=result.bounds,pad=3,out=document.createElement('canvas');
    out.width=b.right-b.left+1+pad*2;out.height=b.bottom-b.top+1+pad*2;
    out.getContext('2d').drawImage(surface,b.left,b.top,b.right-b.left+1,b.bottom-b.top+1,pad,pad,b.right-b.left+1,b.bottom-b.top+1);
    const value={canvas:out,score:result.score,isolated:result.isolated};cache.set(cacheKey,value);
    if(cache.size>32)cache.delete(cache.keys().next().value);
    return value;
  }
  function observe(root) {
    const queue=[],pending=new WeakSet();let active=0,closed=false;
    async function render(holder) {
      const image=holder.querySelector('img');if(!image)return;
      holder.setAttribute('aria-busy','true');holder.classList.add('is-matting');
      try {
        const primary=image.src;let candidates=[];
        try{candidates=JSON.parse(holder.dataset.sfbrGallery||'[]');}catch{}
        if(holder.hasAttribute('data-sfbr-isolated'))candidates=[];
        const absolute=src=>new URL(src,document.baseURI).href;
        const urls=[...new Set([primary,...candidates].map(absolute))].filter(src=>src===absolute(primary)||!/(?:swatch|shade[-_]?(?:grid|range)|before[-_]?after|(?:-|_)av(?:-|_)|model|lifestyle)/i.test(src)).slice(0,4);let best=null;
        for(const src of urls){try{const candidate=await prepareImage(src,src===absolute(primary)?holder.dataset.sfbrCrop:null);if(candidate.canvas&&(!best||candidate.score>best.score))best=candidate;if(candidate.isolated||(src===absolute(primary)&&candidate.canvas&&candidate.score>.65)||best?.score>=.8)break;}catch{}await nextFrame();}
        if(best?.canvas&&best.score>.65&&holder.isConnected&&!closed){
          const canvas=document.createElement('canvas');canvas.width=best.canvas.width;canvas.height=best.canvas.height;canvas.className='sfbr-product-cutout';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',image.alt);canvas.getContext('2d').drawImage(best.canvas,0,0);
          holder.querySelector('.sfbr-product-cutout')?.remove();holder.insertBefore(canvas,image);image.hidden=true;holder.dataset.sfbrProcessed='true';holder.dataset.sfbrMatteScore=best.score.toFixed(3);
        }else holder.dataset.sfbrProcessed='fallback';
      }finally{holder.removeAttribute('aria-busy');holder.classList.remove('is-matting');}
    }
    function drain(){if(closed)return;while(active<2&&queue.length){const holder=queue.shift();active++;nextFrame().then(()=>render(holder)).catch(()=>{holder.dataset.sfbrProcessed='fallback';holder.removeAttribute('aria-busy');holder.classList.remove('is-matting');}).finally(()=>{active--;drain();});}}
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);queue.push(entry.target);}drain();},{rootMargin:'180px'}):null;
    function add(scope){scope.querySelectorAll('[data-sfbr-matte]').forEach(holder=>{if(pending.has(holder)||holder.dataset.sfbrProcessed)return;pending.add(holder);if(observer)observer.observe(holder);else queue.push(holder);});drain();}
    add(root);
    return {add,disconnect(){closed=true;observer?.disconnect();queue.length=0;}};
  }
  window.SofieRoomCutouts={matte,observe};
})();
