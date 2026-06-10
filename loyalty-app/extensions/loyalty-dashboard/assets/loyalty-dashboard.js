// Sofie's Loyalty dashboard — talks to the App Proxy. The proxy authenticates
// the customer by signed HMAC; the browser never sends a customer id.
(function () {
  var root = document.getElementById("sofie-loyalty");
  if (!root) return;

  var base = root.getAttribute("data-proxy") || "/apps/loyalty";
  var currency = root.getAttribute("data-currency") || "EGP";
  var grid = root.querySelector(".sofie-loyalty__grid");

  var TIER_LABELS = { insider: "Insider", vip: "VIP", icon: "Icon" };
  var fmt = function (n) { return Number(n || 0).toLocaleString("en-EG"); };

  function setMsg(text, kind) {
    var el = root.querySelector("[data-msg]");
    if (!el) return;
    el.textContent = text || "";
    el.className = "sofie-loyalty__msg" + (kind ? " is-" + kind : "");
  }

  function render(data) {
    grid.setAttribute("data-state", "ready");
    root.querySelector("[data-points]").textContent = fmt(data.balance);
    var tierEl = root.querySelector("[data-tier]");
    tierEl.textContent = TIER_LABELS[data.tier] || data.tier || "Insider";
    tierEl.setAttribute("data-tier-key", data.tier || "insider");

    var p = data.progress || {};
    root.querySelector("[data-progress-fill]").style.width = (p.pct || 0) + "%";
    var note = root.querySelector("[data-progress-note]");
    if (p.next) {
      note.textContent = "Spend " + fmt(p.to_next_egp) + " " + currency + " more to reach " +
        (TIER_LABELS[p.next] || p.next) + ".";
    } else {
      note.textContent = "You're at our top tier. Thank you!";
    }

    renderRewards(data.rewards || [], data.balance);
    renderTips(data.tips || [], data.completion_pct || 0);
  }

  function renderTips(tips, completion) {
    var wrap = root.querySelector("[data-tips]");
    if (!wrap) return;
    var list = root.querySelector("[data-tips-list]");
    var nudge = root.querySelector("[data-tips-nudge]");
    list.innerHTML = "";
    if (!tips.length) {
      // No profile yet — invite them to take the quiz.
      if (nudge) {
        nudge.hidden = false;
        nudge.textContent = "Take the Beauty Profile quiz to unlock personalized tips and earn 250 points.";
      }
      wrap.hidden = false;
      return;
    }
    if (nudge) nudge.hidden = completion >= 100;
    if (nudge && completion < 100) nudge.textContent = "Your profile is " + completion + "% complete — finish it for sharper recommendations.";
    tips.forEach(function (t) {
      var el = document.createElement("div");
      el.className = "sofie-loyalty__tip";
      el.innerHTML = "<strong>" + escapeHtml(t.title) + "</strong><p>" + escapeHtml(t.body) + "</p>";
      list.appendChild(el);
    });
    wrap.hidden = false;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function renderRewards(rewards, balance) {
    var wrap = root.querySelector("[data-rewards]");
    var list = root.querySelector("[data-reward-list]");
    list.innerHTML = "";
    rewards.forEach(function (r) {
      var afford = balance >= r.pointsCost;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sofie-loyalty__reward" + (afford ? "" : " is-locked");
      btn.disabled = !afford;
      btn.setAttribute("data-cost", r.pointsCost);
      btn.innerHTML =
        '<span class="sofie-loyalty__reward-egp">' + fmt(r.egpValue) + " " + currency + " off</span>" +
        '<span class="sofie-loyalty__reward-cost">' + fmt(r.pointsCost) + " pts</span>";
      btn.addEventListener("click", function () { redeem(r.pointsCost, btn); });
      list.appendChild(btn);
    });
    wrap.hidden = false;
  }

  function redeem(pointsCost, btn) {
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.classList.add("is-busy");
    setMsg("Creating your discount code…");
    fetch(base + "/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointsCost: pointsCost }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) {
          var map = {
            insufficient_points: "You don't have enough points yet.",
            invalid_reward: "That reward isn't available.",
            not_logged_in: "Please sign in to redeem.",
          };
          setMsg(map[res.j.error] || "Could not redeem right now. Please try again.", "error");
          return;
        }
        setMsg("Done! Use code " + res.j.code + " at checkout for " +
          fmt(res.j.egp_value) + " " + currency + " off. New balance: " + fmt(res.j.balance) + " pts.", "success");
        load(); // refresh balance + reward availability
      })
      .catch(function () { setMsg("Network error. Please try again.", "error"); })
      .finally(function () { delete btn.dataset.busy; btn.classList.remove("is-busy"); });
  }

  function load() {
    fetch(base + "/me", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.error) { grid.setAttribute("data-state", "error"); return; }
        render(data);
      })
      .catch(function () { grid.setAttribute("data-state", "error"); });
  }

  // Let the quiz block trigger a refresh after a successful submit.
  window.SofieLoyaltyReload = load;

  load();
})();
