/**
 * <cart-recommendations>
 *
 * "You might also like", on the cart page and in the cart drawer. Each card's
 * price follows its size dropdown, and Add puts that sock in the cart and moves
 * the cart onto the pack code its new size earns. Then the cart page reloads;
 * the drawer (data-mode="drawer") has Impulse rebuild it in place instead.
 *
 * In the drawer the cards are not in the page: data-collections lists the
 * collections to suggest from, and one is picked at random on each page load.
 */

if (!customElements.get('cart-recommendations')) {
  customElements.define(
    'cart-recommendations',
    class CartRecommendations extends HTMLElement {
      connectedCallback() {
        this.errorEl = this.querySelector('[data-cart-recs-error]');
        this.addUrl = `${this.dataset.cartAddUrl || '/cart/add'}.js`;
        this.updateUrl = `${this.dataset.cartUpdateUrl || '/cart/update'}.js`;

        // "2:CODE10, 3:CODE15, 4:CODE20", smallest pack first.
        this.packCodes = (this.dataset.packCodes || '')
          .split(',')
          .map((pair) => pair.split(':').map((part) => part.trim()))
          .filter(([qty, code]) => parseInt(qty, 10) > 0 && code)
          .map(([qty, code]) => ({ qty: parseInt(qty, 10), code }))
          .sort((a, b) => a.qty - b.qty);

        this.addEventListener('change', this.onVariantChange.bind(this));
        this.addEventListener('click', this.onClick.bind(this));

        if (this.dataset.collections) this.loadRandomCollection();
      }

      /**
       * Fill the cards from a random collection, never the one shown last time,
       * moving on to another if one has nothing to suggest.
       */
      async loadRandomCollection() {
        const target = this.querySelector('[data-cart-recs-target]');
        let handles = [];
        try {
          handles = JSON.parse(this.dataset.collections || '[]');
        } catch (error) {}
        if (!target || !handles.length) return;

        let last = '';
        try {
          last = sessionStorage.getItem('biblesocks-drawer-recs-last') || '';
        } catch (error) {}
        const pool = handles.length > 1 ? handles.filter((handle) => handle !== last) : handles;
        for (let i = pool.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }

        const root = window.Shopify?.routes?.root || '/';
        for (const handle of pool.slice(0, 3)) {
          try {
            const response = await fetch(
              `${root}collections/${encodeURIComponent(handle)}?section_id=cart-drawer-recs-grid`
            );
            if (!response.ok) continue;
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const grid = doc.querySelector('[data-cart-recs-grid]');
            if (!grid || !grid.querySelector('[data-picker-card]')) continue;
            target.innerHTML = grid.innerHTML;
            this.hidden = false;
            try {
              sessionStorage.setItem('biblesocks-drawer-recs-last', handle);
            } catch (error) {}
            return;
          } catch (error) {
            console.error(error);
          }
        }
      }

      selectedOption(card) {
        const field = card.querySelector('[data-picker-variant]');
        if (!field) return null;
        return field.tagName === 'SELECT' ? field.options[field.selectedIndex] : field;
      }

      onVariantChange(event) {
        const card = event.target.closest('[data-picker-card]');
        if (!card) return;
        const option = this.selectedOption(card);
        const price = card.querySelector('[data-picker-price]');
        if (option?.dataset.variantMoney && price) price.textContent = option.dataset.variantMoney;
      }

      async onClick(event) {
        const button = event.target.closest('[data-picker-add]');
        if (!button || button.disabled) return;

        const option = this.selectedOption(button.closest('[data-picker-card]'));
        if (!option?.value) return;

        button.disabled = true;
        button.classList.add('loading');
        this.setError('');

        try {
          const response = await fetch(this.addUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [{ id: Number(option.value), quantity: 1 }] }),
          });
          const result = await response.json();
          if (!response.ok || result.status) {
            this.setError(result.description || result.message || 'Could not add to cart.');
            button.disabled = false;
            button.classList.remove('loading');
            return;
          }

          await this.syncPackCode();
          if (this.dataset.mode === 'drawer') {
            // That sock is in the cart now; stop suggesting it.
            button.closest('[data-picker-card]')?.remove();
            if (!this.querySelector('[data-picker-card]')) this.hidden = true;
            await this.refreshDrawer();
          } else {
            window.location.reload();
          }
        } catch (error) {
          console.error(error);
          this.setError('Something went wrong. Please try again.');
          button.disabled = false;
          button.classList.remove('loading');
        }
      }

      /**
       * One more sock can tip the cart into a bigger pack, so swap to the code
       * it now earns. Only pack codes are swapped; a code the shopper entered
       * themselves stays.
       */
      async syncPackCode() {
        if (!this.packCodes.length) return;

        const root = window.Shopify?.routes?.root || '/';
        const cart = await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } }).then(
          (response) => response.json()
        );

        const packCodes = this.packCodes.map((pack) => pack.code.toLowerCase());
        const current = (cart.discount_codes || []).map((entry) => String(entry.code).toLowerCase());
        if (current.some((code) => !packCodes.includes(code))) return;

        // Best first. item_count also counts things the codes do not cover (a
        // tie, a bow), so a code may come back not applicable; step down until
        // one applies.
        const candidates = this.packCodes
          .filter((pack) => pack.qty <= cart.item_count)
          .map((pack) => pack.code)
          .reverse();
        const applies = (result, code) =>
          (result.discount_codes || []).some(
            (entry) =>
              String(entry.code).toLowerCase() === code.toLowerCase() && entry.applicable !== false
          );

        for (const code of [...new Set(candidates)]) {
          if (current.includes(code.toLowerCase()) && candidates[0] === code) return;
          const result = await fetch(this.updateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ discount: code }),
          }).then((response) => response.json());
          if (applies(result, code)) return;
        }

        // None applied: put back whatever pack code the cart had.
        if (current.length) {
          await fetch(this.updateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ discount: current.join(',') }),
          });
        }
      }

      /** Have Impulse redraw the drawer's items and totals in place. */
      async refreshDrawer() {
        document.dispatchEvent(new CustomEvent('cart:build'));
      }

      setError(message) {
        if (this.errorEl) this.errorEl.textContent = message;
      }
    }
  );
}
