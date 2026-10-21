(() => {
  if (customElements.get('sofie-beauty-room')) return;
  class SofieBeautyRoom extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      this.dialog = this.querySelector('[data-sfbr-dialog]');
      this.content = this.querySelector('[data-sfbr-content]');
      this.opener = null;
      this.busy = false;
      this.addEventListener('click', e => this.onClick(e));
      this.addEventListener('change', e => {
        if (e.target.matches('[data-sfbr-select]')) this.updateOption(e.target);
      });
      this.addEventListener('submit', e => {
        if (e.target.matches('.sfbr-form')) this.addToBag(e);
      });
      this.dialog.addEventListener('close', () => {
        if (this.opener?.isConnected) this.opener.focus({preventScroll: true});
      });
      this.dialog.addEventListener('click', e => {
        if (e.target === this.dialog) {
          const r = this.dialog.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.dialog.close();
        }
      });
      this.setupGuide();
      if (document.readyState === 'complete') this.measure('room_view');
      else window.addEventListener('load', () => this.measure('room_view'), {once:true});
    }
    setupGuide() {
      this.guides = [...this.querySelectorAll('[data-sfbr-mascot]')];
      if (!this.guides.length) return;
      this.resizeGuide = () => this.layoutGuide();
      window.addEventListener('resize', this.resizeGuide, {passive:true});
      requestAnimationFrame(this.resizeGuide);
      if (typeof ResizeObserver === 'function') {
        this.guideObserver = new ResizeObserver(this.resizeGuide);
        this.guideObserver.observe(this.querySelector('[data-sfbr-bays]'));
      }
    }
    disconnectedCallback() {
      this.guideObserver?.disconnect();
      window.removeEventListener('resize', this.resizeGuide);
    }
    layoutGuide() {
      if (!this.guides?.length) return;
      const board = this.querySelector('[data-sfbr-bays]');
      const origin = board.getBoundingClientRect();
      const arches = [...this.querySelectorAll('.sfbr-alcove')].map(el => {
        const r = el.getBoundingClientRect();
        return {x:r.left-origin.left+board.scrollLeft,y:r.top-origin.top,w:r.width,h:r.height};
      });
      if (!arches.length || arches[0].w < 1) return;
      let path = '';
      const p = n => Number(n.toFixed(1));
      arches.forEach((a,i) => {
        const lx=p(a.x+a.w*.01), rx=p(a.x+a.w*.99), cx=p(a.x+a.w*.5);
        const crown=p(a.y+a.h*.006), shoulder=p(a.y+a.h*.32);
        if (!i) path += `M ${lx} ${shoulder}`;
        else path += ` C ${p(a.x-a.w*.16)} ${p(a.y-a.h*.02)} ${p(a.x+a.w*.02)} ${p(a.y-a.h*.02)} ${lx} ${shoulder}`;
        path += ` C ${lx} ${p(a.y+a.h*.16)} ${p(a.x+a.w*.3)} ${crown} ${cx} ${crown}`;
        path += ` C ${p(a.x+a.w*.7)} ${crown} ${rx} ${p(a.y+a.h*.16)} ${rx} ${shoulder}`;
      });
      let lowerLane = 0;
      this.guides.forEach(guide => {
        let guidePath = path;
        if (!guide.classList.contains('sfbr-mini-guide--pocket')) {
          const a = arches[lowerLane++ % arches.length];
          const y = p(a.y + a.h * .99);
          guidePath = `M ${p(a.x+a.w*.14)} ${y} C ${p(a.x+a.w*.36)} ${p(y-3)} ${p(a.x+a.w*.64)} ${p(y-3)} ${p(a.x+a.w*.86)} ${y}`;
        }
        guide.style.setProperty('--sfbr-guide-path', `path("${guidePath}")`);
        guide.classList.add('has-path');
      });
      this.guides[0].parentElement.style.width = `${board.scrollWidth}px`;
    }
    measure(action, detail = {}) {
      if (window.SofieJourney?.consent?.() !== true) return;
      try { window.Shopify?.analytics?.publish?.('sofie_beauty_room', {action, edition: '01', ...detail}); } catch {}
    }
    onClick(e) {
      const close = e.target.closest('[data-sfbr-close]');
      if (close) { this.dialog.close(); return; }
      const zoneButton = e.target.closest('[data-sfbr-zone]');
      if (zoneButton) {
        const zone = zoneButton.dataset.sfbrZone;
        this.querySelectorAll('[data-sfbr-zone]').forEach(b => b.setAttribute('aria-pressed', String(b === zoneButton)));
        this.querySelectorAll('[data-sfbr-bay]').forEach(b => b.classList.toggle('is-selected', b.dataset.sfbrBay === zone));
        const bays = this.querySelector('[data-sfbr-bays]');
        const bay = zone === 'all' ? bays.firstElementChild : this.querySelector(`[data-sfbr-bay="${zone}"]`);
        if (bay && bays.scrollWidth > bays.clientWidth) {
          const delta = bay.getBoundingClientRect().left - bays.getBoundingClientRect().left;
          bays.scrollBy({left: delta - 20, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        }
        this.measure('shelf_select', {shelf: zone});
        return;
      }
      const peekButton = e.target.closest('[data-sfbr-peek-open]');
      const link = e.target.closest('[data-sfbr-open]');
      if ((!link && !peekButton) || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button > 0 || typeof this.dialog.showModal !== 'function') {
        if (!e.target.closest('.sfbr-piece')) this.querySelectorAll('.sfbr-piece.is-peek').forEach(p => p.classList.remove('is-peek'));
        return;
      }
      if (link && matchMedia('(hover: none)').matches && !link.closest('.sfbr-piece').classList.contains('is-peek')) {
        e.preventDefault();
        this.querySelectorAll('.sfbr-piece.is-peek').forEach(p => p.classList.remove('is-peek'));
        link.closest('.sfbr-piece').classList.add('is-peek');
        return;
      }
      const productId = peekButton ? peekButton.dataset.sfbrPeekOpen : link.dataset.sfbrOpen;
      const source = this.querySelector(`[data-sfbr-product="${productId}"]`);
      if (!source) return;
      e.preventDefault();
      if (this.busy) return;
      this.opener = link || this.querySelector(`[data-sfbr-open="${productId}"]`);
      this.content.replaceChildren(source.content.cloneNode(true));
      const select = this.content.querySelector('[data-sfbr-select]');
      this.updateOption(select);
      this.dialog.showModal();
      this.measure('product_open', {handle: this.content.querySelector('form').dataset.handle});
    }
    updateOption(select) {
      if (!select) return;
      const option = select.selectedOptions[0];
      const valid = !!select.value && option?.dataset.available === 'true';
      const button = this.content.querySelector('[type="submit"]');
      button.disabled = this.busy || !valid;
      this.content.querySelector('[data-sfbr-availability]').textContent = select.value ? (valid ? this.dataset.available : this.dataset.soldOut) : this.dataset.choose;
      if (option?.dataset.price) this.content.querySelector('[data-sfbr-price]').textContent = option.dataset.price;
      if (option?.dataset.image) {
        const img = this.content.querySelector('.sfbr-detail-image');
        img.removeAttribute('srcset');
        img.src = option.dataset.image;
      }
      const details = this.content.querySelector('[data-sfbr-details]');
      const url = new URL(details.href);
      if (select.value) url.searchParams.set('variant', select.value);
      else url.searchParams.delete('variant');
      details.href = url.href;
      const status = this.content.querySelector('[data-sfbr-status]');
      if (!this.busy) { status.textContent = ''; delete status.dataset.error; }
    }
    async addToBag(e) {
      e.preventDefault();
      if (this.busy) return;
      const form = e.target;
      const select = form.querySelector('[data-sfbr-select]');
      if (!select.value || select.selectedOptions[0]?.dataset.available !== 'true') { select.reportValidity(); return; }
      const button = form.querySelector('[type="submit"]');
      const status = form.querySelector('[data-sfbr-status]');
      this.busy = true;
      button.disabled = true;
      select.disabled = true;
      form.setAttribute('aria-busy', 'true');
      button.textContent = this.dataset.adding;
      status.textContent = '';
      delete status.dataset.error;
      try {
        const response = await fetch(`${this.dataset.root}cart/add.js`, {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', Accept: 'application/json'},
          body: JSON.stringify({items: [{id: select.value, quantity: 1}]})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.description || data.message || this.dataset.error);
        status.textContent = this.dataset.added;
        form.querySelector('[data-sfbr-view-bag]').hidden = false;
        document.dispatchEvent(new CustomEvent('sofie:journey:cart-added', {detail: {variantIds: [select.value]}}));
        this.measure('cart_add', {handle: form.dataset.handle, variant_id: select.value});
        try {
          const cartResponse = await fetch(`${this.dataset.root}cart.js`, {credentials: 'same-origin', headers: {Accept: 'application/json'}});
          if (cartResponse.ok) {
            const cart = await cartResponse.json();
            document.querySelectorAll('[data-cart-count], [data-sfbr-cart-count]').forEach(n => { n.textContent = cart.item_count; });
          }
        } catch {}
      } catch (error) {
        status.textContent = error.message || this.dataset.error;
        status.dataset.error = 'true';
        this.measure('cart_error', {handle: form.dataset.handle});
      } finally {
        this.busy = false;
        select.disabled = false;
        form.removeAttribute('aria-busy');
        button.textContent = button.dataset.label;
        button.disabled = !select.value || select.selectedOptions[0]?.dataset.available !== 'true';
      }
    }
  }
  customElements.define('sofie-beauty-room', SofieBeautyRoom);
})();
