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
          }))
          .sort((a, b) => a.qty - b.qty);
        // The smallest pack that ships free, if any. It gets its own milestone on the bar.
        this.shipTier = this.tiers.find((tier) => tier.freeShipping) || null;
        this.slotsWrap = this.querySelector('[data-sock-bundle-slots-wrap]');
        this.slotsEl = this.querySelector('[data-sock-bundle-slots]');
        this.progressEl = this.querySelector('[data-sock-bundle-progress]');
        this.summaryEl = this.querySelector('[data-sock-bundle-summary]');
        this.totalEl = this.querySelector('[data-sock-bundle-total]');
        this.atcButton = this.querySelector('[data-sock-bundle-atc]');
        this.errorEl = this.querySelector('[data-sock-bundle-error]');

        this.pickerSlot = this.querySelector('[data-sock-bundle-picker-slot]');
        this.mobileQuery = window.matchMedia('(max-width: 768px)');

        this.tiersEl = this.querySelector('[data-sock-tiers]');
        this.prevArrow = this.querySelector('[data-sock-tiers-prev]');
        this.nextArrow = this.querySelector('[data-sock-tiers-next]');
        this.progressBar = this.querySelector('[data-sock-bundle-progressbar]');
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
        this.progressShippingNextText =
          this.dataset.progressShippingNextText || 'Add [count] more [socks] to unlock FREE shipping';
        this.progressShippingUnlockedText =
          this.dataset.progressShippingUnlockedText ||
          "You've unlocked FREE shipping + [percent]% off!";
        this.sockWordSingular = this.dataset.sockWordSingular || 'sock';
        this.sockWordPlural = this.dataset.sockWordPlural || 'socks';

        this.discountPercent = 0;
        this.tierFreeShipping = false;

        this.pickerReplacesGallery = this.dataset.pickerReplacesGallery === 'true';
        this.prefillCurrent = this.dataset.prefillCurrent === 'true';
        this.singleUsesPicker = this.dataset.singleUsesPicker === 'true';
        this.hideDefaultAtc = this.dataset.hideDefaultAtc === 'true';
        this.afterAdd = this.dataset.afterAdd || 'cart';
        this.cartUrl = this.dataset.cartUrl || '/cart';
        this.moneyFormat = this.dataset.moneyFormat || '${{amount}}';

        try {
          this.variantData = JSON.parse(
            this.querySelector('[data-sock-bundle-variants]')?.textContent || '[]'
          );
        } catch (error) {
          this.variantData = [];
        }

        this.quantity = 1;
        this.maxSlots = 1;
        this.discountCode = '';
        /** @type {Array<{variantId: string, productId: string, title: string, variantTitle: string, image: string, price: number}|null>} */
        this.slots = [];

        this.onTierClick = this.onTierClick.bind(this);
        this.onPickerClick = this.onPickerClick.bind(this);
        this.onPickerVariantChange = this.onPickerVariantChange.bind(this);
        this.onSlotsClick = this.onSlotsClick.bind(this);
        this.onSlotVariantChange = this.onSlotVariantChange.bind(this);
        this.onAddToCart = this.onAddToCart.bind(this);
        this.onVariantChange = this.onVariantChange.bind(this);
        this.updateArrows = this.updateArrows.bind(this);
        this.syncPickerPlacement = this.syncPickerPlacement.bind(this);
      }

      connectedCallback() {
        this.tierButtons.forEach((button) => button.addEventListener('click', this.onTierClick));
        this.slotsEl?.addEventListener('click', this.onSlotsClick);
        this.slotsEl?.addEventListener('change', this.onSlotVariantChange);
        this.atcButton?.addEventListener('click', this.onAddToCart);
        this.picker?.addEventListener('click', this.onPickerClick);
        this.picker?.addEventListener('change', this.onPickerVariantChange);
        this.syncAllCardPrices();

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

        // Liquid marks one tier checked; run it so the page opens in that state.
        // On a normal product that is Single, which is a no-op.
        const checked =
          this.tierButtons.find((tier) => tier.getAttribute('aria-checked') === 'true') ||
          this.tierButtons[0];
        if (checked) this.selectTier(checked);

        // The server-side open state has done its job; let JS own it from here.
        this.picker?.classList.remove('sock-bundle-picker--open-on-load');
      }

      disconnectedCallback() {
        document.removeEventListener('variant:change', this.onVariantChange);
        this.picker?.removeEventListener('change', this.onPickerVariantChange);
        this.tiersEl?.removeEventListener('scroll', this.updateArrows);
        window.removeEventListener('resize', this.updateArrows);
        this.mobileQuery.removeEventListener('change', this.syncPickerPlacement);
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

        if (this.quantity <= 1 && !this.singleUsesPicker) {
          this.exitBundleMode();
          return;
        }

        this.enterBundleMode();
      }

      enterBundleMode() {
        // Always lay out the full ladder's worth of boxes, whichever pack was
        // clicked. Anything already chosen is kept.
        this.maxSlots = this.tiers.length ? this.tiers[this.tiers.length - 1].qty : this.quantity;
        const next = new Array(this.maxSlots).fill(null);
        this.slots.slice(0, this.maxSlots).forEach((slot, index) => {
          next[index] = slot;
        });
        this.slots = next;

        if (this.prefillCurrent && !this.slots[0]) {
          this.slots[0] = this.currentProductSlot();
        }

        this.slotsWrap.hidden = false;
        this.slotsEl.style.setProperty('--sb-slot-count', String(Math.max(this.maxSlots, 2)));

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

        // Only the pre-filled first slot tracks the main variant picker.
        if (this.prefillCurrent && this.slots[0]?.productId === this.dataset.productId) {
          this.slots[0] = {
            ...this.slots[0],
            variantId: String(newId),
            price: variant.price,
            variantTitle: variant.title,
            image: variant.image || this.slots[0].image,
          };
          this.render();
        }
      }

      /* ------------------------------------------------------------------ */
      /* Picker                                                              */
      /* ------------------------------------------------------------------ */

      onPickerClick(event) {
        const backButton = event.target.closest('[data-picker-back]');
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

        const index = this.firstEmptySlot();
        if (index === -1) {
          this.setError('Your pack is full. Remove a sock to swap it out.');
          return;
        }

        const variantField = card.querySelector('[data-picker-variant]');
        const option =
          variantField && variantField.tagName === 'SELECT'
            ? variantField.options[variantField.selectedIndex]
            : variantField;

        if (!variantField || !variantField.value) return;

        let data = {};
        try {
          data = JSON.parse(card.querySelector('[data-picker-data]')?.textContent || '{}');
        } catch (error) {
          data = {};
        }

        this.slots[index] = {
          variantId: variantField.value,
          productId: card.dataset.productId,
          title: data.title || '',
          variantTitle: (option?.dataset.variantTitle || '').replace(/^Default Title$/, ''),
          image: option?.dataset.variantImage || data.image || '',
          price: parseInt(option?.dataset.variantPrice, 10) || 0,
          variants: this.readCardVariants(card),
        };

        this.setError('');
        this.render();
      }

      /**
       * Liquid can only print one price per card, and `product.price` is the
       * cheapest variant, so a card showing "Men" could quote the Ankle price.
       * The displayed price follows the card's dropdown instead.
       */
      onPickerVariantChange(event) {
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

      firstEmptySlot() {
        return this.slots.findIndex((slot) => !slot);
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
        const filled = this.slots.filter(Boolean).length;

        this.slotsEl.innerHTML = this.slots
          .map((slot, index) => {
            if (!slot) {
              return `
                <div class="sock-bundle__slot" role="listitem">
                  <span class="sock-bundle__slot-media"><span class="sock-bundle__slot-plus">+</span></span>
                  <span class="sock-bundle__slot-title">${this.escape(
                    `Sock ${index + 1}`
                  )}</span>
                </div>`;
            }

            return `
              <div class="sock-bundle__slot sock-bundle__slot--filled" role="listitem">
                <button type="button" class="sock-bundle__slot-remove" data-slot-remove="${index}" aria-label="Remove ${this.escape(
              slot.title
            )}">&times;</button>
                <span class="sock-bundle__slot-media">
                  ${slot.image ? `<img src="${slot.image}" alt="" loading="lazy">` : ''}
                </span>
                <span class="sock-bundle__slot-title">${this.escape(slot.title)}</span>
                ${this.slotVariantMarkup(slot, index)}
              </div>`;
          })
          .join('');

        if (this.progressEl) {
          this.progressEl.textContent = `${filled} / ${this.maxSlots} selected`;
        }

        if (this.picker) {
          const progress = this.picker.querySelector('[data-picker-progress]');
          if (progress) progress.textContent = `${filled} / ${this.maxSlots} selected`;

          const counts = {};
          this.slots.filter(Boolean).forEach((slot) => {
            counts[slot.productId] = (counts[slot.productId] || 0) + 1;
          });

          const full = filled >= this.maxSlots;

          this.picker.querySelectorAll('[data-picker-card]').forEach((card) => {
            const count = counts[card.dataset.productId] || 0;
            card.dataset.picked = String(count);
            const badge = card.querySelector('[data-picker-count]');
            if (badge) badge.textContent = String(count);

            // Sold-out socks stay disabled; the rest only while the pack is full.
            const add = card.querySelector('[data-picker-add]');
            if (add) add.disabled = add.dataset.soldout === 'true' || full;
          });
        }

        // What the pack has actually earned, and what one more sock would earn.
        this.earnedTier = this.tierFor(filled);
        this.nextTier =
          this.tiers.find((tier) => tier.qty > filled && (tier.percent > 0 || tier.freeShipping)) ||
          null;
        this.discountCode = this.earnedTier ? this.earnedTier.code : '';
        this.discountPercent = this.earnedTier ? this.earnedTier.percent : 0;
        this.tierFreeShipping = this.earnedTier ? this.earnedTier.freeShipping : false;

        const subtotal = this.slots
          .filter(Boolean)
          .reduce((sum, slot) => sum + (slot.price || 0), 0);
        const payable = Math.round(subtotal * (1 - this.discountPercent / 100));

        if (this.summaryEl && this.totalEl) {
          this.summaryEl.hidden = filled === 0;
          this.totalEl.textContent = this.formatMoney(payable);
        }

        this.highlightEarnedTier(filled);
        this.renderProgress(filled, this.shipBasis === 'full' ? subtotal : payable);

        this.atcButton.disabled = filled < 1;
      }

      /**
       * Move the selected card to the pack size actually in the slots, so the
       * card, the discount and the note all say the same thing. With nothing
       * picked yet there is nothing to move to, so the card stays put.
       */
      highlightEarnedTier(filled) {
        if (filled < 1 || !this.earnedTier) return;
        this.tierButtons.forEach((button) => {
          const qty = parseInt(button.dataset.qty, 10) || 1;
          button.setAttribute('aria-checked', String(qty === this.earnedTier.qty));
        });
      }

      /** The best tier this many socks qualifies for. */
      tierFor(count) {
        let earned = null;
        this.tiers.forEach((tier) => {
          if (tier.qty <= count) earned = tier;
        });
        return earned;
      }

      /** "20%" or "20% + free shipping", from a tier on the ladder. */
      rewardFor(tier) {
        if (!tier) return '';
        const parts = [];
        if (tier.percent > 0) parts.push(this.rewardDiscountText.replace('[percent]', tier.percent));
        if (tier.freeShipping) parts.push(this.rewardShippingText);
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
        if (!this.progressFill) return;

        const percent = this.maxSlots ? Math.min(100, (filled / this.maxSlots) * 100) : 0;
        this.progressFill.style.width = `${percent}%`;
        this.progressFill.classList.toggle('is-complete', filled >= this.maxSlots && filled > 0);

        const perSock = filled ? towardsShipping / filled : this.estimatedSockPrice();
        const shippingOn = this.freeShipping && this.shipThreshold > 0;
        const packWillShip =
          this.tierFreeShipping ||
          (shippingOn && perSock > 0 && perSock * this.maxSlots >= this.shipThreshold);

        this.renderShipMarker(filled, towardsShipping, perSock, packWillShip);

        if (!this.shipNote) return;

        let message;
        let shippingUnlocked = false;
        if (this.nextTier) {
          const more = this.nextTier.qty - filled;
          const socks = more === 1 ? this.sockWordSingular : this.sockWordPlural;
          const reward = this.rewardFor(this.nextTier);
          // One step from the free shipping pack gets its own nudge;
          // otherwise point at the next saving: "Buy one more, save 15%".
          let template = filled === 0 ? this.progressStartText : this.progressIncompleteText;
          if (this.nextTier.freeShipping && filled > 0) template = this.progressShippingNextText;
          message = template
            .replace('[count]', more)
            .replace('[socks]', socks)
            .replace('[reward]', reward);
        } else if (this.earnedTier?.freeShipping) {
          shippingUnlocked = true;
          message = this.progressShippingUnlockedText.replace('[percent]', this.earnedTier.percent);
        } else {
          // Top of the ladder: say what the pack has earned.
          const reward = this.rewardFor(this.earnedTier);
          message = reward ? this.progressCompleteText.replace('[reward]', reward) : '';
        }

        // Earned the discount but the order still misses free shipping on value.
        if (
          !this.nextTier &&
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

        const changed = this.shipNote.textContent !== message;
        this.shipNote.textContent = message;
        this.shipNote.classList.toggle(
          'sock-bundle__progress-note--unlocked',
          !this.nextTier && Boolean(this.earnedTier) && this.earnedTier.percent > 0
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

        let left = null;
        let reached = false;

        if (this.shipTier) {
          // A pack that includes free shipping: the milestone sits at that pack.
          left = Math.min(100, (this.shipTier.qty / this.maxSlots) * 100);
          reached = filled >= this.shipTier.qty;
        } else if (packWillShip) {
          // Otherwise, at the sock where the running total crosses the threshold.
          const socksNeeded = Math.ceil(this.shipThreshold / perSock);
          left = Math.min(100, (socksNeeded / this.maxSlots) * 100);
          reached = towardsShipping >= this.shipThreshold;
        }

        this.shipMarker.hidden = left === null;
        this.progressBar?.classList.toggle('has-milestone', left !== null);
        if (left === null) return;

        this.shipMarker.style.left = `${left}%`;
        // Keep the label inside the bar's edges when the milestone sits at an end.
        this.shipMarker.classList.toggle('sock-bundle__progress-marker--end', left >= 85);
        this.shipMarker.classList.toggle('sock-bundle__progress-marker--reached', reached);
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
      slotVariantMarkup(slot, index) {
        const variants = slot.variants || [];

        if (variants.length > 1) {
          const options = variants
            .map(
              (variant) =>
                `<option value="${this.escape(variant.id)}"${
                  String(variant.id) === String(slot.variantId) ? ' selected' : ''
                }>${this.escape(variant.title)}</option>`
            )
            .join('');
          return `<select class="sock-bundle__slot-select" data-slot-variant="${index}" aria-label="Size for ${this.escape(
            slot.title
          )}">${options}</select>`;
        }

        return slot.variantTitle
          ? `<span class="sock-bundle__slot-variant">${this.escape(slot.variantTitle)}</span>`
          : '';
      }

      onSlotVariantChange(event) {
        const select = event.target.closest('[data-slot-variant]');
        if (!select) return;

        const index = parseInt(select.dataset.slotVariant, 10);
        const slot = this.slots[index];
        if (!slot) return;

        const variant = (slot.variants || []).find(
          (item) => String(item.id) === String(select.value)
        );
        if (!variant) return;

        this.slots[index] = {
          ...slot,
          variantId: variant.id,
          variantTitle: variant.title,
          price: variant.price,
          image: variant.image || slot.image,
        };
        this.render();
      }

      /* ------------------------------------------------------------------ */
      /* Add to cart                                                         */
      /* ------------------------------------------------------------------ */

      async onAddToCart() {
        const items = this.slots
          .filter(Boolean)
          .map((slot) => ({ id: Number(slot.variantId), quantity: 1 }));

        if (items.length < 1) {
          this.setError('Pick at least one sock to continue.');
          return;
        }

        this.atcButton.disabled = true;
        this.atcButton.classList.add('btn--loading');
        this.setError('');

        const body = { items };
        const addUrl = window.theme?.routes?.cartAdd || '/cart/add.js';

        try {
          const response = await fetch(addUrl, {
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

          this.applyDiscountAndFinish();
        } catch (error) {
          console.error(error);
          this.setError('Something went wrong. Please try again.');
        } finally {
          this.atcButton.classList.remove('btn--loading');
          this.atcButton.disabled = false;
        }
      }

      applyDiscountAndFinish() {
        const code = this.discountCode.trim();

        // Redirecting through /discount/CODE is the reliable way to attach a
        // discount to the cart, so that path wins whenever a code is set.
        if (code) {
          const target = this.afterAdd === 'checkout' ? '/checkout' : this.cartUrl;
          // Respect the locale prefix (e.g. /en-us/) Shopify adds on translated stores.
          const root = (window.theme?.routes?.home || '/').replace(/\/?$/, '/');
          window.location.href = `${root}discount/${encodeURIComponent(
            code
          )}?redirect=${encodeURIComponent(target)}`;
          return;
        }

        if (this.afterAdd === 'checkout') {
          window.location.href = '/checkout';
          return;
        }

        if (this.afterAdd === 'stay') {
          // Impulse's cart drawer listens for these: rebuild its contents, then open it.
          document.dispatchEvent(new CustomEvent('cart:build'));
          document.dispatchEvent(new CustomEvent('cart:open'));
          return;
        }

        window.location.href = this.cartUrl;
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
