/**
 * Add to cart under product cards on collection pages (snippets/product-card-add.liquid).
 *
 * One listener on the document handles every card, including those that load
 * more as you scroll or that a filter re-renders. The size is posted to
 * /cart/add.js, then Impulse is asked to rebuild its cart drawer and open it.
 * Without script the form posts to /cart/add as usual.
 */
(function () {
  if (window.productCardAddReady) return;
  window.productCardAddReady = true;

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-product-card-add]');
    if (!form) return;
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    const error = form.querySelector('.product-card-add__error');
    if (!button || button.classList.contains('btn--loading')) return;

    error.hidden = true;
    error.textContent = '';
    button.classList.add('btn--loading');
    button.setAttribute('aria-busy', 'true');

    let message = 'Something went wrong. Please try again.';
    try {
      const response = await fetch(window.theme?.routes?.cartAdd || '/cart/add.js', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const result = await response.json();

      // Shopify answers a failed add with { status, description }.
      if (!response.ok || result.status) {
        message = result.description || result.message || message;
        throw new Error(message);
      }

      if (window.theme?.settings?.cartType === 'page') {
        window.location = window.theme.routes.cartPage;
        return;
      }
      document.dispatchEvent(new CustomEvent('cart:build'));
      document.dispatchEvent(new CustomEvent('cart:open'));
    } catch (err) {
      console.error(err);
      error.textContent = message;
      error.hidden = false;
    } finally {
      button.classList.remove('btn--loading');
      button.removeAttribute('aria-busy');
    }
  });
})();
