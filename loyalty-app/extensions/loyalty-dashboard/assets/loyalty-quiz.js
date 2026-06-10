// Sofie's Beauty Profile quiz — posts answers to the App Proxy. The proxy
// authenticates the logged-in customer by signed HMAC; no IDs from the browser.
(function () {
  var root = document.getElementById("sofie-quiz");
  if (!root) return;
  var base = root.getAttribute("data-proxy") || "/apps/loyalty";
  var form = root.querySelector("[data-quiz-form]");
  var msg = root.querySelector("[data-quiz-msg]");

  function setMsg(text, kind) {
    msg.textContent = text || "";
    msg.className = "sofie-quiz__msg" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var answers = {
      skin_type: fd.get("skin_type") || null,
      undertone: fd.get("undertone") || null,
      lip_finish_pref: fd.get("lip_finish_pref") || null,
      foundation_shade: (fd.get("foundation_shade") || "").trim() || null,
      skin_concerns: fd.getAll("skin_concerns"),
    };
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    setMsg("Saving your profile…");

    fetch(base + "/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.ok) {
          setMsg(res.j.error === "not_logged_in" ? "Please sign in first." : "Could not save right now. Please try again.", "error");
          return;
        }
        var earned = res.j.awarded ? ("You earned " + res.j.awarded + " points! ") : "Profile updated. ";
        setMsg(earned + "Your personalized tips are ready below.", "success");
        // Refresh the dashboard block if it's on the same page.
        if (window.SofieLoyaltyReload) window.SofieLoyaltyReload();
      })
      .catch(function () { setMsg("Network error. Please try again.", "error"); })
      .finally(function () { btn.disabled = false; });
  });
})();
