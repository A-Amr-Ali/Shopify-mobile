// GET /staff/agent — AI Sales Agent review & test console. Enter the STAFF_KEY,
// generate a live test message for any customer email (nothing is sent), and
// review/approve/skip the drafts the cron has queued. Plain HTML, no build step.
export const loader = async () => {
  return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
};

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sofie — AI Sales Agent</title>
<style>
  :root{--ink:#2a201d;--line:#e3ded9;--soft:#f6f3ef;--gold:#c9a96a}
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);margin:0;background:var(--soft)}
  .wrap{max-width:760px;margin:0 auto;padding:1.2rem}
  h1{font-size:1.3rem;margin:.2rem 0 .2rem}
  .sub{color:#8a807a;margin:0 0 1rem;font-size:.9rem}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem}
  label{display:block;font-size:.85rem;margin:.6rem 0 .25rem;color:#6b625c}
  input,select,textarea{width:100%;padding:.65rem .8rem;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff}
  textarea{min-height:80px;resize:vertical}
  button{border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:999px;padding:.6rem 1.1rem;font:inherit;cursor:pointer}
  button.ghost{background:#fff;color:var(--ink)}
  button:disabled{opacity:.5;cursor:progress}
  .row{display:flex;gap:.5rem;align-items:end}.row>*{flex:1}
  .msg{margin-top:.6rem;font-size:.92rem;min-height:1.1em}.msg.ok{color:#1f7a4d}.msg.err{color:#b23b3b}
  .hide{display:none}
  .tag{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:.1rem .6rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#6b625c}
  .draft{border:1px solid var(--line);border-radius:12px;padding:.9rem 1rem;margin:.7rem 0;background:#fff}
  .draft h3{margin:.2rem 0;font-size:1rem}
  .ar{direction:rtl;text-align:right}
  .body{white-space:pre-wrap;background:var(--soft);border-radius:8px;padding:.6rem .8rem;margin:.4rem 0;font-size:.92rem;line-height:1.5}
  .prods{display:flex;gap:.5rem;flex-wrap:wrap;margin:.4rem 0}
  .prod{border:1px solid var(--line);border-radius:8px;padding:.3rem .5rem;font-size:.8rem}
  .warn{color:#b23b3b;font-size:.82rem}
  .acts{display:flex;gap:.5rem;margin-top:.6rem}
  small{color:#8a807a}
</style></head><body><div class="wrap">
<h1>Sofie — AI Sales Agent</h1>
<p class="sub">Test the voice on a real customer, then review &amp; approve the queue. Nothing sends until you press <b>Approve &amp; send</b>.</p>

<div class="card" id="loginCard">
  <label>Staff password</label>
  <div class="row"><input id="key" type="password" placeholder="Enter staff password"><button id="saveKey" style="flex:0 0 auto">Enter</button></div>
  <small>Same password as the rewards staff console.</small>
</div>

<div id="app" class="hide">
  <div class="card">
    <strong>① Test a message</strong>
    <label>Customer email</label>
    <input id="tEmail" type="email" placeholder="customer@email.com">
    <label>Scenario</label>
    <select id="tTrigger">
      <option value="">Auto (their real behaviour)</option>
      <option value="abandoned_cart">Abandoned cart</option>
      <option value="browse_no_buy">Browsed, didn't buy</option>
      <option value="post_purchase">Post-purchase pairing</option>
      <option value="win_back">Win back</option>
    </select>
    <div style="margin-top:.7rem"><button id="tGen">Generate preview</button></div>
    <p class="msg" id="tMsg"></p>
    <div id="tOut"></div>
  </div>

  <div class="card">
    <div class="row" style="align-items:center"><strong style="flex:1">② Review queue</strong><button class="ghost" id="reload" style="flex:0 0 auto">Refresh</button></div>
    <p class="msg" id="qMsg"></p>
    <div id="queue"></div>
  </div>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var key=sessionStorage.getItem("sofieStaffKey")||"";
  function show(id,on){$(id).classList[on?"remove":"add"]("hide")}
  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
  function post(data){data.key=key;return fetch("/staff/agent-api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})}

  if(key){show("loginCard",false);show("app",true);loadQueue()}
  $("saveKey").onclick=function(){key=$("key").value.trim();if(!key)return;sessionStorage.setItem("sofieStaffKey",key);show("loginCard",false);show("app",true);loadQueue()};
  $("key").addEventListener("keydown",function(e){if(e.key==="Enter")$("saveKey").click()});

  function guardHtml(g){if(!g||g.ok)return '<small style="color:#1f7a4d">✓ passes brand guardrails</small>';return '<div class="warn">⚠ '+esc((g.violations||[]).join("; "))+'</div>'}
  function prodHtml(ps){if(!ps||!ps.length)return '';return '<div class="prods">'+ps.map(function(p){return '<span class="prod">'+esc(p.title)+' · '+esc(p.price)+' EGP</span>'}).join("")+'</div>'}

  function msgCard(m,opts){
    opts=opts||{};
    return '<div class="draft">'+
      '<span class="tag">'+esc(m.trigger)+'</span> <span class="tag">'+esc(m.source||"")+'</span>'+
      (opts.email?' <small>'+esc(opts.email)+'</small>':'')+
      '<h3>'+esc(m.subject||m.subject)+'</h3>'+
      '<div class="body">'+esc(m.body_en)+'</div>'+
      '<div class="body ar">'+esc(m.body_ar)+'</div>'+
      prodHtml(m.products)+guardHtml(m.guardrail)+
      (opts.acts||'')+'</div>'
  }

  $("tGen").onclick=function(){
    var email=$("tEmail").value.trim();if(!email){$("tMsg").textContent="Enter an email.";$("tMsg").className="msg err";return}
    $("tGen").disabled=true;$("tMsg").textContent="Generating…";$("tMsg").className="msg";$("tOut").innerHTML="";
    post({action:"test",email:email,trigger:$("tTrigger").value}).then(function(r){
      $("tGen").disabled=false;
      if(r.j.error==="unauthorized"){logout();return}
      if(!r.j.ok){$("tMsg").textContent="Couldn't generate ("+(r.j.error||"error")+").";$("tMsg").className="msg err";return}
      $("tMsg").textContent="";
      var acts='<div class="acts"><button data-testsend="1">Send this test to '+esc(email)+'</button></div>'+
        '<p class="msg" id="tsMsg"></p>';
      $("tOut").innerHTML=msgCard(r.j.preview,{acts:acts});
      var sb=document.querySelector("[data-testsend]");
      if(sb)sb.onclick=function(){
        sb.disabled=true;$("tsMsg").textContent="Sending…";$("tsMsg").className="msg";
        post({action:"test_send",email:email,trigger:$("tTrigger").value}).then(function(rr){
          sb.disabled=false;
          if(rr.j.ok){$("tsMsg").textContent="✅ Sent to "+esc(email)+" via "+(rr.j.via||"email")+". Check your inbox.";$("tsMsg").className="msg ok"}
          else{$("tsMsg").textContent="Couldn't send ("+(rr.j.error||"error")+(rr.j.detail?": "+rr.j.detail:"")+").";$("tsMsg").className="msg err"}
        }).catch(function(){sb.disabled=false;$("tsMsg").textContent="Network error.";$("tsMsg").className="msg err"})
      };
    }).catch(function(){$("tGen").disabled=false;$("tMsg").textContent="Network error.";$("tMsg").className="msg err"})
  };

  function loadQueue(){
    $("qMsg").textContent="Loading…";$("qMsg").className="msg";
    post({action:"list"}).then(function(r){
      if(r.j.error==="unauthorized"){logout();return}
      if(!r.j.ok){$("qMsg").textContent="Couldn't load queue.";$("qMsg").className="msg err";return}
      var d=r.j.drafts||[];$("qMsg").textContent=d.length?d.length+" awaiting review":"Queue is empty — the cron will fill it as customers act.";$("qMsg").className="msg";
      $("queue").innerHTML=d.map(function(m){
        var acts='<div class="acts">'+
          '<button data-send="'+m.id+'">Approve &amp; send</button>'+
          '<button class="ghost" data-skip="'+m.id+'">Skip</button></div>';
        return msgCard(m,{email:m.email,acts:acts});
      }).join("")||"";
      bind();
    }).catch(function(){$("qMsg").textContent="Network error.";$("qMsg").className="msg err"})
  }
  $("reload").onclick=loadQueue;

  function bind(){
    Array.prototype.forEach.call(document.querySelectorAll("[data-send]"),function(b){b.onclick=function(){
      b.disabled=true;post({action:"send",id:Number(b.getAttribute("data-send"))}).then(function(r){
        if(r.j.error==="guardrail"){if(confirm("This message trips a guardrail: "+(r.j.violations||[]).join("; ")+"\\nSend anyway?")){post({action:"send",id:Number(b.getAttribute("data-send")),override:true}).then(loadQueue)}else{b.disabled=false}return}
        loadQueue();
      }).catch(function(){b.disabled=false})
    }});
    Array.prototype.forEach.call(document.querySelectorAll("[data-skip]"),function(b){b.onclick=function(){
      b.disabled=true;post({action:"skip",id:Number(b.getAttribute("data-skip"))}).then(loadQueue).catch(function(){b.disabled=false})
    }});
  }

  function logout(){sessionStorage.removeItem("sofieStaffKey");show("app",false);show("loginCard",true)}
})();
</script>
</div></body></html>`;
