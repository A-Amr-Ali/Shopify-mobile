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
    renderGifts(data.gifts || [], data.balance);
    renderProfile(data.profile);
    renderTips(data.tips || [], data.completion_pct || 0);
  }

  function renderGifts(gifts, balance) {
    var wrap = root.querySelector("[data-gifts]");
    var list = root.querySelector("[data-gift-list]");
    if (!wrap || !list) return;
    list.innerHTML = "";
    if (!gifts.length) { wrap.hidden = true; return; }
    gifts.forEach(function (g) {
      var afford = balance >= g.pointsCost;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sofie-loyalty__reward sofie-loyalty__gift" + (afford ? "" : " is-locked");
      btn.disabled = !afford;
      btn.innerHTML =
        '<span class="sofie-loyalty__reward-egp">🎁 ' + escapeHtml(g.title) + "</span>" +
        '<span class="sofie-loyalty__reward-cost">' + fmt(g.pointsCost) + " pts</span>";
      btn.addEventListener("click", function () {
        redeem({ giftId: g.id }, btn, function (j) {
          return "Gift unlocked! Use code " + j.code + " at checkout — your " + (j.gift || "gift") +
            " is free. New balance: " + fmt(j.balance) + " pts.";
        });
      });
      list.appendChild(btn);
    });
    wrap.hidden = false;
  }

  function renderProfile(profile) {
    var card = root.querySelector("[data-profile-card]");
    var grid = root.querySelector("[data-profile-grid]");
    if (!card || !grid) return;
    if (!profile) { card.hidden = true; return; }

    var rows = [];
    function add(label, val) {
      if (val == null || val === "") return;
      if (Array.isArray(val)) { if (!val.length) return; val = val.join(", "); }
      rows.push([label, String(val)]);
    }
    var cap = function (s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
    add("Skin type", cap(profile.skin_type));
    add("Undertone", cap(profile.undertone));
    add("Foundation shade", profile.foundation_shade);
    add("Foundation brand", profile.foundation_brand);
    add("Lip finish", cap(profile.lip_finish_pref));
    add("Skin concerns", profile.skin_concerns);
    var prods = (profile.current_products || []).map(function (p) {
      return p.brand + " " + p.product + (p.shade ? " (" + p.shade + ")" : "");
    });
    add("Products you use", prods);

    grid.innerHTML = rows.map(function (r) {
      return "<div class='sofie-loyalty__pf-row'><dt>" + escapeHtml(r[0]) +
        "</dt><dd>" + escapeHtml(r[1]) + "</dd></div>";
    }).join("");
    card.hidden = rows.length === 0;
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
      btn.addEventListener("click", function () {
        redeem({ pointsCost: r.pointsCost }, btn, function (j) {
          return "Done! Use code " + j.code + " at checkout for " + fmt(j.egp_value) + " " +
            currency + " off. New balance: " + fmt(j.balance) + " pts.";
        });
      });
      list.appendChild(btn);
    });
    wrap.hidden = false;
  }

  // payload = { pointsCost } or { giftId }; successMsg(j) returns the message.
  function redeem(payload, btn, successMsg) {
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.classList.add("is-busy");
    setMsg("Working on it…");
    fetch(base + "/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
        setMsg(successMsg(res.j), "success");
        load();
      })
      .catch(function () { setMsg("Network error. Please try again.", "error"); })
      .finally(function () { delete btn.dataset.busy; btn.classList.remove("is-busy"); });
  }

  // ── Product recommendations (from the quiz/profile) ──
  function loadReco() {
    fetch(base + "/recommendations", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) { renderReco((data && data.products) || []); })
      .catch(function () { /* recommendations are best-effort */ });
  }

  function productCard(p) {
    var url = "/products/" + p.handle;
    var card = document.createElement("div");
    card.className = "sofie-reco";
    card.innerHTML =
      '<a class="sofie-reco__media" href="' + url + '">' +
      (p.image ? '<img src="' + p.image + '" alt="' + escapeHtml(p.title) + '" loading="lazy">' : "") + "</a>" +
      '<div class="sofie-reco__body">' +
      '<a class="sofie-reco__title" href="' + url + '">' + escapeHtml(p.title) + "</a>" +
      '<span class="sofie-reco__price">' + fmt(Math.round(Number(p.price))) + " " + currency + "</span>" +
      '<button type="button" class="sofie-reco__btn" data-variant="' + p.variantId + '">Add to bag</button>' +
      "</div>";
    card.querySelector("[data-variant]").addEventListener("click", function () { addToCart(p.variantId, this); });
    return card;
  }

  function renderReco(products) {
    var wrap = root.querySelector("[data-reco]");
    var list = root.querySelector("[data-reco-list]");
    if (!wrap || !list || !products.length) return;
    list.innerHTML = "";
    products.forEach(function (p) { list.appendChild(productCard(p)); });
    wrap.hidden = false;
  }

  // ── Interactive beauty advisor ──
  function initAdvisor() {
    var send = root.querySelector("[data-ask-send]");
    var input = root.querySelector("[data-ask-input]");
    if (!send || !input) return;
    root.querySelectorAll("[data-ask]").forEach(function (chip) {
      chip.addEventListener("click", function () { ask(chip.getAttribute("data-ask")); });
    });
    send.addEventListener("click", function () { ask(input.value.trim()); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") ask(input.value.trim()); });
  }

  function ask(question) {
    if (!question) return;
    var ans = root.querySelector("[data-ask-answer]");
    var prod = root.querySelector("[data-ask-products]");
    ans.hidden = false; ans.textContent = "Thinking…"; ans.className = "sofie-advisor__answer";
    prod.innerHTML = "";
    fetch(base + "/ask", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question }),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) {
          ans.textContent = res.j.error === "advisor_unavailable"
            ? "The advisor isn't switched on yet — please check back soon."
            : "Sorry, I couldn't answer that just now. Please try again.";
          return;
        }
        ans.textContent = res.j.answer;
        (res.j.products || []).forEach(function (p) { prod.appendChild(productCard(p)); });
      })
      .catch(function () { ans.textContent = "Network error. Please try again."; });
  }

  function addToCart(variantId, btn) {
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    var orig = btn.textContent;
    btn.textContent = "Adding…";
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
    })
      .then(function (r) { if (!r.ok) throw new Error("add failed"); return r.json(); })
      .then(function () {
        btn.textContent = "Added ✓";
        document.dispatchEvent(new CustomEvent("sofie:cart-updated"));
        setTimeout(function () { btn.textContent = orig; delete btn.dataset.busy; }, 1600);
      })
      .catch(function () { btn.textContent = "Try again"; delete btn.dataset.busy; });
  }

  function load() {
    fetch(base + "/me", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.error) { grid.setAttribute("data-state", "error"); return; }
        render(data);
      })
      .catch(function () { grid.setAttribute("data-state", "error"); });
    loadReco();
  }

  // Let the quiz block trigger a refresh after a successful submit.
  window.SofieLoyaltyReload = load;

  initAdvisor();
  load();
})();
