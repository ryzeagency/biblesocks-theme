/**
 * <cart-upsell>
 *
 * The popup that comes up when Add bundle to cart is pressed, before anything
 * goes in the cart. Each time it features one collection, at random and never
 * the one shown last, and lets the shopper tick a few products to add with the
 * pack. sock-bundle.js asks for it through offer(), which settles with the
 * shopper's choice:
 *   - Add N to my order  -> { proceed: true, extras: [...] }
 *   - No thanks          -> { proceed: true, extras: [] }
 *   - close / Escape     -> { proceed: false }  (nothing is added)
 */

if (!customElements.get('cart-upsell')) {
  customElements.define(
    'cart-upsell',
    class CartUpsell extends HTMLElement {
      connectedCallback() {
        try {
          this.collections = JSON.parse(
            this.querySelector('[data-cart-upsell-collections]')?.textContent || '[]'
          );
        } catch (error) {
          this.collections = [];
        }

        this.dialog = this.querySelector('[role="dialog"]');
        this.overlay = this.querySelector('.cart-upsell__overlay');
        this.body = this.querySelector('[data-cart-upsell-body]');
        this.addButton = this.querySelector('[data-cart-upsell-add]');
        this.errorEl = this.querySelector('[data-cart-upsell-error]');
        this.moneyFormat = this.dataset.moneyFormat || '${{amount}}';
        this.addText = this.dataset.addText || 'Add [count] To Cart · [total]';
        this.emptyText = this.dataset.emptyText || 'Pick your favorites above';
        this.cache = {};

        this.addEventListener('click', this.onClick.bind(this));
        this.addEventListener('change', this.onChange.bind(this));
        this.addEventListener('keydown', this.onKeydown.bind(this));
        this.addButton.addEventListener('click', this.onAdd.bind(this));
      }

      /**
       * Show the popup and wait for the shopper's choice. If there is nothing
       * to offer, it settles at once so the pack still goes in.
       */
      offer() {
        return new Promise((resolve) => {
          this.settle = resolve;
          this.open().then((shown) => {
            if (!shown) this.finish({ proceed: true, extras: [] });
          });
        });
      }

      finish(choice) {
        const settle = this.settle;
        this.settle = null;
        if (!this.dialog.hidden) this.close();
        settle?.(choice);
      }

      /** A random collection, never the one shown last time. */
      pickCollection() {
        let last = '';
        try {
          last = sessionStorage.getItem('biblesocks-upsell-last') || '';
        } catch (error) {}
        const pool =
          this.collections.length > 1
            ? this.collections.filter((entry) => entry.handle !== last)
            : this.collections;
        return pool[Math.floor(Math.random() * pool.length)] || null;
      }

      async open() {
        // Try collections until one has something to offer, at most a few.
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const choice = this.pickCollection();
          if (!choice) return;
          try {
            sessionStorage.setItem('biblesocks-upsell-last', choice.handle);
          } catch (error) {}

          const html = await this.load(choice.handle);
          if (!html) continue;

          this.querySelector('[data-cart-upsell-badge]').textContent = choice.badge || '';
          this.querySelector('[data-cart-upsell-headline]').textContent = choice.headline || '';
          const text = this.querySelector('[data-cart-upsell-text]');
          text.textContent = choice.text || '';
          text.hidden = !choice.text;
          this.body.innerHTML = html;
          this.setError('');
          this.update();
          this.show();
          return true;
        }
        return false;
      }

      /** The collection's tiles, fetched once per page. Empty if none to offer. */
      async load(handle) {
        if (handle in this.cache) return this.cache[handle];
        let html = '';
        try {
          const root = window.Shopify?.routes?.root || '/';
          const response = await fetch(
            `${root}collections/${encodeURIComponent(handle)}?section_id=cart-upsell-grid`
          );
          if (response.ok) {
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const grid = doc.querySelector('[data-cart-upsell-grid]');
            if (grid && grid.querySelector('[data-cart-upsell-tile]')) html = grid.outerHTML;
          }
        } catch (error) {
          console.error(error);
        }
        this.cache[handle] = html;
        return html;
      }

      show() {
        this.lastFocus = document.activeElement;
        this.overlay.hidden = false;
        this.dialog.hidden = false;
        document.body.classList.add('cart-upsell-open');
        requestAnimationFrame(() => this.classList.add('is-open'));
        this.dialog.focus();
      }

      close() {
        this.classList.remove('is-open');
        this.overlay.hidden = true;
        this.dialog.hidden = true;
        document.body.classList.remove('cart-upsell-open');
        this.lastFocus?.focus?.();
      }

      onClick(event) {
        if (event.target.closest('[data-cart-upsell-close]')) {
          this.finish({ proceed: false });
          return;
        }
        if (event.target.closest('[data-cart-upsell-skip]')) {
          this.finish({ proceed: true, extras: [] });
          return;
        }
        const tile = event.target.closest('[data-cart-upsell-tile]');
        if (tile && !event.target.closest('select')) this.toggle(tile);
      }

      onKeydown(event) {
        if (event.key === 'Escape') {
          this.finish({ proceed: false });
          return;
        }
        const tile = event.target.closest?.('[data-cart-upsell-tile]');
        if (tile && event.target === tile && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          this.toggle(tile);
        }
        // Keep focus inside the popup.
        if (event.key === 'Tab' && !this.dialog.hidden) {
          const focusable = Array.from(
            this.dialog.querySelectorAll('button:not([disabled]), a[href], select, [tabindex="0"]')
          );
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }

      /** A size change: the tile's price follows it, and so does the total. */
      onChange(event) {
        const field = event.target.closest('[data-cart-upsell-variant]');
        if (!field) return;
        const tile = field.closest('[data-cart-upsell-tile]');
        const option = field.options[field.selectedIndex];
        const price = tile.querySelector('[data-cart-upsell-price]');
        if (option && price) price.textContent = option.dataset.money;
        // Choosing a size is choosing the product.
        if (tile.getAttribute('aria-pressed') !== 'true') this.toggle(tile);
        else this.update();
      }

      toggle(tile) {
        const on = tile.getAttribute('aria-pressed') !== 'true';
        tile.setAttribute('aria-pressed', String(on));
        this.update();
      }

      selected() {
        return Array.from(this.body.querySelectorAll('[data-cart-upsell-tile][aria-pressed="true"]'))
          .map((tile) => {
            const field = tile.querySelector('[data-cart-upsell-variant]');
            const source = field?.tagName === 'SELECT' ? field.options[field.selectedIndex] : field;
            return source
              ? {
                  id: Number(field.value),
                  price: parseInt(source.dataset.price, 10) || 0,
                  sock: tile.dataset.sock === 'true',
                }
              : null;
          })
          .filter(Boolean);
      }

      update() {
        const picks = this.selected();
        const total = picks.reduce((sum, pick) => sum + pick.price, 0);
        this.addButton.disabled = picks.length === 0;
        this.addButton.textContent = picks.length
          ? this.addText.replace('[count]', picks.length).replace('[total]', this.formatMoney(total))
          : this.emptyText;
      }

      /** Hand the picks back; sock-bundle.js adds them with the pack. */
      onAdd() {
        const picks = this.selected();
        if (!picks.length) return;
        this.finish({
          proceed: true,
          extras: picks.map((pick) => ({ id: pick.id, quantity: 1, sock: pick.sock })),
        });
      }

      setError(message) {
        if (this.errorEl) this.errorEl.textContent = message;
      }

      /** The four Shopify money_format tokens this store can use. */
      formatMoney(cents) {
        const value = (cents || 0) / 100;
        const format = (decimals, thousands, decimal) => {
          const parts = value.toFixed(decimals).split('.');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
          return parts.join(decimal);
        };
        return this.moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
          switch (token) {
            case 'amount':
              return format(2, ',', '.');
            case 'amount_no_decimals':
              return format(0, ',', '.');
            case 'amount_with_comma_separator':
              return format(2, '.', ',');
            case 'amount_no_decimals_with_comma_separator':
              return format(0, '.', ',');
            default:
              return value.toFixed(2);
          }
        });
      }
    }
  );
}
