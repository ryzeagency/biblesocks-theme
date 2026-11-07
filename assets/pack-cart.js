/**
 * PackCart: the Shopify cart is the pack.
 *
 * One place that changes the cart for the sock bundle, the cart page and the
 * cart drawer, so none of them can disagree with the others:
 *
 *  - add() / change() post to Shopify's Ajax cart, then sync().
 *  - sync() puts the pack discount code the cart's socks earn on the cart
 *    ("2:CODE10, 3:CODE15, …" from Theme settings > Cart > Pack discount codes),
 *    stepping down until Shopify says one applies, and takes a pack code off
 *    when the cart drops below the smallest pack. A code the shopper typed in
 *    themselves is never touched.
 *  - Every change ends with a `pack-cart:change` event carrying the fresh
 *    /cart.js, and `cart:build`, which has Impulse redraw the drawer, the cart
 *    page and the header count from the same cart.
 *  - Quantity changes made in Impulse's drawer or cart page (`cart:updated`)
 *    are synced the same way.
 *
 * Calls are queued, so a second tap waits for the first to finish.
 */

(() => {
  if (window.PackCart) return;

  const script = document.currentScript;
  const root = (window.Shopify?.routes?.root || '/').replace(/\/?$/, '/');
  const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

  const codes = (script?.dataset.packCodes || '')
    .split(',')
    .map((pair) => pair.split(':').map((part) => part.trim()))
    .filter(([qty, code]) => parseInt(qty, 10) > 0 && code)
    .map(([qty, code]) => ({ qty: parseInt(qty, 10), code }))
    .sort((a, b) => a.qty - b.qty);
  const packCodes = codes.map((pack) => pack.code.toLowerCase());
  const sockType = (script?.dataset.sockType || '').trim().toLowerCase();

  let queue = Promise.resolve();
  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  const post = async (path, body) => {
    const response = await fetch(`${root}${path}`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.status) {
      const error = new Error(result.description || result.message || 'Could not update your cart.');
      error.result = result;
      throw error;
    }
    return result;
  };

  const getCart = () => fetch(`${root}cart.js`, { headers: json }).then((r) => r.json());

  const isSock = (item) => !sockType || String(item.product_type || '').toLowerCase() === sockType;

  const sockCount = (cart) =>
    (cart?.items || []).filter(isSock).reduce((sum, item) => sum + item.quantity, 0);

  const currentCodes = (cart) =>
    (cart?.discount_codes || []).map((entry) => String(entry.code).toLowerCase());

  const applies = (cart, code) =>
    (cart.discount_codes || []).some(
      (entry) => String(entry.code).toLowerCase() === code.toLowerCase() && entry.applicable !== false
    );

  /** The pack codes this many socks earns, best first. */
  const codesFor = (count) => [
    ...new Set(
      codes
        .filter((pack) => pack.qty <= count)
        .map((pack) => pack.code)
        .reverse()
    ),
  ];

  /**
   * Put the right pack code on the cart. Resolves to
   * { cart, changed, wanted, applied }: `wanted` is the code the socks earn,
   * `applied` the one Shopify took (null if none would apply).
   */
  const syncNow = async (given) => {
    let cart = given || (await getCart());
    const current = currentCodes(cart);
    const outcome = { cart, changed: false, wanted: null, applied: null };
    if (!codes.length) return outcome;

    // A code the shopper typed in themselves stays.
    if (current.some((code) => !packCodes.includes(code))) return outcome;

    const candidates = codesFor(sockCount(cart));
    outcome.wanted = candidates[0] || null;

    if (!candidates.length) {
      // Below the smallest pack: take the pack code back off.
      if (current.length) {
        cart = await post('cart/update.js', { discount: '' });
        Object.assign(outcome, { cart, changed: true });
      }
      return outcome;
    }

    if (current.length === 1 && current[0] === candidates[0].toLowerCase() && applies(cart, candidates[0])) {
      outcome.applied = candidates[0];
      return outcome;
    }

    for (const code of candidates) {
      cart = await post('cart/update.js', { discount: code });
      outcome.cart = cart;
      outcome.changed = true;
      if (applies(cart, code)) {
        outcome.applied = code;
        return outcome;
      }
    }

    // None would apply (e.g. the codes do not cover these socks): leave none.
    cart = await post('cart/update.js', { discount: '' });
    outcome.cart = cart;
    return outcome;
  };

  /** Tell the page: Impulse redraws drawer, cart page and count; the builder repaints. */
  const announce = (cart, { rebuild = true } = {}) => {
    if (rebuild) document.dispatchEvent(new CustomEvent('cart:build'));
    document.dispatchEvent(new CustomEvent('pack-cart:change', { detail: { cart } }));
  };

  const PackCart = {
    codes,
    isSock,
    sockCount,
    getCart,

    /** Read the cart and put the right code on it. */
    sync(given, options = {}) {
      return enqueue(async () => {
        const outcome = await syncNow(given);
        if (options.announce !== false) announce(outcome.cart, { rebuild: outcome.changed || options.rebuild });
        return outcome;
      });
    },

    /** items: [{ id, quantity }]. Rejects with Shopify's message if it will not add. */
    add(items) {
      return enqueue(async () => {
        await post('cart/add.js', { items });
        const outcome = await syncNow();
        announce(outcome.cart);
        return outcome;
      });
    },

    /** Set a cart line (by its key) to a quantity; 0 removes it. */
    change(key, quantity) {
      return enqueue(async () => {
        const cart = await post('cart/change.js', { id: key, quantity });
        const outcome = await syncNow(cart);
        announce(outcome.cart);
        return outcome;
      });
    },
  };

  window.PackCart = PackCart;

  // Quantity changes in Impulse's drawer and cart page. Impulse has already
  // redrawn; only redraw again if the code had to change.
  document.addEventListener('cart:updated', () => {
    PackCart.sync();
  });
})();
