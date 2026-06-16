/* ==========================================================================
   SOFIE STORE — LUXURY INTERACTIONS
   Lightweight, dependency-free, defer-loaded. Progressive enhancement only:
   everything degrades to working links/forms if JS is disabled.
   - Scroll reveal (IntersectionObserver)
   - Quick add to cart (Shopify AJAX Cart API) with graceful fallback
   - Accessible FAQ (uses native <details>, this only handles analytics hooks)
   ========================================================================== */
(function () {
  "use strict";

  // The sections each include this file, so on a page with several lux sections
  // the script can be injected multiple times. Initialise ONCE — otherwise the
  // document-level "Add to Bag" listener would attach repeatedly (adding an item
  // several times per click) and we'd run redundant observers.
  if (window.__sofieLuxInit) return;
  window.__sofieLuxInit = true;

  /* ---- Scroll reveal ---------------------------------------------------- */
  var reveals = document.querySelectorAll(".sofie-reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---- Quick add to cart ----------------------------------------------- */
  // Each quick-add button carries data-variant-id. We POST to /cart/add.js and
  // dispatch a 'sofie:cart:added' event the theme/cart-drawer can listen for.
  function refreshCartCount() {
    fetch(window.Shopify && window.Shopify.routes ? window.Shopify.routes.root + "cart.js" : "/cart.js", {
      headers: { "Accept": "application/json" }
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        document.querySelectorAll("[data-cart-count]").forEach(function (n) {
          n.textContent = cart.item_count;
        });
        document.dispatchEvent(new CustomEvent("sofie:cart:updated", { detail: cart }));
      })
      .catch(function () {});
  }

  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-quick-add]");
    if (!btn) return;
    var variantId = btn.getAttribute("data-variant-id");
    if (!variantId) return; // let it behave as a normal link to PDP
    ev.preventDefault();

    if (btn.hasAttribute("aria-busy")) return;
    var original = btn.innerHTML;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = "Adding…";

    var root = window.Shopify && window.Shopify.routes ? window.Shopify.routes.root : "/";
    fetch(root + "cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] })
    })
      .then(function (r) {
        if (!r.ok) throw new Error("add failed");
        return r.json();
      })
      .then(function (line) {
        btn.innerHTML = "Added ✓";
        refreshCartCount();
        document.dispatchEvent(new CustomEvent("sofie:cart:added", { detail: line }));
        // Try to open common cart drawers if present
        var drawer = document.querySelector("cart-drawer, #CartDrawer, .drawer--cart, [data-cart-drawer]");
        if (drawer && typeof drawer.open === "function") { drawer.open(); }
        setTimeout(function () { btn.innerHTML = original; btn.removeAttribute("aria-busy"); }, 1600);
      })
      .catch(function () {
        // Fallback: send the customer to the product page so they never get stuck
        var href = btn.getAttribute("data-product-url");
        if (href) { window.location.href = href; }
        else { btn.innerHTML = original; btn.removeAttribute("aria-busy"); }
      });
  });

  /* ---- FAQ single-open behaviour (optional, accessible) ---------------- */
  document.querySelectorAll("[data-faq-exclusive]").forEach(function (group) {
    var items = group.querySelectorAll("details.sofie-faq__item");
    items.forEach(function (item) {
      item.addEventListener("toggle", function () {
        if (item.open) {
          items.forEach(function (other) { if (other !== item) other.open = false; });
        }
      });
    });
  });
})();
