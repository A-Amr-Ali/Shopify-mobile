// GET /staff/customers — customer directory. Search, sort, and page through
// every customer: email, orders, loyalty points, tier, lifetime spend, birthday.
// Enter the STAFF_KEY once. Plain HTML, no build step.
export const loader = async () => {
  return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
};

const PAGE = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sofie — Customers</title>
<style>
  :root{--ink:#2a201d;--line:#e3ded9;--soft:#f6f3ef;--gold:#c9a96a}
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);margin:0;background:var(--soft)}
  .wrap{max-width:1000px;margin:0 auto;padding:1.2rem}
  h1{font-size:1.3rem;margin:.2rem 0}
  .sub{color:#8a807a;margin:0 0 1rem;font-size:.9rem}
  a.back{color:#8a807a;text-decoration:none;font-size:.85rem}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1rem 1.1rem;margin-bottom:1rem}
  input,select{padding:.6rem .7rem;border:1px solid var(--line);border-radius:10px;font:inherit;background:#fff}
  button{border:1px solid var(--ink);background:var(--ink);color:#fff;border-radius:999px;padding:.55rem 1rem;font:inherit;cursor:pointer}
  button.ghost{background:#fff;color:var(--ink)}
  button:disabled{opacity:.4;cursor:not-allowed}
  .row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
  .row input{flex:1;min-width:180px}
  .hide{display:none}
  table{width:100%;border-collapse:collapse;font-size:.9rem}
  th,td{text-align:left;padding:.65rem .6rem;border-bottom:1px solid var(--line);white-space:nowrap}
  th{color:#8a807a;font-weight:500;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}
  td.name b{display:block}td.name small{color:#8a807a}
  .tier{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:.1rem .55rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}
  .tier.vip{background:#f3ece0}.tier.icon{background:var(--ink);color:#fff}
  .tbl-wrap{overflow-x:auto}
  .pager{display:flex;justify-content:space-between;align-items:center;margin-top:.9rem;font-size:.9rem;color:#6b625c}
  .msg{margin-top:.6rem;font-size:.9rem;min-height:1em}.msg.err{color:#b23b3b}
  .num{text-align:right;font-variant-numeric:tabular-nums}
</style></head><body><div class="wrap">
<a class="back" href="/staff/home">← Mission Control</a>
<h1>Customers</h1>
<p class="sub">Everyone in Sofie Rewards — orders, points, tier & birthday.</p>

<div class="card" id="loginCard">
  <label style="display:block;font-size:.85rem;margin-bottom:.25rem;color:#6b625c">Staff password</label>
  <div class="row"><input id="key" type="password" placeholder="Enter staff password"><button id="saveKey">Enter</button></div>
</div>

<div id="app" class="hide">
  <div class="card">
    <div class="row">
      <input id="q" type="search" placeholder="Search by name or email…">
      <select id="sort">
        <option value="points">Most points</option>
        <option value="spend">Most spend</option>
        <option value="recent">Newest</option>
      </select>
      <button id="search">Search</button>
    </div>
    <p class="msg" id="msg"></p>
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>Customer</th><th class="num">Orders</th><th class="num">Points</th>
          <th>Tier</th><th class="num">Spend (EGP)</th><th>Birthday</th><th>Joined</th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <div class="pager">
      <span id="count"></span>
      <span><button class="ghost" id="prev">‹ Prev</button> <button class="ghost" id="next">Next ›</button></span>
    </div>
  </div>
</div>

<script>
(function(){
  var $=function(id){return document.getElementById(id)};
  var key=sessionStorage.getItem("sofieStaffKey")||"";
  var page=0, pages=1;
  function show(id,on){$(id).classList[on?"remove":"add"]("hide")}
  function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
  function fmt(n){return Number(n||0).toLocaleString("en-EG")}
  function bday(s){if(!s)return"—";var p=String(s).slice(0,10).split("-");return p.length===3?p[2]+"/"+p[1]:s}
  function joined(s){if(!s)return"—";return String(s).slice(0,10)}

  if(key){show("loginCard",false);show("app",true);load()}
  $("saveKey").onclick=function(){key=$("key").value.trim();if(!key)return;sessionStorage.setItem("sofieStaffKey",key);show("loginCard",false);show("app",true);load()};
  $("key").addEventListener("keydown",function(e){if(e.key==="Enter")$("saveKey").click()});
  $("search").onclick=function(){page=0;load()};
  $("q").addEventListener("keydown",function(e){if(e.key==="Enter"){page=0;load()}});
  $("sort").onchange=function(){page=0;load()};
  $("prev").onclick=function(){if(page>0){page--;load()}};
  $("next").onclick=function(){if(page<pages-1){page++;load()}};

  function load(){
    $("msg").textContent="Loading…";$("msg").className="msg";
    fetch("/staff/customers-api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key,q:$("q").value,sort:$("sort").value,page:page})})
      .then(function(r){return r.json()}).then(function(j){
        if(j.error==="unauthorized"){sessionStorage.removeItem("sofieStaffKey");show("app",false);show("loginCard",true);return}
        if(!j.ok){$("msg").textContent="Couldn't load ("+(j.error||"error")+").";$("msg").className="msg err";return}
        pages=j.pages||1;
        $("msg").textContent="";
        $("rows").innerHTML=(j.customers||[]).map(function(c){
          return "<tr>"+
            '<td class="name"><b>'+(esc(c.name)||"—")+'</b><small>'+esc(c.email)+'</small></td>'+
            '<td class="num">'+fmt(c.orders)+'</td>'+
            '<td class="num">'+fmt(c.points)+'</td>'+
            '<td><span class="tier '+esc(c.tier)+'">'+esc(c.tier)+'</span></td>'+
            '<td class="num">'+fmt(c.spend)+'</td>'+
            '<td>'+bday(c.birthday)+'</td>'+
            '<td>'+joined(c.joined)+'</td>'+
          "</tr>";
        }).join("")||'<tr><td colspan="7" style="color:#8a807a;text-align:center;padding:1.5rem">No customers found.</td></tr>';
        $("count").textContent=fmt(j.total)+" customers · page "+(page+1)+" of "+pages;
        $("prev").disabled=page<=0;$("next").disabled=page>=pages-1;
      }).catch(function(){$("msg").textContent="Network error.";$("msg").className="msg err"})
  }
})();
</script>
</div></body></html>`;
