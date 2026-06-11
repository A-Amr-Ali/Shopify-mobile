// GET /staff — self-contained in-store staff console (no Shopify embed needed).
// Staff enter the STAFF_KEY password once, look a customer up by email, then
// award points for an in-store purchase or redeem points. Served as plain HTML.
export const loader = async () => {
  return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
};

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sofie Rewards — Staff</title>
<style>
  :root{--ink:#2a201d;--line:#e3ded9;--soft:#f6f3ef}
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);margin:0;background:var(--soft)}
  .wrap{max-width:520px;margin:0 auto;padding:1.2rem}
  h1{font-size:1.3rem;margin:.2rem 0 1rem}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem}
  label{display:block;font-size:.85rem;margin:.6rem 0 .25rem;color:#6b625c}
  input{width:100%;padding:.7rem .8rem;border:1px solid var(--line);border-radius:10px;font:inherit}
  button{border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:999px;padding:.65rem 1.1rem;font:inherit;cursor:pointer}
  button.ghost{background:#fff;color:var(--ink)}
  button:disabled{opacity:.5;cursor:progress}
  .row{display:flex;gap:.5rem;align-items:end}
  .row input{flex:1}
  .pts{font-size:2.4rem;font-weight:700;line-height:1}
  .tier{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:.15rem .7rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em}
  .rewards{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}
  .rewards button{flex-direction:column}
  .msg{margin-top:.8rem;font-size:.95rem;min-height:1.2em}
  .msg.ok{color:#1f7a4d}.msg.err{color:#b23b3b}
  .hide{display:none}
  small{color:#8a807a}
</style></head><body><div class="wrap">
<h1>Sofie Rewards — Staff console</h1>

<div class="card" id="loginCard">
  <label>Staff password</label>
  <div class="row"><input id="key" type="password" placeholder="Enter staff password"><button id="saveKey">Enter</button></div>
  <small>Ask the manager for the password. It's saved on this device only.</small>
</div>

<div class="card hide" id="findCard">
  <label>Customer email</label>
  <div class="row"><input id="email" type="email" placeholder="customer@email.com" autocomplete="off"><button id="find">Find</button></div>
  <p class="msg" id="findMsg"></p>
</div>

<div class="card hide" id="custCard">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><strong id="cName"></strong><br><small id="cEmail"></small></div>
    <span class="tier" id="cTier"></span>
  </div>
  <p style="margin:.8rem 0 .2rem"><span class="pts" id="cPts">0</span> <small>points</small></p>
  <small id="cLife"></small>

  <hr style="border:none;border-top:1px solid var(--line);margin:1rem 0">
  <label>Award points for an in-store purchase (EGP spent)</label>
  <div class="row"><input id="amt" type="number" min="1" placeholder="e.g. 7500"><button id="award" class="ghost">Award</button></div>

  <hr style="border:none;border-top:1px solid var(--line);margin:1rem 0">
  <label>Redeem points</label>
  <div class="rewards" id="rewards"></div>

  <p class="msg" id="actMsg"></p>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var key=sessionStorage.getItem("sofieStaffKey")||"";
  var cust=null;
  function show(id,on){$(id).classList[on?"remove":"add"]("hide")}
  function fmt(n){return Number(n||0).toLocaleString("en-EG")}
  function post(url,data){data.key=key;return fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j}})})}

  if(key){show("loginCard",false);show("findCard",true)}
  $("saveKey").onclick=function(){key=$("key").value.trim();if(!key)return;sessionStorage.setItem("sofieStaffKey",key);show("loginCard",false);show("findCard",true)};
  $("key").addEventListener("keydown",function(e){if(e.key==="Enter")$("saveKey").click()});

  function findCustomer(){
    var email=$("email").value.trim();if(!email)return;
    $("find").disabled=true;$("findMsg").textContent="Searching…";$("findMsg").className="msg";
    post("/staff/lookup",{email:email}).then(function(res){
      $("find").disabled=false;
      if(res.j.error==="unauthorized"){$("findMsg").textContent="Wrong password.";$("findMsg").className="msg err";sessionStorage.removeItem("sofieStaffKey");show("loginCard",true);show("findCard",false);return}
      if(!res.j.found){$("findMsg").textContent="No customer with that email.";$("findMsg").className="msg err";show("custCard",false);return}
      cust=res.j;$("findMsg").textContent="";renderCust()
    }).catch(function(){$("find").disabled=false;$("findMsg").textContent="Network error.";$("findMsg").className="msg err"})
  }
  $("find").onclick=findCustomer;
  $("email").addEventListener("keydown",function(e){if(e.key==="Enter")findCustomer()});

  function renderCust(){
    show("custCard",true);
    $("cName").textContent=cust.name;$("cEmail").textContent=cust.email;
    $("cTier").textContent=cust.tier;$("cPts").textContent=fmt(cust.points);
    $("cLife").textContent="Lifetime spend: "+fmt(cust.lifetime)+" EGP";
    var box=$("rewards");box.innerHTML="";
    (cust.rewards||[]).forEach(function(r){
      var b=document.createElement("button");b.className="ghost";b.disabled=cust.points<r.pointsCost;
      b.innerHTML="<span>"+fmt(r.egpValue)+" EGP off</span><small>"+fmt(r.pointsCost)+" pts</small>";
      b.onclick=function(){redeem({pointsCost:r.pointsCost},b)};box.appendChild(b)
    });
    (cust.gifts||[]).forEach(function(g){
      var b=document.createElement("button");b.className="ghost";b.disabled=cust.points<g.pointsCost;
      b.innerHTML="<span>🎁 "+g.title+"</span><small>"+fmt(g.pointsCost)+" pts</small>";
      b.onclick=function(){redeem({giftId:g.id},b)};box.appendChild(b)
    });
    $("actMsg").textContent="";$("actMsg").className="msg"
  }

  $("award").onclick=function(){
    var amt=Number($("amt").value);if(!(amt>0)){$("actMsg").textContent="Enter the amount spent.";$("actMsg").className="msg err";return}
    $("award").disabled=true;$("actMsg").textContent="Awarding…";$("actMsg").className="msg";
    post("/staff/award",{customerId:cust.customerId,amountEgp:amt}).then(function(res){
      $("award").disabled=false;
      if(!res.ok||!res.j.ok){$("actMsg").textContent="Couldn't award points.";$("actMsg").className="msg err";return}
      cust.points=res.j.balance;cust.tier=res.j.tier;$("amt").value="";renderCust();
      $("actMsg").textContent="+"+fmt(res.j.awarded)+" points awarded. New balance: "+fmt(res.j.balance)+".";$("actMsg").className="msg ok"
    }).catch(function(){$("award").disabled=false;$("actMsg").textContent="Network error.";$("actMsg").className="msg err"})
  };

  function redeem(payload,btn){
    btn.disabled=true;$("actMsg").textContent="Redeeming…";$("actMsg").className="msg";
    payload.customerId=cust.customerId;
    post("/staff/redeem",payload).then(function(res){
      if(!res.ok||!res.j.ok){
        var m={insufficient_points:"Not enough points.",invalid_reward:"Reward unavailable."};
        $("actMsg").textContent=m[res.j.error]||"Couldn't redeem.";$("actMsg").className="msg err";btn.disabled=false;return
      }
      cust.points=res.j.balance;renderCust();
      $("actMsg").textContent="✅ Give the customer: "+res.j.apply+"  ·  Ref "+res.j.reference+"  ·  New balance "+fmt(res.j.balance)+" pts.";$("actMsg").className="msg ok"
    }).catch(function(){btn.disabled=false;$("actMsg").textContent="Network error.";$("actMsg").className="msg err"})
  }
})();
</script>
</div></body></html>`;
