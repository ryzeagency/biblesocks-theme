/**
 * <sock-bundle>
 *
 * Tiered pack-size selector for the product page.
 *
 *  - "Single" keeps the theme's normal add-to-cart form.
 *  - A multi-pack tier (2 / 3 / 4) reveals N slots and opens the sock picker
 *    that lives in the product media column, so the customer chooses which
 *    socks fill the pack.
 *  - Each multi-pack tier can carry a Shopify discount code, set in the theme
 *    editor. It is applied via /discount/CODE after the items are added.
 */

if (!customElements.get('sock-bundle')) {
  customElements.define(
    'sock-bundle',
    class SockBundle extends HTMLElement {
      constructor() {
        super();

        this.sectionId = this.dataset.sectionId;
        this.picker = document.querySelector(`[data-sock-bundle-picker="${this.sectionId}"]`);
        // Impulse layout: the info column wraps the blocks in .product-single__meta,
        // and product-template.liquid tags the media column for us.
        this.infoContainer = this.closest('.product-single__meta');
        this.mediaContainer = document.querySelector(
          `[data-sock-bundle-media="${this.sectionId}"]`
        );

        this.tierButtons = Array.from(this.querySelectorAll('[data-sock-tier]'));
        // The savings ladder, smallest first. The discount a shopper actually
        // gets is read off this by how many socks are in the pack.
        this.tiers = this.tierButtons
          .map((button) => ({
            qty: parseInt(button.dataset.qty, 10) || 1,
            code: button.dataset.code || '',
            percent: parseFloat(button.dataset.discount) || 0,
            freeShipping: button.dataset.freeShip === 'true',
            // Socks the pack makes free outright, e.g. a 6-pack where 3 go free.
            freeSocks: parseInt(button.dataset.freeSocks, 10) || 0,
          }))
          .sort((a, b) => a.qty - b.qty);

        // A bigger pack with its own code, e.g. 9 socks for BUY6GET3FREE. It is
        // off the ladder: it only sets the code and the pack's price once reached.
        const bigQty = parseInt(this.dataset.bigPackQty, 10) || 0;
        const bigCode = (this.dataset.bigPackCode || '').trim();
        const topTier = this.tiers[this.tiers.length - 1];
        if (bigCode && bigQty > (topTier ? topTier.qty : 1)) {
          this.tiers.push({
            qty: bigQty,
            code: bigCode,
            percent: 0,
            freeShipping: Boolean(topTier?.freeShipping),
            freeSocks: parseInt(this.dataset.bigPackFreeSocks, 10) || 0,
            offLadder: true,
          });
        }
        // The tiers shown to shoppers: the ladder, the bar and the next goal.
        this.ladderTiers = this.tiers.filter((tier) => !tier.offLadder);

        // Rewards past the biggest pack, so the bar never dead-ends. Each can
        // carry a product, which joins the cart once its rung is reached.
        try {
          this.bonusRungs = JSON.parse(
            this.querySelector('[data-sock-bundle-bonus]')?.textContent || '[]'
          )
            .map((rung) => ({ ...rung, bonus: true }))
            .filter((rung) => Number.isFinite(rung.qty) && rung.label)
            .sort((a, b) => a.qty - b.qty);
        } catch (error) {
          this.bonusRungs = [];
        }

        this.rungs = [...this.ladderTiers, ...this.bonusRungs].sort((a, b) => a.qty - b.qty);
        this.slotsWrap = this.querySelector('[data-sock-bundle-slots-wrap]');
        this.slotsEl = this.querySelector('[data-sock-bundle-slots]');
        this.progressEl = this.querySelector('[data-sock-bundle-progress]');
        this.summaryEl = this.querySelector('[data-sock-bundle-summary]');
        this.compareEl = this.querySelector('[data-sock-bundle-compare]');
        this.saveEl = this.querySelector('[data-sock-bundle-save]');
        this.totalEl = this.querySelector('[data-sock-bundle-total]');
        this.atcButton = this.querySelector('[data-sock-bundle-atc]');
        this.errorEl = this.querySelector('[data-sock-bundle-error]');

        this.pickerSlot = this.querySelector('[data-sock-bundle-picker-slot]');
        this.mobileQuery = window.matchMedia('(max-width: 768px)');

        this.rewardsEl = this.querySelector('[data-sock-bundle-rewards]');
        this.freeShippingLabel = this.dataset.freeShippingLabel || 'Free shipping';
        this.rewardIncludedText = this.dataset.rewardIncludedText || 'Included';
        this.freeShippingIcon = this.dataset.freeShippingIcon || '';
        this.showTiles = this.dataset.showTiles !== 'false';

        this.tiersEl = this.querySelector('[data-sock-tiers]');
        this.prevArrow = this.querySelector('[data-sock-tiers-prev]');
        this.nextArrow = this.querySelector('[data-sock-tiers-next]');
        this.progressFill = this.querySelector('[data-sock-bundle-progressfill]');
        this.shipMarker = this.querySelector('[data-sock-bundle-shipmarker]');
        this.shipNote = this.querySelector('[data-sock-bundle-shipnote]');

        this.freeShipping = this.dataset.freeShipping === 'true';
        this.shipThreshold = parseInt(this.dataset.freeShippingThreshold, 10) || 0;
        this.shipBasis = this.dataset.freeShippingBasis || 'discounted';
        this.shipProgressText =
          this.dataset.freeShippingProgressText || '[amount] away from free shipping';
        this.rewardDiscountText = this.dataset.rewardDiscountText || '[percent]% off';
        this.rewardShippingText = this.dataset.rewardShippingText || 'free shipping';
        this.progressIncompleteText =
          this.dataset.progressIncompleteText || 'Add [count] more [socks] to unlock [reward]';
        this.progressCompleteText = this.dataset.progressCompleteText || '[reward] unlocked';
        this.progressStartText =
          this.dataset.progressStartText || 'Add [count] [socks] to save [reward]';
        this.bonusIncompleteText =
          this.dataset.bonusIncompleteText || 'Buy one more and get [reward]';
        this.progressShippingNextText =
          this.dataset.progressShippingNextText || 'Add [count] more [socks] to unlock FREE shipping';
        this.progressShippingUnlockedText =
          this.dataset.progressShippingUnlockedText ||
          "You've unlocked FREE shipping + [percent]% off!";
        this.savingsText = this.dataset.savingsText || 'You save [amount]';
        this.sockWordSingular = this.dataset.sockWordSingular || 'sock';
        this.sockWordPlural = this.dataset.sockWordPlural || 'socks';
        this.rewardFreeSocksText = this.dataset.rewardFreeSocksText || '[count] socks free';
        this.freeSockTag = this.dataset.freeSockTag || 'Free';

        this.discountPercent = 0;
        this.tierFreeShipping = false;

        // "Product first" (snippets/sock-bundle-teaser.liquid): the page opens on
        // this sock and the theme's buy box; this block's button starts a mix &
        // match pack, and a ladder of boxes fills up as pairs go in. The builder
        // layout ignores all of this.
        this.teaser = this.dataset.layout === 'teaser';
        this.packing = false;
        this.lastToastQty = 0;
        this.teaserDiscountText = this.dataset.teaserDiscountText || '[percent]% off';
        this.teaserShippingText = this.dataset.teaserShippingText || 'Free ship';
        this.pickerAddedText = this.dataset.pickerAddedText || 'Added';
        this.quickViewAddText = this.dataset.quickViewAddText || 'Add to my pack';
        this.quickViewUnlockText =
          this.dataset.quickViewUnlockText || 'Adding this unlocks [reward] on your pack';
        this.quickViewDetailsText = this.dataset.quickViewDetailsText || 'View full details';
        this.unlockedToastText = this.dataset.unlockedToastText || '[reward] unlocked!';

        // The photo lightbox, in both layouts.
        this.closeText = this.dataset.closeText || 'Close';
        this.zoomText = this.dataset.zoomText || 'Open featured media in gallery view';
        this.previousText = this.dataset.previousText || 'Previous';
        this.nextText = this.dataset.nextText || 'Next';

        this.pickerReplacesGallery = this.dataset.pickerReplacesGallery === 'true';
        this.prefillCurrent = this.dataset.prefillCurrent === 'true';
        this.singleUsesPicker = this.dataset.singleUsesPicker === 'true';
        // Product first on a build-your-own product: there is no sock of its
        // own to show, so the page opens on the picker and the pack, and stays.
        this.buildOwn = this.teaser && this.singleUsesPicker;
        // Product first: Mix & match opens the picker and the pack as a
        // full-screen popup over the page, instead of in the photos' place.
        this.popup = this.teaser && !this.buildOwn && this.dataset.packPopup === 'true';
        this.popupTitle = this.dataset.popupTitle || 'Mix & match designs';
        this.onPopupKeydown = this.onPopupKeydown.bind(this);
        this.onPopState = this.onPopState.bind(this);
        this.hideDefaultAtc = this.dataset.hideDefaultAtc === 'true';
        this.afterAdd = this.dataset.afterAdd || 'cart';
        this.cartUrl = this.dataset.cartUrl || '/cart';
        this.cartClearUrl = this.dataset.cartClearUrl || '/cart/clear.js';
        this.clearCartOnAdd = this.dataset.clearCart === 'true';
        this.moneyFormat = this.dataset.moneyFormat || '${{amount}}';

        // Product first on a sock page: the pack is the socks in the Shopify
        // cart (assets/pack-cart.js). The buy box's Add to cart, the picker's
        // Add and the pack's × all change the real cart, and the pack is drawn
        // from /cart.js, so the builder and the cart page cannot disagree.
        this.cartMode =
          this.teaser && !this.buildOwn && this.dataset.cartMode === 'true' && Boolean(window.PackCart);
        // After the buy box's Add to cart: stay and show the pack ("next_step"),
        // or let the theme open its cart drawer ("drawer").
        this.afterAtc = this.dataset.afterAtc || 'next_step';
        this.addedText = this.dataset.addedText || 'Added — add [more] and save [reward]';
        this.cart = null;
        this.justAdded = false;
        this.showAdded = false;
        this.onPackCartChange = this.onPackCartChange.bind(this);
        this.onThemeAdded = this.onThemeAdded.bind(this);

        try {
          this.variantData = JSON.parse(
            this.querySelector('[data-sock-bundle-variants]')?.textContent || '[]'
          );
        } catch (error) {
          this.variantData = [];
        }

        this.quantity = 1;
        // The most socks a pack may hold; 0 means no ceiling.
        this.maxSocks = Math.max(0, parseInt(this.dataset.maxSocks, 10) || 0);
        // How many boxes to lay out when the pack is small. Below the ceiling
        // the pack grows a fresh empty box every time one is filled.
        this.minSlots = parseInt(this.dataset.minSlots, 10) || 5;
        if (this.maxSocks) this.minSlots = Math.min(this.minSlots, this.maxSocks);
        this.discountCode = '';
        /** @type {Array<{variantId: string, productId: string, title: string, variantTitle: string, image: string, price: number}|null>} */
        this.slots = [];

        this.onTierClick = this.onTierClick.bind(this);
        this.onPickerClick = this.onPickerClick.bind(this);
        this.onPickerVariantChange = this.onPickerVariantChange.bind(this);
        this.onSlotsClick = this.onSlotsClick.bind(this);
        this.onAddToCart = this.onAddToCart.bind(this);
        this.onVariantChange = this.onVariantChange.bind(this);
        this.updateArrows = this.updateArrows.bind(this);
        this.syncPickerPlacement = this.syncPickerPlacement.bind(this);
      }

      connectedCallback() {
        // Moving into the popup and back is not a fresh start.
        if (this.relocating) return;
        this.tierButtons.forEach((button) => button.addEventListener('click', this.onTierClick));
        this.slotsEl?.addEventListener('click', this.onSlotsClick);
        this.atcButton?.addEventListener('click', this.onAddToCart);
        this.picker?.addEventListener('click', this.onPickerClick);
        this.picker?.addEventListener('change', this.onPickerVariantChange);
        this.picker?.addEventListener('keydown', (event) => {
          const zoom = event.target.closest('[data-picker-zoom]');
          if (!zoom || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          this.openLightbox(zoom.closest('[data-picker-card]'));
        });
        this.syncAllCardPrices();
        this.prepareZoom();

        // Collection filter tabs above the picker, when the block has any.
        this.filtersEl = this.picker?.querySelector('[data-picker-filters]');
        this.filterSelect = this.picker?.querySelector('[data-picker-filter-select]');
        this.activeFilter =
          this.filtersEl?.querySelector('[aria-pressed="true"]')?.dataset.pickerFilter ||
          this.filterSelect?.value ||
          '';
        this.filterCache = {};
        this.filterToken = 0;
        // The sock being viewed leads any tab whose collection holds it.
        this.pinnedProductId =
          this.picker?.querySelector('[data-picker-grid] [data-picker-pinned]')?.dataset.productId || '';
        this.setUpFilterScrolling();
        // A mouse wheel only scrolls up and down; let it move the tabs sideways.
        this.filtersEl?.addEventListener(
          'wheel',
          (event) => {
            const strip = this.filtersEl;
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            if (strip.scrollWidth <= strip.clientWidth) return;
            const atStart = strip.scrollLeft <= 0 && event.deltaY < 0;
            const atEnd =
              strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1 && event.deltaY > 0;
            if (atStart || atEnd) return;
            event.preventDefault();
            strip.scrollLeft += event.deltaY;
          },
          { passive: false }
        );

        // Impulse announces every variant switch with a document-level
        // `variant:change` event, which keeps the pre-filled slot in sync.
        document.addEventListener('variant:change', this.onVariantChange);

        this.prevArrow?.addEventListener('click', () => this.scrollTiers(-1));
        this.nextArrow?.addEventListener('click', () => this.scrollTiers(1));
        this.tiersEl?.addEventListener('scroll', this.updateArrows, { passive: true });
        window.addEventListener('resize', this.updateArrows);
        this.updateArrows();

        this.syncPickerPlacement();
        this.mobileQuery.addEventListener('change', this.syncPickerPlacement);

        // A pack brought back from earlier in the visit opens without a toast.
        this.quietUnlocks = true;
        if (!this.cartMode) this.restoreSlots();

        if (this.teaser) {
          this.setUpTeaser();
          this.quietUnlocks = false;
        } else {
          // Liquid marks one tier checked; run it so the page opens in that state.
          // On a normal product that is Single, which is a no-op.
          const checked =
            this.tierButtons.find((tier) => tier.getAttribute('aria-checked') === 'true') ||
            this.tierButtons[0];
          if (checked) this.selectTier(checked);
        }

        // The server-side open state has done its job; let JS own it from here.
        this.picker?.classList.remove('sock-bundle-picker--open-on-load');

        if (this.cartMode) {
          this.classList.add('sock-bundle--cart-mode');
          document.addEventListener('pack-cart:change', this.onPackCartChange);
          // The buy box's own Add to cart (Impulse) posts its form and announces
          // it with a bubbling `ajaxProduct:added`; it passes through here.
          this.infoContainer?.addEventListener('ajaxProduct:added', this.onThemeAdded);
          this.loadCart();
        }
      }

      disconnectedCallback() {
        if (this.relocating) return;
        this.closePopup({ restore: false });
        document.removeEventListener('variant:change', this.onVariantChange);
        document.removeEventListener('pack-cart:change', this.onPackCartChange);
        this.infoContainer?.removeEventListener('ajaxProduct:added', this.onThemeAdded);
        this.picker?.removeEventListener('change', this.onPickerVariantChange);
        this.tiersEl?.removeEventListener('scroll', this.updateArrows);
        window.removeEventListener('resize', this.updateArrows);
        this.mobileQuery.removeEventListener('change', this.syncPickerPlacement);

        // These live on <body>, so the theme editor re-rendering the section
        // would otherwise leave them behind.
        this.quickView?.remove();
        this.lightbox?.remove();
        this.toastEl?.remove();
        if (this.teaser) document.body.classList.remove('sock-bundle-packing', 'sock-bundle-pack-folded');
      }

      /* ------------------------------------------------------------------ */
      /* Picker placement                                                    */
      /* ------------------------------------------------------------------ */

      /**
       * On desktop the picker sits in the product media column, taking the
       * gallery's place. On mobile that column is stacked way above the packs,
       * so the picker moves inline instead and reads as the next step.
       * Moving the node keeps its listeners, so nothing needs rebinding.
       */
      syncPickerPlacement() {
        if (!this.picker) return;

        // Product first: the picker takes the photos' place at every width,
        // which on mobile puts it at the top of the page.
        if (this.teaser) return;

        if (this.mobileQuery.matches) {
          if (this.pickerSlot && this.picker.parentElement !== this.pickerSlot) {
            this.pickerSlot.appendChild(this.picker);
          }
          // The gallery is no longer being replaced, so let it show.
          this.mediaContainer?.classList.remove('sock-bundle-gallery-hidden');
        } else {
          if (this.mediaContainer && this.picker.parentElement !== this.mediaContainer) {
            this.mediaContainer.appendChild(this.picker);
          }
          if (this.pickerReplacesGallery && this.quantity > 1) {
            this.mediaContainer?.classList.add('sock-bundle-gallery-hidden');
          }
        }
      }

      /* ------------------------------------------------------------------ */
      /* Tier strip scrolling                                                */
      /* ------------------------------------------------------------------ */

      scrollTiers(direction) {
        if (!this.tiersEl) return;
        const card = this.tiersEl.querySelector('.sock-bundle__tier');
        const step = card ? card.getBoundingClientRect().width + 8 : 120;
        this.tiersEl.scrollBy({ left: step * 2 * direction, behavior: 'smooth' });
      }

      updateArrows() {
        if (!this.tiersEl || !this.prevArrow || !this.nextArrow) return;
        const { scrollLeft, scrollWidth, clientWidth } = this.tiersEl;
        const overflows = scrollWidth - clientWidth > 2;
        this.prevArrow.hidden = !overflows || scrollLeft <= 2;
        this.nextArrow.hidden = !overflows || scrollLeft >= scrollWidth - clientWidth - 2;
      }

      /* ------------------------------------------------------------------ */
      /* Tier selection                                                      */
      /* ------------------------------------------------------------------ */

      onTierClick(event) {
        const button = event.currentTarget;
        this.selectTier(button);
      }

      selectTier(button) {
        this.tierButtons.forEach((tier) => {
          tier.setAttribute('aria-checked', String(tier === button));
        });

        this.quantity = parseInt(button.dataset.qty, 10) || 1;
        this.setError('');

        // With the tiles hidden there is nothing to click, so the builder has to
        // open by itself — Single no longer means "buy this product alone".
        if (this.quantity <= 1 && !this.singleUsesPicker && this.showTiles) {
          this.exitBundleMode();
          return;
        }

        this.enterBundleMode();
      }

      enterBundleMode() {
        // Always lay out the full ladder's worth of boxes, whichever pack was
        // clicked. Anything already chosen is kept.
        const kept = this.slots.filter(Boolean);
        const size = this.capSlots(Math.max(kept.length + 1, this.minSlots));
        const next = new Array(size).fill(null);
        kept.forEach((slot, index) => {
          next[index] = slot;
        });
        this.slots = next;

        if (this.prefillCurrent && !this.slots[0]) {
          this.slots[0] = this.currentProductSlot();
        }

        this.slotsWrap.hidden = false;
        this.slotsEl.style.setProperty('--sb-slot-count', String(Math.max(this.minSlots, 2)));

        if (this.hideDefaultAtc) {
          this.infoContainer?.classList.add('sock-bundle-mode');
          document.body.classList.add('sock-bundle-mode');
        }
        this.setMultipackFlag(this.quantity > 1);
        this.picker?.classList.add('is-visible');
        if (this.pickerReplacesGallery && !this.mobileQuery.matches) {
          this.mediaContainer?.classList.add('sock-bundle-gallery-hidden');
        }

        this.render();
      }

      exitBundleMode() {
        this.slotsWrap.hidden = true;
        this.infoContainer?.classList.remove('sock-bundle-mode');
        document.body.classList.remove('sock-bundle-mode');
        this.setMultipackFlag(false);
        this.picker?.classList.remove('is-visible');
        this.mediaContainer?.classList.remove('sock-bundle-gallery-hidden');
        this.refreshGallery();
      }

      /**
       * Impulse's image slider measures itself on load, and gets zero sizes while
       * it is hidden behind the picker. A resize makes it measure again.
       */
      refreshGallery() {
        window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      }

      /** Marks the page while a pack of two or more is being built. */
      setMultipackFlag(on) {
        this.infoContainer?.classList.toggle('sock-bundle-multipack', on);
        document.body.classList.toggle('sock-bundle-multipack', on);
      }

      currentProductSlot() {
        const variant = this.variantData.find(
          (item) => String(item.id) === String(this.dataset.variantId)
        );
        return {
          variantId: this.dataset.variantId,
          productId: this.dataset.productId,
          title: this.dataset.productTitle,
          variantTitle: variant ? variant.title : '',
          image: variant?.image || this.dataset.productImage,
          price: variant ? variant.price : parseInt(this.dataset.productPrice, 10) || 0,
          variants: this.variantData.filter((item) => item.available !== false),
        };
      }

      onVariantChange(event) {
        const newId = event.detail?.variant?.id;
        if (!newId) return;

        // The event is page-wide, so ignore switches on other products (quick shop etc).
        const variant = this.variantData.find((item) => String(item.id) === String(newId));
        if (!variant) return;
        this.dataset.variantId = String(newId);
        this.dataset.productPrice = String(variant.price);
        if (variant.image) this.dataset.productImage = variant.image;

        // Only the pre-filled first slot tracks the main variant picker; in
        // Product first the pack keeps the sizes its pairs went in with.
        if (!this.teaser && this.prefillCurrent && this.slots[0]?.productId === this.dataset.productId) {
          this.slots[0] = {
            ...this.slots[0],
            variantId: String(newId),
            price: variant.price,
            variantTitle: variant.title,
            image: variant.image || this.slots[0].image,
          };
          this.render();
        }

        // The ladder's single pair quotes the size picked in the buy box.
        if (this.teaser) this.render();
      }

      /* ------------------------------------------------------------------ */
      /* Picker                                                              */
      /* ------------------------------------------------------------------ */

      onPickerClick(event) {
        const filterButton = event.target.closest('[data-picker-filter]');
        if (filterButton) {
          this.applyFilter(filterButton.dataset.pickerFilter);
          return;
        }

        const zoom = event.target.closest('[data-picker-zoom]');
        if (zoom) {
          this.openLightbox(zoom.closest('[data-picker-card]'));
          return;
        }

        if (this.teaser) {
          const quickView = event.target.closest('[data-picker-quick-view]');
          if (quickView) {
            this.openQuickView(quickView.closest('[data-picker-card]'));
            return;
          }
        }

        const backButton = event.target.closest('[data-picker-back]');
        if (backButton && this.teaser) {
          // The pack is kept; the ladder's boxes or add to cart bring it back.
          this.exitPacking();
          this.scrollToTop(this.mediaContainer);
          return;
        }
        if (backButton) {
          const hidden = this.mediaContainer?.classList.toggle('sock-bundle-gallery-hidden');
          backButton.textContent = hidden
            ? backButton.dataset.showText || 'Back to product photos'
            : backButton.dataset.hideText || 'Hide product photos';
          if (!hidden) this.refreshGallery();
          return;
        }

        const addButton = event.target.closest('[data-picker-add]');
        if (!addButton) return;

        const card = addButton.closest('[data-picker-card]');
        if (!card) return;

        this.addCard(card);
      }

      /** Puts a picker card's sock, in its chosen size, into the next free slot. */
      addCard(card) {
        const index = this.firstEmptySlot();
        if (index === -1) {
          this.setError('Your pack is full. Remove a sock to swap it out.');
          return false;
        }

        const variantField = card.querySelector('[data-picker-variant]');
        const option =
          variantField && variantField.tagName === 'SELECT'
            ? variantField.options[variantField.selectedIndex]
            : variantField;

        if (!variantField || !variantField.value) return false;

        // Cart mode hands back the add itself, so callers can wait on it.
        if (this.cartMode) return this.addCardToCart(card, option.value);

        this.slots[index] = this.slotFromCard(card, option);

        this.setError('');
        this.render();
        return true;
      }

      /** A slot for one sock, read off its picker card and the chosen option. */
      slotFromCard(card, option) {
        let data = {};
        try {
          data = JSON.parse(card.querySelector('[data-picker-data]')?.textContent || '{}');
        } catch (error) {
          data = {};
        }

        return {
          variantId: option.value,
          productId: card.dataset.productId,
          title: data.title || '',
          variantTitle: (option.dataset.variantTitle || '').replace(/^Default Title$/, ''),
          image: option.dataset.variantImage || data.image || '',
          price: parseInt(option.dataset.variantPrice, 10) || 0,
          variants: this.readCardVariants(card),
        };
      }

      /* ------------------------------------------------------------------ */
      /* Remembering the pack                                                */
      /* ------------------------------------------------------------------ */

      /**
       * The chosen socks are kept for the browsing session, so a trip to the cart
       * and back finds the pack as it was left. Only ids are stored; names and
       * prices are read fresh from the picker, and anything sold out or no longer
       * in the picker is dropped.
       */
      get storageKey() {
        return `sock-bundle:${this.dataset.productId}`;
      }

      saveSlots() {
        try {
          // The whole slot is kept, since with collection tabs a sock may come
          // from a tab whose cards are not on the page when it reloads.
          const picks = this.slots.filter(Boolean);
          window.sessionStorage.setItem(this.storageKey, JSON.stringify(picks));
        } catch (error) {
          // Storage can be unavailable (private mode, blocked site data); the
          // builder still works, it just will not remember the pack.
        }
      }

      restoreSlots() {
        let picks = [];
        try {
          picks = JSON.parse(window.sessionStorage.getItem(this.storageKey) || '[]');
        } catch (error) {
          return;
        }
        if (!Array.isArray(picks) || !this.picker) return;

        const restored = picks
          .map((pick) => {
            const card = this.picker.querySelector(
              `[data-picker-card][data-product-id="${CSS.escape(String(pick.productId))}"]`
            );
            const field = card?.querySelector('[data-picker-variant]');

            // Not in the grid on screen (another tab): use what was saved.
            if (!field) return pick.title && pick.variantId ? pick : null;

            // On screen: read it fresh, and drop it if that size has sold out.
            const option =
              field.tagName === 'SELECT'
                ? Array.from(field.options).find(
                    (item) => item.value === String(pick.variantId) && !item.disabled
                  )
                : field.value === String(pick.variantId) && field;
            return option ? this.slotFromCard(card, option) : null;
          })
          .filter(Boolean);

        this.slots = this.maxSocks ? restored.slice(0, this.maxSocks) : restored;
      }

      /**
       * Show only the socks in one collection. Each collection's grid is fetched
       * once through the Section Rendering API and kept, so tapping back to a
       * tab is instant. Socks already in the pack are untouched.
       */
      async applyFilter(handle) {
        const grid = this.picker?.querySelector('[data-picker-grid]');
        if (!handle || !grid || handle === this.activeFilter) return;

        const previous = this.activeFilter;
        if (previous && !this.filterCache[previous]) this.filterCache[previous] = grid.innerHTML;

        this.setFilterPressed(handle);
        const token = ++this.filterToken;

        let html = this.filterCache[handle];
        if (!html) {
          grid.classList.add('is-loading');
          grid.setAttribute('aria-busy', 'true');
          try {
            const root = window.Shopify?.routes?.root || '/';
            const response = await fetch(
              `${root}collections/${encodeURIComponent(handle)}?section_id=sock-bundle-picker-grid`
            );
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            const fresh = doc.querySelector('[data-picker-grid]');
            if (!fresh) throw new Error('No picker grid in the response');
            html = fresh.innerHTML;
            this.filterCache[handle] = html;
          } catch (error) {
            console.error(error);
            if (token === this.filterToken) {
              grid.classList.remove('is-loading');
              grid.removeAttribute('aria-busy');
              this.setFilterPressed(previous);
              this.setError('Could not load those socks. Please try again.');
            }
            return;
          }
        }

        // A later tap has taken over while this one was loading.
        if (token !== this.filterToken) return;

        this.activeFilter = handle;
        grid.innerHTML = html;
        this.pinViewedSock(grid);
        grid.scrollTop = 0;
        grid.classList.remove('is-loading');
        grid.removeAttribute('aria-busy');
        this.setError('');
        this.syncAllCardPrices();
        this.prepareZoom();
        this.enhanceCards();
        // Re-mark which of these socks are already in the pack.
        if (this.teaser || !this.slotsWrap.hidden) this.render();
      }

      /**
       * The tab strip scrolls sideways. Touch and trackpads do that natively;
       * a desktop mouse gets arrows, click-and-drag and its wheel.
       */
      setUpFilterScrolling() {
        const strip = this.filtersEl;
        if (!strip) return;

        const prev = this.picker.querySelector('[data-picker-filters-prev]');
        const next = this.picker.querySelector('[data-picker-filters-next]');
        const updateArrows = () => {
          const max = strip.scrollWidth - strip.clientWidth;
          if (prev) prev.hidden = max <= 2 || strip.scrollLeft <= 2;
          if (next) next.hidden = max <= 2 || strip.scrollLeft >= max - 2;
        };
        const step = (direction) =>
          strip.scrollBy({ left: direction * strip.clientWidth * 0.7, behavior: 'smooth' });

        prev?.addEventListener('click', () => step(-1));
        next?.addEventListener('click', () => step(1));
        strip.addEventListener('scroll', updateArrows, { passive: true });
        window.addEventListener('resize', updateArrows);
        updateArrows();

        // Click-and-drag with a mouse. A drag never counts as tapping a tab.
        let drag = null;
        strip.addEventListener('pointerdown', (event) => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          drag = { x: event.clientX, left: strip.scrollLeft, moved: false };
        });
        strip.addEventListener('pointermove', (event) => {
          if (!drag) return;
          const dx = event.clientX - drag.x;
          if (!drag.moved && Math.abs(dx) < 5) return;
          if (!drag.moved) {
            drag.moved = true;
            strip.setPointerCapture?.(event.pointerId);
            strip.classList.add('is-dragging');
          }
          strip.scrollLeft = drag.left - dx;
        });
        const endDrag = () => {
          if (!drag) return;
          const moved = drag.moved;
          drag = null;
          strip.classList.remove('is-dragging');
          if (moved) {
            strip.addEventListener(
              'click',
              (event) => {
                event.stopPropagation();
                event.preventDefault();
              },
              { capture: true, once: true }
            );
          }
        };
        strip.addEventListener('pointerup', endDrag);
        strip.addEventListener('pointercancel', endDrag);
        strip.addEventListener('dragstart', (event) => event.preventDefault());
      }

      /**
       * Move the viewed sock to the front of a tab, when that collection has it.
       * A tab only ever shows its own collection, so it is never added in.
       */
      pinViewedSock(grid) {
        if (!this.pinnedProductId) return;
        const card = grid.querySelector(
          `[data-picker-card][data-product-id="${this.pinnedProductId}"]`
        );
        if (card && card !== grid.firstElementChild) grid.prepend(card);
      }

      /** Mark the active filter, on the pills or in the dropdown. */
      setFilterPressed(handle) {
        if (this.filterSelect && this.filterSelect.value !== handle) this.filterSelect.value = handle;
        if (!this.filtersEl) return;
        this.filtersEl.querySelectorAll('[data-picker-filter]').forEach((tab) => {
          const on = tab.dataset.pickerFilter === handle;
          tab.setAttribute('aria-pressed', String(on));
          if (on) this.scrollFilterIntoView(tab);
        });
      }

      /** Keep the chosen tab in view in its strip, without scrolling the page. */
      scrollFilterIntoView(tab) {
        const strip = this.filtersEl;
        const left = tab.offsetLeft - strip.offsetLeft;
        const right = left + tab.offsetWidth;
        if (left < strip.scrollLeft) {
          strip.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
        } else if (right > strip.scrollLeft + strip.clientWidth) {
          strip.scrollTo({ left: right - strip.clientWidth + 16, behavior: 'smooth' });
        }
      }

      firstEmptySlot() {
        const index = this.slots.findIndex((slot) => !slot);
        if (index !== -1) return index;
        if (this.isFull()) return -1;
        // Below the ceiling: grow a new box rather than refusing.
        this.slots.push(null);
        return this.slots.length - 1;
      }

      /** Keep a trailing empty box, and never shrink below the display floor. */
      growSlots() {
        const filled = this.slots.filter(Boolean).length;
        const want = this.capSlots(Math.max(filled + 1, this.minSlots));
        // Compact so filled socks stay first, then pad back out.
        const kept = this.slots.filter(Boolean);
        this.slots = new Array(want).fill(null);
        kept.forEach((slot, index) => {
          this.slots[index] = slot;
        });
      }

      /** Never lay out more boxes than the pack may hold. */
      capSlots(count) {
        return this.maxSocks ? Math.min(count, this.maxSocks) : count;
      }

      isFull() {
        return Boolean(this.maxSocks) && this.slots.filter(Boolean).length >= this.maxSocks;
      }

      /**
       * Which slots the pack makes free: the cheapest ones, as Shopify's Buy X
       * get Y discount picks them. On a tie the later pick goes free.
       */
      freeSlotIndexes(count) {
        if (!count) return new Set();
        return new Set(
          this.slots
            .map((slot, index) => ({ slot, index }))
            .filter(({ slot }) => slot)
            .sort((a, b) => (a.slot.price || 0) - (b.slot.price || 0) || b.index - a.index)
            .slice(0, count)
            .map(({ index }) => index)
        );
      }

      /** The picker card's options, so the slot can offer the same sizes. */
      readCardVariants(card) {
        const field = card.querySelector('[data-picker-variant]');
        if (!field || field.tagName !== 'SELECT') return [];
        return Array.from(field.options)
          .filter((option) => !option.disabled)
          .map((option) => ({
            id: option.value,
            title: option.dataset.variantTitle || option.textContent.trim(),
            price: parseInt(option.dataset.variantPrice, 10) || 0,
            image: option.dataset.variantImage || '',
          }));
      }

      /* ------------------------------------------------------------------ */
      /* Slots                                                               */
      /* ------------------------------------------------------------------ */

      onSlotsClick(event) {
        const remove = event.target.closest('[data-slot-remove]');
        if (!remove) return;

        const index = parseInt(remove.dataset.slotRemove, 10);
        this.slots[index] = null;
        this.setError('');
        this.render();
      }

      render() {
        this.growSlots();
        if (!this.cartMode) this.saveSlots();
        const filled = this.slots.filter(Boolean).length;

        // What the pack has actually earned, and what one more sock would earn.
        this.earnedTier = this.tierFor(filled);
        // The next thing worth reaching, discount or bonus, whichever comes first.
        this.nextRung =
          this.rungs.find(
            (rung) =>
              rung.qty > filled &&
              (!this.maxSocks || rung.qty <= this.maxSocks) &&
              (rung.bonus || rung.percent > 0 || rung.freeSocks > 0)
          ) || null;
        this.discountCode = this.earnedTier ? this.earnedTier.code : '';
        this.tierFreeShipping = this.earnedTier ? this.earnedTier.freeShipping : false;
        const freeSlots = this.freeSlotIndexes(this.earnedTier ? this.earnedTier.freeSocks : 0);

        const slotMarkup = (slot, index) => {
          if (!slot) {
            return `
              <div class="sock-bundle__slot" role="listitem">
                <span class="sock-bundle__slot-media"><span class="sock-bundle__slot-plus">+</span></span>
                <span class="sock-bundle__slot-title">${this.escape(`Sock ${index + 1}`)}</span>
              </div>`;
          }

          const free = freeSlots.has(index);
          return `
            <div class="sock-bundle__slot sock-bundle__slot--filled${
              free ? ' sock-bundle__slot--free' : ''
            }" role="listitem">
              <button type="button" class="sock-bundle__slot-remove" data-slot-remove="${index}" aria-label="Remove ${this.escape(
            slot.title
          )}">&times;</button>
              <span class="sock-bundle__slot-media">
                ${slot.image ? `<img src="${slot.image}" alt="" loading="lazy">` : ''}
                ${free ? `<span class="sock-bundle__slot-free">${this.escape(this.freeSockTag)}</span>` : ''}
              </span>
              <span class="sock-bundle__slot-title">${this.escape(slot.title)}</span>
              ${this.slotVariantMarkup(slot)}
            </div>`;
        };

        const rewardMarkup = (reward) => `
          <div class="sock-bundle__slot sock-bundle__slot--reward" role="listitem">
            <span class="sock-bundle__slot-media">
              ${
                reward.image
                  ? `<img src="${reward.image}" alt=""${
                      reward.icon ? ' class="sock-bundle__slot-icon"' : ''
                    } loading="lazy">`
                  : '<span class="sock-bundle__slot-gift" aria-hidden="true">&#10003;</span>'
              }
            </span>
            <span class="sock-bundle__slot-title">${this.escape(reward.label)}</span>
            <span class="sock-bundle__slot-variant">${this.escape(this.rewardIncludedText)}</span>
          </div>`;

        // Socks first, then the rewards they earned, then the boxes still to fill.
        if (this.slotsEl) {
          this.slotsEl.innerHTML = [
            ...this.slots.map((slot, index) => (slot ? slotMarkup(slot, index) : '')),
            ...this.claimedRewards(filled).map(rewardMarkup),
            ...this.slots.map((slot, index) => (slot ? '' : slotMarkup(slot, index))),
          ].join('');
        }

        if (this.progressEl) {
          this.progressEl.textContent = this.selectedCountText(filled);
        }

        if (this.picker) {
          const progress = this.picker.querySelector('[data-picker-progress]');
          if (progress) progress.textContent = this.selectedCountText(filled);

          const full = this.isFull();
          const counts = {};
          this.slots.filter(Boolean).forEach((slot) => {
            counts[slot.productId] = (counts[slot.productId] || 0) + 1;
          });

          this.picker.querySelectorAll('[data-picker-card]').forEach((card) => {
            const count = counts[card.dataset.productId] || 0;
            card.dataset.picked = String(count);
            const badge = card.querySelector('[data-picker-count]');
            if (badge) badge.textContent = String(count);

            // Sold-out socks stay unavailable, and everything greys out once
            // the pack holds as many socks as it may.
            const add = card.querySelector('[data-picker-add]');
            // One still on its way to the cart stays locked until it lands.
            if (add) add.disabled = add.dataset.soldout === 'true' || full || add.classList.contains('is-loading');

            // Product first: the button itself says how many are in the pack.
            if (add && this.teaser && add.dataset.soldout !== 'true') {
              add.dataset.label = add.dataset.label || add.textContent.trim();
              add.textContent = count ? `${this.pickerAddedText} ×${count}` : add.dataset.label;
              add.classList.toggle('is-added', count > 0);
            }
          });
        }

        let subtotal = this.slots
          .filter(Boolean)
          .reduce((sum, slot) => sum + (slot.price || 0), 0);
        const freeValue = Array.from(freeSlots).reduce(
          (sum, index) => sum + (this.slots[index].price || 0),
          0
        );
        const percent = this.earnedTier ? this.earnedTier.percent : 0;
        let payable = Math.round((subtotal - freeValue) * (1 - percent / 100));

        // Cart mode quotes the cart itself: Shopify's totals, after the code it
        // actually applied, exactly as the cart page shows them. Free shipping
        // goes by that same total, never by a promise on the ladder.
        if (this.cartMode && this.cart) {
          subtotal = this.cart.original_total_price;
          payable = this.cart.total_price;
          this.tierFreeShipping =
            this.freeShipping && this.shipThreshold > 0 && payable >= this.shipThreshold;
        }
        // Free socks are expressed as the share of the pack they knock off, so
        // [percent] and the per-sock estimates still read sensibly.
        this.discountPercent = subtotal ? Math.round((1 - payable / subtotal) * 100) : percent;

        if (this.summaryEl && this.totalEl) {
          this.summaryEl.hidden = filled === 0;
          this.totalEl.textContent = this.formatMoney(payable);

          const saved = subtotal - payable;
          if (this.compareEl) {
            this.compareEl.hidden = saved <= 0;
            this.compareEl.textContent = this.formatMoney(subtotal);
          }
          if (this.saveEl) {
            this.saveEl.hidden = saved <= 0;
            this.saveEl.textContent = this.savingsText
              .replace('[amount]', this.formatMoney(saved))
              .replace('[percent]', this.discountPercent);
          }
        }

        this.highlightEarnedTier(filled);
        this.renderRewards(filled);
        this.renderProgress(filled, this.shipBasis === 'full' ? subtotal : payable);

        this.atcButton.disabled = this.cartMode ? !this.cart?.item_count : filled < 1;

        if (this.teaser) {
          this.renderTeaser(filled, freeSlots);
          this.announceUnlock();
        }
      }

      /**
       * Move the selected card to the pack size actually in the slots, so the
       * card, the discount and the note all say the same thing. With nothing
       * picked yet there is nothing to move to, so the card stays put.
       */
      highlightEarnedTier(filled) {
        if (filled < 1 || !this.earnedTier) return;

        let selected = null;
        this.tierButtons.forEach((button) => {
          const qty = parseInt(button.dataset.qty, 10) || 1;
          const isEarned = qty === this.earnedTier.qty;
          button.setAttribute('aria-checked', String(isEarned));
          if (isEarned) selected = button;
        });

        // Only chase it when the rung actually changes, so the strip is not
        // yanked around on every re-render.
        if (selected && this.lastEarnedQty !== this.earnedTier.qty) {
          this.lastEarnedQty = this.earnedTier.qty;
          this.scrollTierIntoView(selected);
        }
      }

      scrollTierIntoView(button) {
        const strip = this.tiersEl;
        if (!strip) return;

        const left = button.offsetLeft;
        const right = left + button.offsetWidth;
        const pad = 12;

        if (left < strip.scrollLeft) {
          strip.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' });
        } else if (right > strip.scrollLeft + strip.clientWidth) {
          strip.scrollTo({ left: right - strip.clientWidth + pad, behavior: 'smooth' });
        }
      }

      /**
       * Free shipping and every bonus, always all listed, ticked as they are
       * earned. Rendering the full list every time keeps its height fixed, so
       * claiming a reward never nudges the builder above it.
       */
      renderRewards(filled) {
        if (!this.rewardsEl) return;

        const milestones = this.rewardMilestones();

        if (!milestones.length) {
          this.rewardsEl.hidden = true;
          return;
        }

        this.rewardsEl.hidden = false;
        this.rewardsEl.innerHTML = milestones
          .map((milestone) => {
            const claimed = filled >= milestone.qty;
            return `
              <li class="sock-bundle__reward${claimed ? ' is-claimed' : ''}">
                <span class="sock-bundle__reward-mark" aria-hidden="true">${
                  claimed ? '&#10003;' : ''
                }</span>
                <span class="sock-bundle__reward-label">${this.escape(milestone.label)}</span>
                <span class="sock-bundle__reward-at">${milestone.qty}</span>
              </li>`;
          })
          .join('');
      }

      /**
       * Every reward on the ladder that the pack can reach: free shipping once,
       * at the first pack that gives it, then free socks and bonuses.
       */
      rewardMilestones() {
        const shipping = this.tiers.find((tier) => tier.freeShipping);
        return [
          ...(shipping
            ? [
                {
                  qty: shipping.qty,
                  label: this.freeShippingLabel,
                  image: this.freeShippingIcon,
                  icon: true,
                },
              ]
            : []),
          ...this.ladderTiers
            .filter((tier) => tier.freeSocks > 0)
            .map((tier) => ({ qty: tier.qty, label: this.freeSocksText(tier), inSlots: true })),
          ...this.bonusRungs.map((rung) => ({
            qty: rung.qty,
            label: rung.label,
            image: rung.image || '',
          })),
        ]
          .filter((milestone) => !this.maxSocks || milestone.qty <= this.maxSocks)
          .sort((a, b) => a.qty - b.qty);
      }

      /**
       * Free shipping and any bonus the pack has already earned. Free socks are
       * tagged on the socks themselves, so they get no box of their own.
       */
      claimedRewards(filled) {
        return this.rewardMilestones().filter(
          (reward) => filled >= reward.qty && !reward.inSlots
        );
      }

      freeSocksText(tier) {
        return this.rewardFreeSocksText.replace('[count]', tier.freeSocks);
      }

      selectedCountText(filled) {
        const word = filled === 1 ? this.sockWordSingular : this.sockWordPlural;
        return this.cartMode ? `${filled} ${word} in your cart` : `${filled} ${word} selected`;
      }

      /** The best tier this many socks qualifies for. */
      tierFor(count) {
        let earned = null;
        this.tiers.forEach((tier) => {
          if (tier.qty <= count) earned = tier;
        });
        return earned;
      }

      /**
       * "20%" or "20% + free shipping", from a tier on the ladder. Pass
       * skipShipping when the pack already ships free, so it is not re-promised.
       */
      rewardFor(tier, skipShipping = false) {
        if (!tier) return '';
        if (tier.bonus) return tier.label;
        const parts = [];
        if (tier.freeSocks > 0) parts.push(this.freeSocksText(tier));
        if (tier.percent > 0) parts.push(this.rewardDiscountText.replace('[percent]', tier.percent));
        if (tier.freeShipping && !skipShipping) parts.push(this.rewardShippingText);
        return parts.join(' + ');
      }

      /* ------------------------------------------------------------------ */
      /* Progress bar                                                        */
      /* ------------------------------------------------------------------ */

      /**
       * The bar tracks slots filled, so a 1-of-2 pack reads 50%.
       * When free shipping is on, a marker sits at the point in the pack where
       * the running total crosses the threshold, and the note below counts down
       * to it in money.
       */
      renderProgress(filled, towardsShipping) {
        if (!this.progressFill && !this.shipNote) return;

        // The bar measures toward the next reward, not toward a pack size, so it
        // refills every time a rung is passed and never dead-ends. Product first
        // fills toward the top of its ladder instead, where free shipping waits.
        const goal = this.teaser ? this.teaserGoal() : null;
        if (this.progressFill) {
          let percent = this.nextRung ? Math.min(100, (filled / this.nextRung.qty) * 100) : 100;
          if (goal) percent = Math.min(100, (filled / goal.qty) * 100);
          this.progressFill.style.width = `${percent}%`;
          this.progressFill.classList.toggle(
            'is-complete',
            goal ? filled >= goal.qty : !this.nextRung && filled > 0
          );
        }

        const perSock = filled ? towardsShipping / filled : this.estimatedSockPrice();
        const shippingOn = this.freeShipping && this.shipThreshold > 0;
        const packWillShip =
          this.tierFreeShipping ||
          (shippingOn && perSock > 0 && towardsShipping >= this.shipThreshold);

        this.renderShipMarker(filled, towardsShipping, perSock, packWillShip);

        if (!this.shipNote) return;

        let message;
        let shippingUnlocked = false;
        if (this.nextRung) {
          // Point at the next rung: "Buy one more, save 15%" or "...get a gift box".
          const more = this.nextRung.qty - filled;
          // Cart mode only speaks of free shipping by the cart's total.
          const reward = this.rewardFor(this.nextRung, this.cartMode || this.tierFreeShipping);
          let template;
          if (filled === 0) {
            template = this.progressStartText;
          } else if (this.nextRung.bonus || this.nextRung.freeSocks > 0) {
            template = this.bonusIncompleteText;
          } else if (this.nextRung.freeShipping && !this.tierFreeShipping && !this.cartMode) {
            // The next pack is the one that ships free: lead with that.
            template = this.progressShippingNextText;
          } else {
            template = this.progressIncompleteText;
          }
          message = template
            .replace('[count]', more)
            .replace('[socks]', more === 1 ? this.sockWordSingular : this.sockWordPlural)
            .replace('[reward]', reward);
        } else if (
          this.cartMode
            ? this.tierFreeShipping && this.earnedTier
            : this.earnedTier?.freeShipping && this.earnedTier.percent > 0
        ) {
          shippingUnlocked = true;
          const unlocked = this.cartMode
            ? [this.rewardFor(this.earnedTier, true), this.rewardShippingText].filter(Boolean).join(' + ')
            : this.rewardFor(this.earnedTier);
          message = this.progressShippingUnlockedText
            .replace('[percent]', this.earnedTier.percent)
            .replace('[reward]', unlocked);
        } else {
          // Top of the ladder: say what the pack has earned.
          const reward = this.rewardFor(this.earnedTier, this.cartMode);
          message = reward ? this.progressCompleteText.replace('[reward]', reward) : '';
        }

        // Earned the discount but the order still misses free shipping on value.
        if (
          !this.nextRung &&
          shippingOn &&
          !this.tierFreeShipping &&
          towardsShipping < this.shipThreshold
        ) {
          const gap = this.shipProgressText.replace(
            '[amount]',
            this.formatMoney(this.shipThreshold - towardsShipping)
          );
          message = message ? `${message} — ${gap}` : gap;
        }

        // Right after a sock goes in the cart, the pack says so and points at the
        // next saving: "Added — add one more and save 10%".
        if (this.cartMode && this.showAdded && filled > 0) {
          if (this.nextRung) {
            const more = this.nextRung.qty - filled;
            message = this.addedText
              .replace('[more]', more === 1 ? 'one more' : `${more} more`)
              .replace('[count]', more)
              .replace('[reward]', this.rewardFor(this.nextRung, true));
          } else if (message) {
            message = `${this.pickerAddedText} — ${message}`;
          }
        }

        if (this.teaser) this.shipNote.hidden = !message;

        const changed = this.shipNote.textContent !== message;
        this.shipNote.textContent = message;
        this.shipNote.classList.toggle(
          'sock-bundle__progress-note--unlocked',
          !this.nextRung &&
            Boolean(this.earnedTier) &&
            (this.earnedTier.percent > 0 || this.earnedTier.freeSocks > 0)
        );
        this.shipNote.classList.toggle('sock-bundle__progress-note--shipping', shippingUnlocked);
        if (changed) this.pulseNote();
      }

      /** Stand-in price used before the shopper has picked anything. */
      estimatedSockPrice() {
        const base = parseInt(this.dataset.productPrice, 10) || 0;
        return this.shipBasis === 'full'
          ? base
          : Math.round(base * (1 - this.discountPercent / 100));
      }

      renderShipMarker(filled, towardsShipping, perSock, packWillShip) {
        if (!this.shipMarker) return;

        this.shipMarker.hidden = !packWillShip;
        if (!packWillShip) return;

        if (this.tierFreeShipping) {
          this.shipMarker.style.left = '100%';
          this.shipMarker.classList.toggle(
            'sock-bundle__progress-marker--reached',
            towardsShipping >= this.shipThreshold
          );
          return;
        }

        const socksNeeded = Math.ceil(this.shipThreshold / perSock);
        // Same scale as the bar: the ladder's top in Product first, else the next rung.
        const goal = this.teaser ? this.teaserGoal() : null;
        const denom = goal ? goal.qty : this.nextRung ? this.nextRung.qty : Math.max(socksNeeded, 1);
        this.shipMarker.style.left = `${Math.min(100, (socksNeeded / denom) * 100)}%`;
        this.shipMarker.classList.toggle(
          'sock-bundle__progress-marker--reached',
          towardsShipping >= this.shipThreshold
        );
      }

      /** Brief nudge so a changed reward message is noticed. */
      pulseNote() {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        this.shipNote.classList.remove('sock-bundle__progress-note--pulse');
        void this.shipNote.offsetWidth;
        this.shipNote.classList.add('sock-bundle__progress-note--pulse');
      }

      /**
       * A slot with several sizes gets its own dropdown, since the theme's size
       * picker is hidden while a pack is being built. One size shows as text.
       */
      slotVariantMarkup(slot) {
        // The size is picked on the catalogue card, so the slot only reports it.
        return slot.variantTitle
          ? `<span class="sock-bundle__slot-variant">${this.escape(slot.variantTitle)}</span>`
          : '';
      }

      /**
       * Liquid can only print one price per card, and `product.price` is the
       * cheapest variant, so a card showing "Men" could quote the Ankle price.
       * The displayed price follows the card's dropdown instead.
       */
      onPickerVariantChange(event) {
        if (event.target.matches?.('[data-picker-filter-select]')) {
          this.applyFilter(event.target.value);
          return;
        }

        const field = event.target.closest('[data-picker-variant]');
        if (!field) return;
        this.syncCardPrice(field.closest('[data-picker-card]'));
      }

      syncAllCardPrices() {
        this.picker
          ?.querySelectorAll('[data-picker-card]')
          .forEach((card) => this.syncCardPrice(card));
      }

      syncCardPrice(card) {
        if (!card) return;

        const priceEl = card.querySelector('[data-picker-price]');
        const field = card.querySelector('[data-picker-variant]');
        if (!priceEl || !field) return;

        const source =
          field.tagName === 'SELECT' ? field.options[field.selectedIndex] : field;
        const price = parseInt(source?.dataset.variantPrice, 10);
        if (!Number.isFinite(price)) return;

        priceEl.textContent = this.formatMoney(price);
      }

      /* ------------------------------------------------------------------ */
      /* Product first                                                       */
      /* ------------------------------------------------------------------ */

      setUpTeaser() {
        this.teaserSlotsEl = this.querySelector('[data-sock-teaser-slots]');
        this.teaserNoteEl = this.querySelector('[data-sock-teaser-note]');
        this.teaserCountEl = this.querySelector('[data-sock-teaser-count]');
        this.teaserEl = this.querySelector('[data-sock-teaser]');
        this.teaserToggle = this.querySelector('[data-sock-teaser-toggle]');
        // The bar's end reads "Free shipping" only when the top pack ships free.
        const goalEl = this.querySelector('[data-sock-teaser-goal]');
        if (goalEl) goalEl.hidden = !this.teaserGoal()?.freeShipping;

        this.teaserToggle?.addEventListener('click', () =>
          this.foldPack(this.teaserToggle.getAttribute('aria-expanded') === 'true')
        );
        this.teaserSlotsEl?.addEventListener('click', (event) => this.onTeaserSlotsClick(event));
        this.querySelector('[data-sock-teaser-open]')?.addEventListener('click', () => this.enterPacking());
        this.picker?.addEventListener('keydown', (event) => {
          const quickView = event.target.closest('[data-picker-quick-view]');
          if (!quickView || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          this.openQuickView(quickView.closest('[data-picker-card]'));
        });

        this.enhanceCards();

        if (this.buildOwn) {
          // The product itself costs nothing, so the ladder quotes a pair's price.
          this.dataset.productPrice = String(this.firstSockPrice());
          this.enterPacking(false);
        } else {
          this.render();
        }
      }

      /* ------------------------------------------------------------------ */
      /* Cart mode: the pack is the cart                                     */
      /* ------------------------------------------------------------------ */

      /** First paint from /cart.js; a pack brought back opens without a toast. */
      async loadCart() {
        this.quietUnlocks = true;
        try {
          await window.PackCart.sync();
        } catch (error) {
          console.error(error);
        }
        this.quietUnlocks = false;
      }

      /** Anything changed the cart (here, the drawer, the cart page): repaint from it. */
      onPackCartChange(event) {
        const cart = event.detail?.cart;
        if (cart) this.applyCart(cart);
      }

      /**
       * The buy box's Add to cart went through. Shopify already has the sock;
       * put the right code on the cart, redraw the header count and drawer, and
       * show the pack as the next step instead of the drawer (unless set to it).
       */
      onThemeAdded(event) {
        if (this.afterAtc !== 'drawer') event.stopPropagation();
        this.justAdded = true;
        window.PackCart.sync(undefined, { rebuild: true }).catch((error) => console.error(error));
      }

      /** One slot per pair in the cart, socks only, in cart order. */
      applyCart(cart) {
        this.cart = cart;
        const slots = [];
        (cart.items || [])
          .filter((item) => window.PackCart.isSock(item))
          .forEach((item) => {
            const slot = {
              key: item.key,
              variantId: String(item.variant_id),
              productId: String(item.product_id),
              title: item.product_title,
              variantTitle: item.product_has_only_default_variant ? '' : item.variant_title || '',
              image: item.image ? this.sizedImage(item.image, 300) : '',
              price: item.original_price,
              variants: [],
            };
            for (let i = 0; i < item.quantity; i += 1) slots.push(slot);
          });
        this.slots = slots;
        this.showAdded = this.justAdded;
        this.justAdded = false;
        this.render();
      }

      /** The picker's Add: straight into the Shopify cart. */
      async addCardToCart(card, variantId) {
        const button = card.querySelector('[data-picker-add]');
        if (button) {
          button.disabled = true;
          button.classList.add('is-loading');
        }
        this.setError('');
        this.justAdded = true;
        try {
          await window.PackCart.add([{ id: Number(variantId), quantity: 1 }]);
          return true;
        } catch (error) {
          this.justAdded = false;
          this.setError(error.message || 'Could not add to cart.');
          return false;
        } finally {
          if (button) {
            button.classList.remove('is-loading');
            button.disabled = button.dataset.soldout === 'true';
          }
        }
      }

      /** The pack's ×: one pair of that line comes out of the cart. */
      async removeFromCart(index) {
        const slot = this.slots[index];
        if (!slot?.key) return;
        const left = this.slots.filter((item) => item && item.key === slot.key).length - 1;
        this.setError('');
        this.teaserSlotsEl?.classList.add('is-busy');
        try {
          await window.PackCart.change(slot.key, Math.max(0, left));
        } catch (error) {
          this.setError(error.message || 'Could not update your cart.');
        } finally {
          this.teaserSlotsEl?.classList.remove('is-busy');
        }
        // The popup stays open on an empty pack; the photos' place does not.
        if (!this.slots.some(Boolean) && this.packing && !this.popup) this.exitPacking();
      }

      /** Checkout: the cart already holds the pack; make sure its code is on, then go. */
      async checkoutFromCart() {
        this.atcButton.disabled = true;
        this.atcButton.classList.add('btn--loading');
        this.setError('');
        try {
          const { cart, wanted, failed } = await window.PackCart.sync();
          if (!cart.item_count) {
            this.setError('Your cart is empty.');
            return;
          }
          const root = (window.theme?.routes?.home || '/').replace(/\/?$/, '/');
          // Shopify would not take the code over Ajax just now: hand it to
          // checkout through /discount/CODE, which always works.
          window.location.href =
            failed && wanted
              ? `${root}discount/${encodeURIComponent(wanted)}?redirect=${encodeURIComponent('/checkout')}`
              : `${root}checkout`;
        } catch (error) {
          console.error(error);
          this.setError('Something went wrong. Please try again.');
        } finally {
          this.atcButton.classList.remove('btn--loading');
          this.atcButton.disabled = false;
        }
      }

      /** A pair's price, from the first sock in the picker that has one. */
      firstSockPrice() {
        const fields = this.picker?.querySelectorAll('[data-picker-variant]') || [];
        for (const field of fields) {
          const source = field.tagName === 'SELECT' ? field.options[field.selectedIndex] : field;
          const price = parseInt(source?.dataset.variantPrice, 10);
          if (price > 0) return price;
        }
        return 0;
      }

      currentVariant() {
        return this.variantData.find((item) => String(item.id) === String(this.dataset.variantId));
      }

      /** Swap the photos for the picker; the ladder becomes the pack. */
      enterPacking(scroll = true) {
        const opening = !this.packing;
        this.packing = true;
        document.body.classList.add('sock-bundle-packing');
        this.picker?.classList.add('is-visible');
        if (this.popup) {
          if (opening) this.openPopup();
        } else {
          this.mediaContainer?.classList.add(
            'sock-bundle-gallery-hidden',
            'sock-bundle-gallery-hidden-mobile'
          );
        }
        this.render();
        // On a phone the docked pack opens folded, leaving the picker the screen.
        if (opening && this.mobileQuery.matches) this.foldPack(true);
        if (opening && scroll && !this.popup) this.scrollToTop(this.picker);
      }

      /** On a phone, folds the docked pack down to its bar, subtotal and checkout. */
      foldPack(folded) {
        this.teaserEl?.classList.toggle('is-folded', folded);
        document.body.classList.toggle('sock-bundle-pack-folded', folded);
        this.teaserToggle?.setAttribute('aria-expanded', String(!folded));
      }

      exitPacking({ fromHistory = false } = {}) {
        if (this.popup) this.closePopup({ fromHistory });
        this.packing = false;
        // Next time the pack docks, it opens in full.
        this.foldPack(false);
        document.body.classList.remove('sock-bundle-packing');
        this.picker?.classList.remove('is-visible');
        this.mediaContainer?.classList.remove(
          'sock-bundle-gallery-hidden',
          'sock-bundle-gallery-hidden-mobile'
        );
        this.render();
      }

      /* ------------------------------------------------------------------ */
      /* Popup                                                               */
      /* ------------------------------------------------------------------ */

      /** The full-screen popup: a bar with the title and ×, the picker, the pack. */
      buildPopup() {
        if (this.popupEl) return this.popupEl;
        const popup = document.createElement('div');
        popup.className = `sock-bundle-popup ${this.schemeClass()}`.trim();
        popup.setAttribute('role', 'dialog');
        popup.setAttribute('aria-modal', 'true');
        popup.setAttribute('aria-label', this.popupTitle);
        popup.hidden = true;
        popup.innerHTML = `
          <div class="sock-bundle-popup__bar">
            <span class="sock-bundle-popup__title">${this.escape(this.popupTitle)}</span>
            <button type="button" class="sock-bundle-popup__close" data-popup-close aria-label="${this.escape(
              this.closeText
            )}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="sock-bundle-popup__body">
            <div class="sock-bundle-popup__picker" data-popup-picker></div>
            <div class="sock-bundle-popup__pack" data-popup-pack></div>
          </div>`;
        popup.querySelector('[data-popup-close]').addEventListener('click', () => this.exitPacking());
        document.body.appendChild(popup);
        this.popupEl = popup;
        return popup;
      }

      /** Move the picker and this pack into the popup, leaving markers to come back to. */
      openPopup() {
        const popup = this.buildPopup();
        if (!popup.hidden) return;
        this.popupOpener = document.activeElement;

        if (this.picker) {
          this.pickerHome = document.createComment('sock-bundle-picker');
          this.picker.before(this.pickerHome);
          popup.querySelector('[data-popup-picker]').appendChild(this.picker);
        }
        this.packHome = document.createComment('sock-bundle');
        this.before(this.packHome);
        this.relocating = true;
        popup.querySelector('[data-popup-pack]').appendChild(this);
        this.relocating = false;

        popup.hidden = false;
        popup.querySelector('[data-popup-picker]').scrollTop = 0;
        document.documentElement.classList.add('sock-bundle-popup-open');
        document.addEventListener('keydown', this.onPopupKeydown);

        // The phone's back button closes the popup rather than leaving the page.
        try {
          window.history.pushState({ sockBundlePopup: true }, '');
          this.popupState = true;
          window.addEventListener('popstate', this.onPopState);
        } catch (error) {
          this.popupState = false;
        }

        popup.querySelector('[data-popup-close]').focus({ preventScroll: true });
      }

      /** Put everything back where it came from. */
      closePopup({ fromHistory = false, restore = true } = {}) {
        const popup = this.popupEl;
        if (!popup || popup.hidden) return;
        popup.hidden = true;
        document.documentElement.classList.remove('sock-bundle-popup-open');
        document.removeEventListener('keydown', this.onPopupKeydown);
        window.removeEventListener('popstate', this.onPopState);

        if (restore) {
          if (this.picker && this.pickerHome?.parentNode) this.pickerHome.replaceWith(this.picker);
          if (this.packHome?.parentNode) {
            this.relocating = true;
            this.packHome.replaceWith(this);
            this.relocating = false;
          }
        }
        this.pickerHome = null;
        this.packHome = null;

        if (this.popupState && !fromHistory) window.history.back();
        this.popupState = false;

        if (restore && this.popupOpener?.isConnected) this.popupOpener.focus({ preventScroll: true });
      }

      onPopState() {
        if (this.popupEl && !this.popupEl.hidden) {
          this.popupState = false;
          this.exitPacking({ fromHistory: true });
        }
      }

      onPopupKeydown(event) {
        // The quick view and the photo lightbox sit above the popup and close first.
        if (this.quickView && !this.quickView.hidden) return;
        if (this.lightbox && !this.lightbox.hidden) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          this.exitPacking();
        } else if (event.key === 'Tab') {
          this.trapFocus(event, this.popupEl);
        }
      }

      /** Bring an element's top into view, unless it already is. */
      scrollToTop(element) {
        if (!element) return;
        const top = element.getBoundingClientRect().top;
        if (top >= 0 && top < window.innerHeight * 0.4) return;
        element.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      }

      onTeaserSlotsClick(event) {
        const remove = event.target.closest('[data-teaser-remove]');
        if (remove && this.cartMode) {
          this.removeFromCart(parseInt(remove.dataset.teaserRemove, 10));
          return;
        }
        if (remove) {
          const hadFocus = remove === document.activeElement;
          this.slots[parseInt(remove.dataset.teaserRemove, 10)] = null;
          this.setError('');
          // A build-your-own pack has no product to go back to, so it stays open empty.
          if (this.slots.some(Boolean) || this.buildOwn || this.popup) {
            this.render();
            if (hadFocus) this.teaserSlotsEl.querySelector('[data-teaser-remove]')?.focus();
          } else {
            this.exitPacking();
          }
          return;
        }

        if (!event.target.closest('[data-teaser-open]')) return;
        if (this.packing) {
          this.scrollToTop(this.picker);
        } else {
          this.enterPacking();
        }
      }

      /**
       * The ladder as boxes: "1 pair / $16.95", "2 pairs / 10% off" and so on,
       * the last reading "5+ pairs". A box's wording is what that pair earns.
       */
      teaserLadder() {
        const price = this.buildOwn
          ? parseInt(this.dataset.productPrice, 10) || 0
          : this.currentVariant()?.price ?? (parseInt(this.dataset.productPrice, 10) || 0);
        let previous = 0;
        const rungs = this.ladderTiers
          .filter((tier) => !this.maxSocks || tier.qty <= this.maxSocks)
          .map((tier) => {
            let main;
            if (tier.qty <= 1) {
              main = this.formatMoney(price);
            } else if (tier.freeSocks > 0) {
              main = this.freeSocksText(tier);
            } else if (tier.percent > previous || !tier.freeShipping) {
              main = this.teaserDiscountText.replace('[percent]', tier.percent);
            } else {
              main = this.teaserShippingText;
            }
            previous = Math.max(previous, tier.percent);
            return { qty: tier.qty, top: this.pairsText(tier.qty), main, best: false };
          });

        const last = rungs[rungs.length - 1];
        if (last && last.qty > 1) {
          last.top = `${last.qty}+ ${this.sockWordPlural}`;
          last.best = true;
        }
        return rungs;
      }

      /** The top of the ladder, which Product first's bar fills toward. */
      teaserGoal() {
        const tiers = this.ladderTiers.filter(
          (tier) => tier.qty > 1 && (!this.maxSocks || tier.qty <= this.maxSocks)
        );
        return tiers[tiers.length - 1] || null;
      }

      pairsText(count) {
        return `${count} ${count === 1 ? this.sockWordSingular : this.sockWordPlural}`;
      }

      renderTeaser(filled, freeSlots) {
        if (!this.teaserSlotsEl) return;

        const ladder = this.teaserLadder();
        const top = ladder[ladder.length - 1] || { qty: 1, top: this.pairsText(1), main: '' };
        // A pair with no pack of its own (a tier switched off) reads as just a pair.
        const rungAt = (count) =>
          ladder.find((rung) => rung.qty === count) ||
          (count > top.qty ? top : { qty: count, top: this.pairsText(count), main: '' });

        const emptyMarkup = (rung) => {
          const classes = `sock-bundle__teaser-slot${rung.best ? ' is-best' : ''}`;
          const lines = `<span>${this.escape(rung.top)}</span><strong>${this.escape(rung.main)}</strong>`;
          // Once there is a pack, every empty box is a way back to the picker.
          if (!filled) return `<li class="${classes}"><span class="sock-bundle__teaser-tile">${lines}</span></li>`;
          return `<li class="${classes}"><button type="button" class="sock-bundle__teaser-tile" data-teaser-open><span>${this.escape(
            rung.top
          )}</span><strong>+ ${this.escape(rung.main || this.sockWordSingular)}</strong></button></li>`;
        };

        const filledMarkup = (slot, index) => {
          // Each pair names its size, so a mixed pack reads at a glance; a
          // one-size sock has none to name.
          const caption = slot.variantTitle === 'Default Title' ? '' : slot.variantTitle;
          const label = caption ? `${slot.title}, ${caption}` : slot.title;
          const free = freeSlots.has(index);
          return `
            <li class="sock-bundle__teaser-slot is-filled" title="${this.escape(label)}">
              ${slot.image ? `<img src="${slot.image}" alt="${this.escape(label)}" width="200" height="200" loading="lazy">` : ''}
              ${free ? `<span class="sock-bundle__slot-free">${this.escape(this.freeSockTag)}</span>` : ''}
              ${caption ? `<span class="sock-bundle__teaser-cap">${this.escape(caption)}</span>` : ''}
              <button type="button" class="sock-bundle__teaser-remove" data-teaser-remove="${index}" aria-label="Remove ${this.escape(
            label
          )}">&times;</button>
            </li>`;
        };

        // render() keeps the chosen socks first, so slot i is pair i + 1.
        const boxes = [];
        for (let i = 0; i < Math.max(top.qty, filled); i += 1) {
          const rung = rungAt(i + 1);
          boxes.push(i < filled ? filledMarkup(this.slots[i], i) : emptyMarkup(rung));
        }
        this.teaserSlotsEl.innerHTML = boxes.join('');
        // A pack under way keeps its boxes in view, even back on the photos.
        this.classList.toggle('has-pairs', filled > 0);

        if (this.teaserNoteEl) {
          this.teaserNoteEl.textContent = filled
            ? this.selectedCountText(filled)
            : this.teaserNoteEl.dataset.defaultText || '';
        }
        if (this.teaserCountEl) {
          // The subtotal is the whole cart's, so it counts everything in it.
          const others = this.cartMode && this.cart ? this.cart.item_count - filled : 0;
          this.teaserCountEl.textContent =
            others > 0 ? `${this.cart.item_count} items` : this.pairsText(filled);
        }
      }

      /** "10% off", "free shipping": what reaching this pack adds to the last one. */
      unlockedReward(tier) {
        const before = this.tierFor(tier.qty - 1);
        const parts = [];
        if (tier.freeSocks > 0) parts.push(this.freeSocksText(tier));
        if (tier.percent > (before ? before.percent : 0)) {
          parts.push(this.teaserDiscountText.replace('[percent]', tier.percent));
        }
        if (tier.freeShipping && !before?.freeShipping) parts.push(this.rewardShippingText);
        return parts.join(' + ');
      }

      /** A brief "15% off unlocked!" each time the pack climbs a rung. */
      announceUnlock() {
        const qty = this.earnedTier && this.earnedTier.qty > 1 ? this.earnedTier.qty : 0;
        if (qty > this.lastToastQty && !this.quietUnlocks) {
          const reward = this.unlockedReward(this.earnedTier);
          if (reward) {
            const text = this.unlockedToastText.replace('[reward]', reward);
            this.toast(text.charAt(0).toUpperCase() + text.slice(1));
          }
        }
        this.lastToastQty = qty;
      }

      toast(message) {
        if (!this.toastEl) {
          this.toastEl = document.createElement('div');
          this.toastEl.className = `sock-bundle__toast ${this.schemeClass()}`;
          this.toastEl.setAttribute('role', 'status');
          this.toastEl.style.setProperty('--sb-accent', getComputedStyle(this).getPropertyValue('--sb-accent'));
          document.body.appendChild(this.toastEl);
        }
        this.toastEl.textContent = message;
        this.toastEl.classList.add('is-visible');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.toastEl.classList.remove('is-visible'), 2200);
      }

      /**
       * Picker cards, product first: each size in the dropdown carries its
       * price, and the name opens a quick view (the photo opens the lightbox, as
       * in the builder). Safe to run again after a collection tab swaps the cards in.
       */
      enhanceCards() {
        if (!this.teaser || !this.picker) return;

        this.picker.querySelectorAll('[data-picker-card]').forEach((card) => {
          if (!card.dataset.enhanced) {
            card.dataset.enhanced = 'true';

            const title = card.querySelector('.sock-bundle-picker__card-title');
            if (title) {
              title.dataset.pickerQuickView = '';
              title.setAttribute('role', 'button');
              title.tabIndex = 0;
            }

            // Sold-out sizes keep their "Sold out"; the rest say what they cost.
            const select = card.querySelector('select[data-picker-variant]');
            if (select) {
              Array.from(select.options).forEach((option) => {
                const price = parseInt(option.dataset.variantPrice, 10);
                if (option.disabled || !Number.isFinite(price)) return;
                const name = option.dataset.variantTitle || option.textContent.trim();
                option.textContent = `${name} - ${this.formatMoney(price)}`;
              });
              card.classList.add('sock-bundle-picker__card--sizes-with-cost');
            }
          }
        });
      }

      /**
       * The theme's colours only exist inside a colour scheme class, and the
       * quick view and toast sit on <body>, outside the section that has one.
       */
      schemeClass() {
        const section = this.closest('[class*="color-scheme"]');
        return (
          Array.from(section?.classList || []).find((name) => name.startsWith('color-scheme')) ||
          'color-scheme-1'
        );
      }

      /* ---------- Quick view ---------- */

      buildQuickView() {
        const id = `SockBundleQuickView-${this.sectionId}`;
        const dialog = document.createElement('div');
        dialog.className = `sock-bundle-qv ${this.schemeClass()}`;
        dialog.hidden = true;
        dialog.style.setProperty('--sb-accent', getComputedStyle(this).getPropertyValue('--sb-accent'));
        dialog.innerHTML = `
          <div class="sock-bundle-qv__overlay" data-qv-close></div>
          <div class="sock-bundle-qv__box" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
            <button type="button" class="sock-bundle-qv__close" data-qv-close aria-label="${this.escape(this.closeText)}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <div class="sock-bundle-qv__media"><img alt="" data-qv-image></div>
            <div class="sock-bundle-qv__info">
              <h2 class="sock-bundle-qv__title" id="${id}-title" data-qv-title></h2>
              <div class="sock-bundle-qv__price" data-qv-price></div>
              <p class="sock-bundle-qv__desc" data-qv-desc></p>
              <div class="sock-bundle-qv__sizes" role="group" data-qv-sizes></div>
              <button type="button" class="button button--solid button--medium sock-bundle-qv__add" data-qv-add>${this.escape(
                this.quickViewAddText
              )}</button>
              <p class="sock-bundle-qv__unlock" data-qv-unlock></p>
              <a class="sock-bundle-qv__link" data-qv-link>${this.escape(this.quickViewDetailsText)}</a>
            </div>
          </div>`;

        dialog.addEventListener('click', (event) => {
          if (event.target.closest('[data-qv-close]')) {
            this.closeQuickView();
            return;
          }
          const size = event.target.closest('[data-qv-size]');
          if (size) {
            this.quickViewSize = size.dataset.qvSize;
            dialog.querySelectorAll('[data-qv-size]').forEach((button) => {
              button.setAttribute('aria-pressed', String(button === size));
            });
            this.syncQuickViewPrice();
            return;
          }
          if (event.target.closest('[data-qv-add]')) this.addFromQuickView();
        });

        dialog.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            this.closeQuickView();
            return;
          }
          if (event.key === 'Tab') this.trapFocus(event, dialog);
        });

        document.body.appendChild(dialog);
        this.quickView = dialog;
        return dialog;
      }

      /** Keeps Tab inside a dialog while it is open. */
      trapFocus(event, dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll('button:not([disabled]), a[href]')
        ).filter((element) => element.offsetParent);
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

      /** The sock's details from the JSON its picker card carries. */
      cardData(card) {
        try {
          return JSON.parse(card.querySelector('[data-picker-data]')?.textContent || '{}');
        } catch (error) {
          return {};
        }
      }

      openQuickView(card) {
        if (!card) return;

        const data = this.cardData(card);
        const dialog = this.quickView || this.buildQuickView();
        this.quickViewCard = card;
        this.quickViewReturn = document.activeElement;

        const image = dialog.querySelector('[data-qv-image]');
        image.src = card.querySelector('.sock-bundle-picker__card-media img')?.currentSrc || data.image || '';
        image.alt = data.title || '';
        dialog.querySelector('[data-qv-title]').textContent = data.title || '';
        dialog.querySelector('[data-qv-desc]').textContent = '';
        const root = window.Shopify?.routes?.root || '/';
        dialog.querySelector('[data-qv-link]').href = `${root}products/${data.handle || ''}`;

        // The same sizes as the card, starting on the one the card has chosen.
        const select = card.querySelector('select[data-picker-variant]');
        const sizes = dialog.querySelector('[data-qv-sizes]');
        sizes.hidden = !select;
        sizes.setAttribute('aria-label', select?.getAttribute('aria-label') || '');
        this.quickViewSize = select ? select.value : null;
        sizes.innerHTML = select
          ? Array.from(select.options)
              .map(
                (option) => `<button type="button" class="sock-bundle-qv__size" data-qv-size="${this.escape(
                  option.value
                )}" aria-pressed="${option.value === select.value}"${option.disabled ? ' disabled' : ''}>${this.escape(
                  option.dataset.variantTitle || option.textContent.trim()
                )}</button>`
              )
              .join('')
          : '';
        this.syncQuickViewPrice();

        const add = dialog.querySelector('[data-qv-add]');
        const soldOut = card.querySelector('[data-picker-add]')?.dataset.soldout === 'true';
        add.disabled = soldOut || this.isFull();

        // Say so when this one pair is what reaches the next reward.
        const filled = this.slots.filter(Boolean).length;
        const next = this.tiers.find((tier) => tier.qty === filled + 1 && tier.qty > 1);
        const reward = next ? this.unlockedReward(next) : '';
        const unlock = dialog.querySelector('[data-qv-unlock]');
        unlock.textContent = reward ? this.quickViewUnlockText.replace('[reward]', reward) : '';
        unlock.hidden = !reward;

        dialog.hidden = false;
        document.documentElement.classList.add('sock-bundle-qv-open');
        requestAnimationFrame(() => dialog.querySelector('.sock-bundle-qv__box')?.focus());

        this.loadQuickViewDetails(data.handle);
      }

      syncQuickViewPrice() {
        const card = this.quickViewCard;
        if (!card || !this.quickView) return;
        const field = card.querySelector('[data-picker-variant]');
        const option =
          field && field.tagName === 'SELECT'
            ? Array.from(field.options).find((item) => item.value === this.quickViewSize)
            : field;
        const price = parseInt(option?.dataset.variantPrice, 10);
        this.quickView.querySelector('[data-qv-price]').textContent = Number.isFinite(price)
          ? this.formatMoney(price)
          : card.querySelector('[data-picker-price]')?.textContent || '';
      }

      /** A sock's product JSON, fetched once and shared by the quick view and the lightbox. */
      fetchProduct(handle) {
        if (!handle) return Promise.resolve(null);
        this.productCache = this.productCache || {};
        if (!this.productCache[handle]) {
          const root = window.Shopify?.routes?.root || '/';
          this.productCache[handle] = fetch(`${root}products/${encodeURIComponent(handle)}.js`)
            .then((response) => {
              if (!response.ok) throw new Error(`Status ${response.status}`);
              return response.json();
            })
            .catch((error) => {
              console.error(error);
              // Let the next open try again.
              delete this.productCache[handle];
              return null;
            });
        }
        return this.productCache[handle];
      }

      /** A product image URL from the .js endpoint, at a given width. */
      sizedImage(src, width) {
        const url = src.startsWith('//') ? `https:${src}` : src;
        return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
      }

      /** The description and a bigger photo. */
      async loadQuickViewDetails(handle) {
        if (!handle) return;
        const token = (this.quickViewToken = (this.quickViewToken || 0) + 1);
        const product = await this.fetchProduct(handle);
        if (!product || token !== this.quickViewToken || this.quickView.hidden) return;

        const text = (
          new DOMParser().parseFromString(product.description || '', 'text/html').body.textContent || ''
        )
          .replace(/\s+/g, ' ')
          .trim();
        this.quickView.querySelector('[data-qv-desc]').textContent =
          text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;

        if (product.featured_image) {
          this.quickView.querySelector('[data-qv-image]').src = this.sizedImage(product.featured_image, 800);
        }
      }

      addFromQuickView() {
        const card = this.quickViewCard;
        if (!card) return;
        const select = card.querySelector('select[data-picker-variant]');
        if (select && this.quickViewSize && select.value !== this.quickViewSize) {
          select.value = this.quickViewSize;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const added = this.addCard(card);
        if (!(added instanceof Promise)) {
          if (added) this.closeQuickView();
          return;
        }
        // Cart mode: the button spins until Shopify has the sock, then closes.
        const button = this.quickView?.querySelector('[data-qv-add]');
        button?.classList.add('is-loading');
        if (button) button.disabled = true;
        added.then((ok) => {
          button?.classList.remove('is-loading');
          if (button) button.disabled = false;
          if (ok) this.closeQuickView();
        });
      }

      closeQuickView() {
        if (!this.quickView || this.quickView.hidden) return;
        this.quickView.hidden = true;
        document.documentElement.classList.remove('sock-bundle-qv-open');
        this.quickViewReturn?.focus?.();
      }

      /* ------------------------------------------------------------------ */
      /* Photo lightbox                                                      */
      /* ------------------------------------------------------------------ */

      /**
       * Every picker card's photo opens the sock large, with its other photos
       * a step away, and a magnifying glass in its corner says so. Safe to run
       * again after a collection tab swaps the cards in.
       */
      prepareZoom() {
        this.picker?.querySelectorAll('[data-picker-card]').forEach((card) => {
          const media = card.querySelector('.sock-bundle-picker__card-media');
          if (!media || media.hasAttribute('data-picker-zoom') || !media.querySelector('img')) return;
          const title = card.querySelector('.sock-bundle-picker__card-title')?.textContent.trim() || '';
          media.setAttribute('data-picker-zoom', '');
          media.setAttribute('role', 'button');
          media.setAttribute('aria-haspopup', 'dialog');
          media.setAttribute('aria-label', title ? `${this.zoomText}: ${title}` : this.zoomText);
          media.tabIndex = 0;
          media.insertAdjacentHTML(
            'beforeend',
            `<span class="sock-bundle-picker__card-zoom" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </span>`
          );
        });
      }

      buildLightbox() {
        const dialog = document.createElement('div');
        dialog.className = `sock-bundle-lb ${this.schemeClass()}`;
        dialog.hidden = true;
        dialog.innerHTML = `
          <div class="sock-bundle-lb__overlay" data-lb-close></div>
          <div class="sock-bundle-lb__box" role="dialog" aria-modal="true" tabindex="-1">
            <img class="sock-bundle-lb__image" alt="" data-lb-image>
            <button type="button" class="sock-bundle-lb__button sock-bundle-lb__close" data-lb-close aria-label="${this.escape(this.closeText)}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="sock-bundle-lb__button sock-bundle-lb__step sock-bundle-lb__step--prev" data-lb-step="-1" aria-label="${this.escape(this.previousText)}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="sock-bundle-lb__button sock-bundle-lb__step sock-bundle-lb__step--next" data-lb-step="1" aria-label="${this.escape(this.nextText)}">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <p class="sock-bundle-lb__count" data-lb-count></p>
          </div>`;

        dialog.addEventListener('click', (event) => {
          if (event.target.closest('[data-lb-close]')) {
            this.closeLightbox();
            return;
          }
          const step = event.target.closest('[data-lb-step]');
          if (step) this.showLightboxImage(this.lightboxIndex + Number(step.dataset.lbStep));
        });

        dialog.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') {
            this.closeLightbox();
          } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            this.showLightboxImage(this.lightboxIndex + (event.key === 'ArrowLeft' ? -1 : 1));
          } else if (event.key === 'Tab') {
            this.trapFocus(event, dialog);
          }
        });

        document.body.appendChild(dialog);
        this.lightbox = dialog;
        return dialog;
      }

      async openLightbox(card) {
        if (!card) return;

        const data = this.cardData(card);
        const dialog = this.lightbox || this.buildLightbox();
        this.lightboxReturn = document.activeElement;
        this.lightboxTitle = data.title || '';
        dialog.querySelector('.sock-bundle-lb__box').setAttribute('aria-label', this.lightboxTitle);

        // The card's own photo straight away; the full set replaces it once loaded.
        const shown = card.querySelector('.sock-bundle-picker__card-media img')?.currentSrc || data.image;
        this.lightboxImages = shown ? [shown] : [];
        this.showLightboxImage(0);

        dialog.hidden = false;
        document.documentElement.classList.add('sock-bundle-qv-open');
        requestAnimationFrame(() => dialog.querySelector('.sock-bundle-lb__box')?.focus());

        const token = (this.lightboxToken = (this.lightboxToken || 0) + 1);
        const product = await this.fetchProduct(data.handle);
        if (!product?.images?.length || token !== this.lightboxToken || dialog.hidden) return;
        this.lightboxImages = product.images.map((src) => this.sizedImage(src, 1600));
        this.showLightboxImage(0);
      }

      showLightboxImage(index) {
        const count = this.lightboxImages?.length || 0;
        if (!this.lightbox || !count) return;
        this.lightboxIndex = (index + count) % count;

        const image = this.lightbox.querySelector('[data-lb-image]');
        image.src = this.lightboxImages[this.lightboxIndex];
        image.alt = this.lightboxTitle;
        this.lightbox.querySelectorAll('[data-lb-step]').forEach((button) => {
          button.hidden = count < 2;
        });
        this.lightbox.querySelector('[data-lb-count]').textContent =
          count > 1 ? `${this.lightboxIndex + 1} / ${count}` : '';
      }

      closeLightbox() {
        if (!this.lightbox || this.lightbox.hidden) return;
        this.lightbox.hidden = true;
        document.documentElement.classList.remove('sock-bundle-qv-open');
        this.lightboxReturn?.focus?.();
      }

      /* ------------------------------------------------------------------ */
      /* Add to cart                                                         */
      /* ------------------------------------------------------------------ */

      async onAddToCart() {
        if (this.cartMode) {
          this.checkoutFromCart();
          return;
        }
        const filled = this.slots.filter(Boolean).length;
        const items = this.slots
          .filter(Boolean)
          .map((slot) => ({ id: Number(slot.variantId), quantity: 1 }));

        // Every bonus the pack has earned, not just the latest one.
        this.bonusRungs
          .filter((rung) => rung.qty <= filled && rung.variantId)
          .forEach((rung) => items.push({ id: Number(rung.variantId), quantity: 1 }));

        if (filled < 1) {
          this.setError('Pick at least one sock to continue.');
          return;
        }

        // Before anything goes in the cart, offer a few extras
        // (sections/cart-upsell.liquid). Closing it cancels the add.
        this.extraCounts = { all: 0, socks: 0 };
        const upsell = document.querySelector('cart-upsell');
        if (typeof upsell?.offer === 'function') {
          this.atcButton.disabled = true;
          this.atcButton.classList.add('btn--loading');
          const choice = await upsell.offer();
          this.atcButton.classList.remove('btn--loading');
          this.atcButton.disabled = false;
          if (!choice.proceed) return;
          choice.extras.forEach((extra) => items.push({ id: extra.id, quantity: extra.quantity }));
          // Extras count toward the pack size, and so toward its discount code.
          this.extraCounts = {
            all: choice.extras.length,
            socks: choice.extras.filter((extra) => extra.sock).length,
          };
        }

        this.atcButton.disabled = true;
        this.atcButton.classList.add('btn--loading');
        this.setError('');

        const body = { items };

        try {
          // One pack in the cart at a time, so the discount code always matches
          // what is in there. This wipes anything else the shopper had.
          if (this.clearCartOnAdd) {
            const clearUrl = this.cartClearUrl.endsWith('.js')
              ? this.cartClearUrl
              : `${this.cartClearUrl}.js`;
            const cleared = await fetch(clearUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            });
            if (!cleared.ok) {
              this.setError('Could not empty your cart. Please try again.');
              return;
            }
          }

          const response = await fetch(window.theme?.routes?.cartAdd || '/cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(body),
          });

          const result = await response.json();

          if (!response.ok || result.status) {
            this.setError(result.description || result.message || 'Could not add to cart.');
            return;
          }

          await this.applyDiscountAndFinish();
        } catch (error) {
          console.error(error);
          this.setError('Something went wrong. Please try again.');
        } finally {
          this.atcButton.classList.remove('btn--loading');
          this.atcButton.disabled = false;
        }
      }

      async applyDiscountAndFinish() {
        const target = this.afterAdd === 'checkout' ? '/checkout' : this.cartUrl;
        // Respect the locale prefix (e.g. /en-us/) Shopify adds on translated stores.
        const root = (window.theme?.routes?.home || '/').replace(/\/?$/, '/');
        const drawer =
          this.afterAdd === 'stay' && Boolean(document.querySelector('#CartDrawer'));

        // Attach the code through the Ajax cart, trying the best one first and
        // stepping down until Shopify actually applies one.
        const codes = this.codesForCart();
        // Socks added to the cart before the pack (the page's own Add to cart)
        // count too, when the cart is not emptied first: try the code the
        // whole cart earns ahead of the pack's own.
        if (!this.clearCartOnAdd) {
          try {
            const cart = await fetch(`${root}cart.js`, {
              headers: { Accept: 'application/json' },
            }).then((r) => r.json());
            const whole = (this.tierFor(cart.item_count)?.code || '').trim();
            if (whole && !codes.includes(whole)) codes.unshift(whole);
          } catch (error) {
            console.error(error);
          }
        }
        let applied = false;
        for (const code of codes) {
          if (await this.applyDiscountCode(code)) {
            applied = true;
            break;
          }
        }

        // The Ajax cart would not take any of them: redirecting through
        // /discount/CODE is the old reliable way, with the safest code.
        if (codes.length && !applied) {
          window.location.href = `${root}discount/${encodeURIComponent(
            codes[codes.length - 1]
          )}?redirect=${encodeURIComponent(target)}`;
          return;
        }

        // Stay on the page: Impulse rebuilds its cart drawer and opens it.
        if (drawer) {
          document.dispatchEvent(new CustomEvent('cart:build'));
          document.dispatchEvent(new CustomEvent('cart:open'));
          return;
        }

        window.location.href = target;
      }

      /**
       * The pack's codes, best first. Extras from the popup count toward the
       * pack size, so the first code goes by everything going in. The codes only
       * cover socks, though, so a gift box or bundle may not count at checkout;
       * the next code counts the socks only, so the shopper never ends up with
       * less than the pack alone earned.
       */
      codesForCart() {
        const filled = this.slots.filter(Boolean).length;
        const extra = this.extraCounts || { all: 0, socks: 0 };
        const candidates = [
          this.tierFor(filled + extra.all),
          this.tierFor(filled + extra.socks),
          this.tierFor(filled),
        ].map((tier) => (tier?.code || '').trim());
        return [...new Set(candidates.filter(Boolean))];
      }

      /**
       * Puts the code on the cart without leaving the page. Returns false if
       * Shopify did not take it, so the caller can fall back to the redirect.
       */
      async applyDiscountCode(code) {
        try {
          const root = (window.theme?.routes?.home || '/').replace(/\/?$/, '/');
          const response = await fetch(`${root}cart/update.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ discount: code }),
          });
          if (!response.ok) return false;

          const cart = await response.json();
          return (cart.discount_codes || []).some(
            (entry) =>
              String(entry.code).toLowerCase() === code.toLowerCase() && entry.applicable !== false
          );
        } catch (error) {
          console.error(error);
          return false;
        }
      }

      /* ------------------------------------------------------------------ */
      /* Helpers                                                             */
      /* ------------------------------------------------------------------ */

      setError(message) {
        if (this.errorEl) this.errorEl.textContent = message;
      }

      escape(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
      }

      /**
       * Minimal money formatter covering the four Shopify money_format tokens.
       * Falls back to a plain decimal if the format string is unrecognised.
       */
      formatMoney(cents) {
        const value = (cents || 0) / 100;

        const withDelimiter = (number, decimals, thousands, decimal) => {
          const fixed = number.toFixed(decimals);
          const parts = fixed.split('.');
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
          return parts.join(decimal);
        };

        return this.moneyFormat.replace(
          /\{\{\s*(\w+)\s*\}\}/g,
          (match, token) => {
            switch (token) {
              case 'amount':
                return withDelimiter(value, 2, ',', '.');
              case 'amount_no_decimals':
                return withDelimiter(value, 0, ',', '.');
              case 'amount_with_comma_separator':
                return withDelimiter(value, 2, '.', ',');
              case 'amount_no_decimals_with_comma_separator':
                return withDelimiter(value, 0, '.', ',');
              case 'amount_with_apostrophe_separator':
                return withDelimiter(value, 2, "'", '.');
              default:
                return value.toFixed(2);
            }
          }
        );
      }
    }
  );
}
