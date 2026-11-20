/**
 * <collection-pack-bar>
 *
 * The buy more save more tracker docked to the bottom of collection pages
 * (sections/main-collection.liquid). It shows once the cart holds socks the
 * pack steps count, and comes up after a quick add (assets/product-card-add.js
 * calls afterAdd()).
 *
 *  - Its contents are Liquid (snippets/collection-pack-bar.liquid), redrawn
 *    through ?section_id=collection-pack-bar whenever the cart changes: a quick
 *    add, or the drawer's + and − and Remove.
 *  - × hides it until the next quick add.
 *  - "View cart" opens Impulse's cart drawer (or goes to the cart page).
 */

if (!customElements.get('collection-pack-bar')) {
  customElements.define(
    'collection-pack-bar',
    class CollectionPackBar extends HTMLElement {
      connectedCallback() {
        this.content = this.querySelector('[data-pack-bar-content]');
        this.dismissed = false;
        this.ticket = 0;

        this.querySelector('[data-pack-bar-close]')?.addEventListener('click', () => {
          this.dismissed = true;
          this.sync();
        });
        this.querySelector('[data-pack-bar-view]')?.addEventListener('click', (event) => {
          if (window.theme?.settings?.cartType === 'page' || !document.getElementById('CartDrawer')) return;
          event.preventDefault();
          document.dispatchEvent(new CustomEvent('cart:open'));
        });

        this.schedule = this.schedule.bind(this);
        document.addEventListener('cart:updated', this.schedule);
        // Impulse rebuilds the drawer's items after every add, remove and quantity change.
        const items = document.querySelector('#CartDrawer [data-products]');
        if (items) {
          this.itemsObserver = new MutationObserver(this.schedule);
          this.itemsObserver.observe(items, { childList: true });
        }

        // The page keeps room at the bottom for the bar, so the footer is not hidden behind it.
        if ('ResizeObserver' in window) {
          this.sizeObserver = new ResizeObserver(() => this.measure());
          this.sizeObserver.observe(this);
        }

        this.sync();
      }

      disconnectedCallback() {
        document.removeEventListener('cart:updated', this.schedule);
        this.itemsObserver?.disconnect();
        this.sizeObserver?.disconnect();
        clearTimeout(this.timer);
        document.body.classList.remove('has-collection-pack-bar');
        document.body.style.removeProperty('--collection-pack-bar-height');
      }

      /** After a quick add: brings the bar back up. True if it is showing. */
      async afterAdd() {
        this.dismissed = false;
        await this.refresh();
        return this.classList.contains('is-visible');
      }

      schedule() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.refresh(), 60);
      }

      async refresh() {
        const ticket = ++this.ticket;
        try {
          const response = await fetch(`${this.dataset.url}?section_id=collection-pack-bar&t=${Date.now()}`, {
            credentials: 'same-origin',
          });
          if (!response.ok || ticket !== this.ticket) return;
          const holder = document.createElement('div');
          holder.innerHTML = await response.text();
          if (ticket !== this.ticket) return;
          const section = holder.querySelector('.shopify-section') || holder;
          this.content.innerHTML = section.innerHTML;
        } catch (error) {
          console.error(error);
        }
        this.sync();
      }

      sync() {
        const show = !this.dismissed && Boolean(this.content?.querySelector('.cart-pack-progress'));
        this.classList.toggle('is-visible', show);
        this.setAttribute('aria-hidden', String(!show));
        this.inert = !show;
        document.body.classList.toggle('has-collection-pack-bar', show);
        this.measure();
      }

      measure() {
        if (!this.classList.contains('is-visible')) return;
        document.body.style.setProperty(
          '--collection-pack-bar-height',
          `${Math.ceil(this.getBoundingClientRect().height)}px`
        );
      }
    }
  );
}
