import { spawn } from 'node:child_process';

const server=spawn('npm',['exec','--','remix-serve','./build/server/index.js'],{stdio:'inherit',env:process.env});
let running=false;
async function birthdays() {
  if (running || !process.env.CRON_KEY || process.env.BIRTHDAY_JOBS==='false') return;
  running=true;
  try {
    const response=await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/jobs/birthday-daily`,{method:'POST',headers:{'x-cron-key':process.env.CRON_KEY,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(120000)});
    const result=await response.json();
    console.log('birthday_job',JSON.stringify({status:response.status,...result}));
  } catch (error) { console.warn('birthday_job_unavailable',error.name); }
  finally {running=false;}
}
const first=setTimeout(birthdays,15000);
const timer=setInterval(birthdays,15*60*1000);
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>{clearTimeout(first);clearInterval(timer);server.kill(signal);});
server.on('exit',code=>{clearTimeout(first);clearInterval(timer);process.exit(code ?? 1);});
