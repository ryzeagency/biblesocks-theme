/**
 * Endless scrolling for the collection grid (Collection → Products → Load more as
 * you scroll). It wraps the page links: once the end of the grid nears the
 * screen, the next page is fetched as just this section and its products are
 * appended, until there are no pages left. Filtering re-renders the section,
 * which brings a fresh copy of this element with it. Without script the page
 * links still work.
 */
if (!customElements.get('collection-infinite-scroll')) {
  customElements.define(
    'collection-infinite-scroll',
    class CollectionInfiniteScroll extends HTMLElement {
      connectedCallback() {
        this.grid = this.closest('[data-collection-products]')?.querySelector('[data-collection-grid]');
        this.nextUrl = this.dataset.nextUrl;
        if (!this.grid || !this.nextUrl || !('IntersectionObserver' in window)) return;

        // With script running, the page links give way to loading as you go.
        this.classList.add('is-active');
        this.observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) this.loadNext();
          },
          { rootMargin: '0px 0px 800px 0px' }
        );
        this.observer.observe(this);
      }

      disconnectedCallback() {
        this.observer?.disconnect();
      }

      async loadNext() {
        if (this.loading || !this.nextUrl) return;
        this.loading = true;
        this.setAttribute('aria-busy', 'true');

        try {
          const url = new URL(this.nextUrl, window.location.origin);
          url.searchParams.set('section_id', this.dataset.sectionId);
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) throw new Error(`Status ${response.status}`);
          const html = new DOMParser().parseFromString(await response.text(), 'text/html');

          this.grid.append(...html.querySelectorAll('[data-collection-grid] > .grid__item'));
          this.nextUrl = html.querySelector('collection-infinite-scroll')?.dataset.nextUrl || '';

          // Impulse fades photos in through AOS, which only tracks what it saw at load.
          if (window.AOS) window.AOS.refreshHard();
        } catch (error) {
          console.error(error);
          // Fall back on the page links.
          this.classList.remove('is-active');
          this.observer.disconnect();
          return;
        } finally {
          this.loading = false;
          this.removeAttribute('aria-busy');
        }

        if (!this.nextUrl) {
          this.observer.disconnect();
          this.remove();
          return;
        }
        // Still in view after a short page: observing afresh reports it again.
        this.observer.unobserve(this);
        this.observer.observe(this);
      }
    }
  );
}
