// Sofie Shade Studio — 2D try-on. Parses "Label | #hex | area | url" lines,
// renders swatches, and tints the lip/cheek zones on the model photo.
(function () {
  var root = document.querySelector("[data-shade]");
  if (!root) return;

  var raw = "";
  var holder = root.querySelector("[data-shades]");
  try { raw = JSON.parse(holder.textContent); } catch (e) { raw = holder.textContent || ""; }

  var shades = String(raw).split("\n").map(function (line) {
    var p = line.split("|").map(function (s) { return s.trim(); });
    if (!p[0] || !p[1]) return null;
    return { label: p[0], color: p[1], area: (p[2] || "lip").toLowerCase(), url: p[3] || "" };
  }).filter(Boolean);

  var lips = root.querySelector("[data-lips]");
  var cheeks = root.querySelectorAll("[data-cheek]");
  var palette = root.querySelector("[data-palette]");
  var shop = root.querySelector("[data-shop]");
  var area = "lip";

  function applyShade(s) {
    if (s.area === "cheek") {
      cheeks.forEach(function (c) { c.style.background = s.color; c.style.opacity = ""; });
    } else {
      lips.style.background = s.color;
    }
    if (s.url) { shop.href = s.url; shop.hidden = false; shop.textContent = "Shop " + s.label; }
    else { shop.hidden = true; }
  }

  function renderPalette() {
    palette.innerHTML = "";
    shades.filter(function (s) { return s.area === area; }).forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sofie-shade__swatch";
      b.style.background = s.color;
      b.title = s.label;
      b.setAttribute("aria-label", s.label);
      b.addEventListener("click", function () {
        palette.querySelectorAll(".sofie-shade__swatch").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        applyShade(s);
      });
      palette.appendChild(b);
    });
  }

  root.querySelectorAll("[data-area]").forEach(function (tab) {
    tab.addEventListener("click", function () {
      root.querySelectorAll("[data-area]").forEach(function (t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      area = tab.getAttribute("data-area");
      renderPalette();
    });
  });

  root.querySelector("[data-clear]").addEventListener("click", function () {
    lips.style.background = "transparent";
    cheeks.forEach(function (c) { c.style.background = "transparent"; });
    shop.hidden = true;
    palette.querySelectorAll(".sofie-shade__swatch").forEach(function (x) { x.classList.remove("is-on"); });
  });

  renderPalette();
})();
