// GET /staff/home — Mission Control. One hub: live status + links to every
// place that controls the system (app screens + external dashboards). Enter the
// STAFF_KEY once. Plain HTML, no build step.
export const loader = async () => {
  return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
};

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sofie — Mission Control</title>
<style>
  :root{--ink:#2a201d;--line:#e3ded9;--soft:#f6f3ef;--gold:#c9a96a;--ok:#1f7a4d;--err:#b23b3b}
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);margin:0;background:var(--soft)}
  .wrap{max-width:840px;margin:0 auto;padding:1.2rem}
  h1{font-size:1.35rem;margin:.2rem 0 .1rem}
  .sub{color:#8a807a;margin:0 0 1rem;font-size:.9rem}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem}
  label{display:block;font-size:.85rem;margin:.6rem 0 .25rem;color:#6b625c}
  input{width:100%;padding:.7rem .8rem;border:1px solid var(--line);border-radius:10px;font:inherit}
  button{border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:999px;padding:.6rem 1.1rem;font:inherit;cursor:pointer}
  .row{display:flex;gap:.5rem;align-items:end}.row input{flex:1}
  .hide{display:none}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:.8rem}
  @media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
  .stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:.9rem 1rem;text-align:center}
  .stat b{display:block;font-size:1.7rem;line-height:1.1}
  .stat small{color:#8a807a;font-size:.78rem}
  .mode{display:inline-block;border-radius:999px;padding:.2rem .7rem;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;border:1px solid var(--line)}
  .mode.auto{background:var(--ink);color:#fff}.mode.review{background:#fff}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem}
  @media(max-width:640px){.grid{grid-template-columns:1fr}}
  a.tile{display:flex;flex-direction:column;gap:.15rem;border:1px solid var(--line);border-radius:12px;padding:.85rem 1rem;text-decoration:none;color:var(--ink);background:#fff;transition:.15s}
  a.tile:hover{border-color:var(--ink);transform:translateY(-1px)}
  a.tile b{font-size:.98rem}
  a.tile span{color:#8a807a;font-size:.82rem}
  .h{font-size:.78rem;text-transform:uppercase;letter-spacing:.12em;color:#8a807a;margin:1.2rem 0 .5rem}
  .dot{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;margin-right:.4rem;vertical-align:middle}
  .dot.on{background:var(--ok)}.dot.off{background:var(--err)}
  .integ{display:flex;flex-wrap:wrap;gap:1rem;font-size:.9rem}
  .msg{margin-top:.6rem;font-size:.9rem;min-height:1em}.msg.err{color:var(--err)}
  .refresh{background:#fff;color:var(--ink);font-size:.82rem;padding:.4rem .9rem}
</style></head><body><div class="wrap">
<h1>Sofie — Mission Control</h1>
<p class="sub">Your single hub for the AI Sales Agent & loyalty system.</p>

<div class="card" id="loginCard">
  <label>Staff password</label>
  <div class="row"><input id="key" type="password" placeholder="Enter staff password"><button id="saveKey" style="flex:0 0 auto">Enter</button></div>
</div>

<div id="app" class="hide">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.7rem">
      <span>Sending mode: <span id="mode" class="mode review">—</span></span>
      <button class="refresh" id="refresh">↻ Refresh</button>
    </div>
    <div class="stats">
      <div class="stat"><b id="sentToday">–</b><small>Sent today</small></div>
      <div class="stat"><b id="queue">–</b><small>Awaiting review</small></div>
      <div class="stat"><b id="eventsToday">–</b><small>Events today</small></div>
      <div class="stat"><b id="customers">–</b><small>Customers</small></div>
    </div>
    <p class="msg" id="status"></p>
    <div class="integ" id="integ"></div>
  </div>

  <div class="card" id="bdayCard">
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem"><strong>🎂 Birthdays</strong></div>
    <div id="bdayToday"></div>
    <div id="bdayWeek"></div>
  </div>

  <div class="h">Your screens</div>
  <div class="grid">
    <a class="tile" href="/staff/agent"><b>🤖 AI Sales Agent</b><span>Test, review & approve messages</span></a>
    <a class="tile" href="/staff"><b>🛍️ In-store console</b><span>Look up, award & redeem points</span></a>
  </div>

  <div class="h">Control dashboards</div>
  <div class="grid">
    <a class="tile" href="https://railway.app" target="_blank" rel="noopener"><b>⚙️ Railway</b><span>Settings, on/off switches, logs</span></a>
    <a class="tile" href="https://app.brevo.com" target="_blank" rel="noopener"><b>📧 Brevo</b><span>Email sends, opens, senders</span></a>
    <a class="tile" href="https://supabase.com/dashboard" target="_blank" rel="noopener"><b>🗄️ Supabase</b><span>Customers, points, messages</span></a>
    <a class="tile" href="https://console.anthropic.com" target="_blank" rel="noopener"><b>🧠 Anthropic</b><span>Claude credits & usage</span></a>
    <a class="tile" href="https://console.cron-job.org" target="_blank" rel="noopener"><b>⏰ cron-job.org</b><span>The schedulers (3 jobs)</span></a>
    <a class="tile" href="https://admin.shopify.com" target="_blank" rel="noopener"><b>🏬 Shopify admin</b><span>Theme, pages, products, SEO</span></a>
  </div>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var key=sessionStorage.getItem("sofieStaffKey")||"";
  function show(id,on){$(id).classList[on?"remove":"add"]("hide")}
  function fmt(n){return Number(n||0).toLocaleString("en-EG")}
  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
  function ago(iso){if(!iso)return"never";var s=(Date.now()-new Date(iso).getTime())/1000;if(s<90)return"just now";if(s<5400)return Math.round(s/60)+" min ago";if(s<172800)return Math.round(s/3600)+" h ago";return Math.round(s/86400)+" d ago"}

  if(key){show("loginCard",false);show("app",true);load()}
  $("saveKey").onclick=function(){key=$("key").value.trim();if(!key)return;sessionStorage.setItem("sofieStaffKey",key);show("loginCard",false);show("app",true);load()};
  $("key").addEventListener("keydown",function(e){if(e.key==="Enter")$("saveKey").click()});
  $("refresh").onclick=load;

  function dot(on){return '<span class="dot '+(on?"on":"off")+'"></span>'}
  function load(){
    $("status").textContent="Loading…";$("status").className="msg";
    fetch("/staff/home-api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key})})
      .then(function(r){return r.json()}).then(function(j){
        if(j.error==="unauthorized"){sessionStorage.removeItem("sofieStaffKey");show("app",false);show("loginCard",true);return}
        if(!j.ok){$("status").textContent="Couldn't load status.";$("status").className="msg err";return}
        $("sentToday").textContent=fmt(j.sentToday);
        $("queue").textContent=fmt(j.queue);
        $("eventsToday").textContent=fmt(j.eventsToday);
        $("customers").textContent=fmt(j.totalCustomers);
        $("mode").textContent=j.mode==="auto"?"Auto-send":"Review";
        $("mode").className="mode "+(j.mode==="auto"?"auto":"review");
        $("status").textContent="Last message prepared: "+ago(j.lastMessageAt)+(j.mode==="review"?"  ·  Approve drafts in the AI Sales Agent screen.":"");
        $("status").className="msg";
        var today=j.birthdaysToday||[], week=j.birthdaysWeek||[];
        $("bdayToday").innerHTML = today.length
          ? '<p style="margin:.2rem 0;color:var(--ok)"><b>Today ('+today.length+'):</b> '+today.map(function(b){return esc(b.name)}).join(", ")+' — gift sent automatically 🎁</p>'
          : '<p style="margin:.2rem 0;color:#8a807a">No birthdays today.</p>';
        $("bdayWeek").innerHTML = week.length
          ? '<p style="margin:.2rem 0;color:#6b625c"><b>Next 7 days:</b> '+week.map(function(b){return esc(b.name)+" ("+esc(b.date)+")"}).join(", ")+'</p>'
          : '';
        var i=j.integrations||{};
        $("integ").innerHTML=
          dot(i.email&&i.email!=="none")+"Email ("+(i.email||"none")+")"+
          "&nbsp;&nbsp;"+dot(i.anthropic)+"Claude AI"+
          "&nbsp;&nbsp;"+dot(i.supabase)+"Database"+
          "&nbsp;&nbsp;"+dot(i.klaviyo)+"Klaviyo (optional)";
      }).catch(function(){$("status").textContent="Network error.";$("status").className="msg err"})
  }
})();
</script>
</div></body></html>`;
