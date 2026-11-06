/**
 * <cart-extras>
 *
 * Keeps the cart page's savings summary, free shipping bar and "You might also
 * like" list in step with the cart.
 *
 *  - Impulse rebuilds the cart items over Ajax whenever a quantity changes, so
 *    this watches the items list and re-renders its own parts through Shopify's
 *    section rendering, which keeps all the maths in Liquid.
 *  - The Add buttons post to /cart/add.js, then ask Impulse to rebuild the cart.
 */

if (!customElements.get('cart-extras')) {
  customElements.define(
    'cart-extras',
    class CartExtras extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.cartUrl = this.dataset.cartUrl || '/cart';
        this.addUrl = window.theme?.routes?.cartAdd || '/cart/add.js';
        this.root = window.Shopify?.routes?.root || '/';

        // "2:CODE10, 3:CODE15, 4:CODE20" (Theme settings > Cart), smallest pack first.
        this.packCodes = (this.dataset.packCodes || '')
          .split(',')
          .map((pair) => pair.split(':').map((part) => part.trim()))
          .filter(([qty, code]) => parseInt(qty, 10) > 0 && code)
          .map(([qty, code]) => ({ qty: parseInt(qty, 10), code }))
          .sort((a, b) => a.qty - b.qty);

        this.onClick = this.onClick.bind(this);
        this.onChange = this.onChange.bind(this);
        this.refresh = this.refresh.bind(this);

        this.addEventListener('click', this.onClick);
        this.addEventListener('change', this.onChange);

        // Impulse swaps the items list's contents on every cart rebuild.
        const items = document.querySelector('#CartPageForm [data-products]');
        if (items) {
          this.observer = new MutationObserver(() => this.scheduleRefresh());
          this.observer.observe(items, { childList: true });
        }
        document.addEventListener('cart:updated', this.refresh);
      }

      disconnectedCallback() {
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('change', this.onChange);
        this.observer?.disconnect();
        document.removeEventListener('cart:updated', this.refresh);
      }

      scheduleRefresh() {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(this.refresh, 80);
      }

      /** Re-render the summary and the suggestions from the section's Liquid. */
      async refresh() {
        try {
          const url = `${this.cartUrl}?section_id=${encodeURIComponent(this.sectionId)}`;
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) return;

          const html = new DOMParser().parseFromString(await response.text(), 'text/html');
          document.querySelectorAll('[data-cart-extras-part]').forEach((part) => {
            const fresh = html.querySelector(`[data-cart-extras-part="${part.dataset.cartExtrasPart}"]`);
            if (fresh) part.innerHTML = fresh.innerHTML;
          });
        } catch (error) {
          console.error(error);
        }
      }

      /** A size dropdown changes the price shown next to it. */
      onChange(event) {
        const select = event.target.closest('select[data-cart-extras-variant]');
        if (!select) return;
        const cost = select.closest('[data-cart-extras-item]')?.querySelector('[data-cart-extras-cost]');
        const option = select.options[select.selectedIndex];
        if (cost && option?.dataset.cost) cost.textContent = option.dataset.cost;
      }

      async onClick(event) {
        const button = event.target.closest('[data-cart-extras-add]');
        if (!button || button.disabled) return;

        const item = button.closest('[data-cart-extras-item]');
        const variantId = item?.querySelector('[data-cart-extras-variant]')?.value;
        if (!variantId) return;

        const error = this.querySelector('[data-cart-extras-error]');
        if (error) error.textContent = '';
        button.disabled = true;
        button.classList.add('is-loading');

        try {
          const response = await fetch(this.addUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] }),
          });
          const result = await response.json();

          if (!response.ok || result.status) {
            if (error) error.textContent = result.description || result.message || 'Could not add to cart.';
            button.disabled = false;
            return;
          }

          // One more sock can tip the cart into a bigger pack.
          await this.syncPackCode();

          // Impulse rebuilds the cart items and drawer; the observer then refreshes us.
          document.dispatchEvent(new CustomEvent('cart:build'));
        } catch (err) {
          console.error(err);
          if (error) error.textContent = 'Something went wrong. Please try again.';
          button.disabled = false;
        } finally {
          button.classList.remove('is-loading');
        }
      }

      /**
       * Swap the cart onto the pack code its new size earns. Only pack codes are
       * swapped; a code the shopper entered themselves stays. item_count also
       * counts things the codes do not cover (a gift box, a bundle), so a code
       * may come back not applicable; step down until one applies.
       */
      async syncPackCode() {
        if (!this.packCodes.length) return;
        const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

        const cart = await fetch(`${this.root}cart.js`, { headers: json }).then((r) => r.json());
        const packCodes = this.packCodes.map((pack) => pack.code.toLowerCase());
        const current = (cart.discount_codes || []).map((entry) => String(entry.code).toLowerCase());
        if (current.some((code) => !packCodes.includes(code))) return;

        const candidates = [
          ...new Set(
            this.packCodes
              .filter((pack) => pack.qty <= cart.item_count)
              .map((pack) => pack.code)
              .reverse()
          ),
        ];
        if (!candidates.length || current.includes(candidates[0].toLowerCase())) return;

        const applies = (result, code) =>
          (result.discount_codes || []).some(
            (entry) =>
              String(entry.code).toLowerCase() === code.toLowerCase() && entry.applicable !== false
          );
        for (const code of candidates) {
          const result = await fetch(`${this.root}cart/update.js`, {
            method: 'POST',
            headers: json,
            body: JSON.stringify({ discount: code }),
          }).then((r) => r.json());
          if (applies(result, code)) return;
        }

        // None applied: put back whatever pack code the cart had.
        if (current.length) {
          await fetch(`${this.root}cart/update.js`, {
            method: 'POST',
            headers: json,
            body: JSON.stringify({ discount: current.join(',') }),
          });
        }
      }
    }
  );
}
