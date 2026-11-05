# Sock bundle — build your own pack

Ported from the BOM Socks theme (Foesta) to Impulse. Shoppers pick a pack size
(1 / 2 / 3 / 4 / 5), choose each sock from a picker grid, and the matching Shopify
discount code is applied when the pack is added to cart.

## Files

| File | What it does |
| --- | --- |
| `templates/product.bundle-builder.json` | Product template for a "build your own pack" product. |
| `snippets/sock-bundle.liquid` | Pack cards, progress bar, chosen-sock slots, total and add-to-cart button (info column). |
| `snippets/sock-bundle-picker.liquid` | The sock picker grid (image column on desktop, inline on mobile). |
| `snippets/sock-bundle-picker-card.liquid` | One sock card in the picker. |
| `assets/sock-bundle.js` | The `<sock-bundle>` element: pack logic, slots, add to cart, discount redirect. |
| `assets/sock-bundle.css` | All styling, using Impulse's colour variables. |
| `snippets/product-template.liquid` | Wires the picker into the image column and renders the block. |
| `sections/main-product.liquid` | Adds the **Sock bundle (pack size)** block to the product section. |

## Setup

1. Create a product to act as the bundle (e.g. "Build Your Own Pack"). Give it a
   price and image; the price is not what customers pay — they pay for the socks they pick.
2. In the product admin, set **Theme template** to `bundle-builder`.
3. In **Shopify admin → Discounts**, create one code per pack (2, 3, 4, 5 socks):
   - Amount off products, percentage matching the pack (10 / 15 / 20 / 20)
   - Applies to the sock collection used in the picker
   - **Minimum quantity of items** = the pack size, so a code cannot be used on fewer socks
4. In the theme editor, open a product using the `bundle-builder` template, select the
   **Sock bundle (pack size)** block and paste each code into its pack. Check the
   **Socks customers can choose from** collection (defaults to `all-socks`).

**Discount percent** on each pack is display only — it drives the running total and
the free-shipping bar, so keep it equal to the real discount.

## Behaviour

- Adding to cart posts every chosen sock to `/cart/add.js`, then redirects through
  `/discount/<CODE>?redirect=/cart` so the code sticks to the cart. The code used is the
  one for how many socks are actually in the pack, not the card that was clicked.
- Shopify allows one discount code per order; this one replaces any existing code.
- Discount codes are visible in the page source; the minimum-quantity rule keeps that safe.
- **No pack tiles.** The builder opens straight into the picker (**Show the pack size
  tiles** is off). The pack ladder still sets the discount, the bar and the rewards.
- **No limit on socks.** "Your socks" shows 4 boxes to start (**Empty boxes to show**)
  and adds a new empty box every time the last one is filled. Set **Most socks in a pack**
  to put a ceiling on it. The discount used is the biggest pack reached, so 7 socks get
  the 5-pack code.
- **Rewards checklist.** "Free shipping @ 5" sits above the bar and ticks itself once the
  pack has 5 socks. A **Free shipping / Included** box then joins the chosen socks, using
  the icon in **Free shipping icon**.
- **Progress bar levels.** The bar fills towards the next level, not the whole pack:

  ```
  Add 2 socks to save 10%                  (nothing picked)
  Buy one more, save 10% / 15% / 20%       (1–3 socks)
  Buy one more, save 20% + free shipping   (4 socks)
  20% + free shipping unlocked             (5 or more, highlighted)
  ```

  Ticking **This pack includes free shipping** is a promise: back it with a shipping rule
  or a free-shipping discount, since the bar takes your word for it.
- **Total.** It shows the pack price, the full price struck through, and "You save …".
- **The pack is remembered** for the browsing session (per tab), so going to the cart
  and back finds the same socks in the slots. Only ids are saved; names and prices come
  fresh from the picker, and a sock that is sold out or no longer in the picker drops out.
- **Adding a pack empties the cart first** (**Empty the cart before adding a pack**), so
  the cart only ever holds one pack and its discount code always matches. This also
  removes anything else in the cart, including socks added from the cart page's
  suggestions.
- Also ported from BOM and switched off: the 6-pack with free socks and the three bonus
  rewards.
- **Every sock page has the builder too.** `templates/product.json` (the default product
  template) carries the same block and settings as `/products/bible-socks`, with two
  differences: **Show this product first in the picker** is on, and **Only show on socks
  from this collection** is on, so products outside `all-socks` (3-pair bundles, gift boxes)
  keep their normal page. The two templates hold separate copies of the settings, so a
  change to a discount code or wording has to be made in both.
- Below 769px the picker moves inline under the chosen-sock slots.

## Product first (BOM Socks' current layout)

The block's **Layout** setting picks how a page opens. Both product templates now use
**Product first, buy more save more**:

- **Sock pages** (`product.json`): the sock with its photos and the theme's buy box
  (price, size, quantity, a black Add to cart; no Shop Pay button). Under it, the
  builder says where a pack stands ("Add 2 socks to save 10%") and a yellow **Mix &
  match designs** button (**Highlight colour**) swaps the photos for the picker. The
  ladder (1 sock → 2 socks 10% off → … → 5+ socks free shipping) becomes the pack as
  socks go in; a short "15% off unlocked!" pops up at each rung. **Checkout** adds the
  pack, alongside anything already in the cart, and goes to checkout.
- **The builder product** (`product.bundle-builder.json`, Single lets the shopper choose
  any sock on): opens straight on the picker and the empty pack, with no photos, add to
  cart or "Back to product photos".
- Picker cards: each size carries its price ("Men - $18.47"), the Add button counts
  ("Added ×2"), the name opens a quick view (description, sizes, "Adding this unlocks 15%
  off on your pack"), and the photo opens a lightbox with the sock's other photos.
- Phones: the picker takes the photos' place at the top, without the collection tabs, and
  the pack docks to the bottom of the screen, folded to its message, bar, subtotal and
  checkout; its arrow opens it.

Wording for all of this is under **Product first** at the bottom of the block. The
**Pack builder** layout described above still works if a template is switched back.

## Discounts are automatic

Like BOM, the pack discounts are now Shopify **automatic discounts** on the All Socks
collection: 10% at 2+ socks, 15% at 3+, 20% at 4+, set not to combine with each other so
Shopify applies the best one, and set to combine with the free shipping discount. So:

- The tiers' **Discount code** fields and **Theme settings → Cart → Pack discount codes**
  are empty. **Discount percent** must still match the automatic discounts, since the
  pack's totals and ladder are worked out from it.
- **Empty the cart before adding a pack** is off: the cart's total socks set the
  discount, so a pack joins whatever is already there.
- The cart says where it stands, in the drawer and on the cart page: "2 pairs: 10% off.
  Add 1 more to save 15%." (**Theme settings → Cart → Pack savings line**; **Socks that
  count** is All Socks). It lives in the `[data-discounts]` area, which Impulse redraws
  from `templates/cart.ajax.liquid` after every change.
- The popup before the pack goes in (**Cart popup**) is switched off, as on BOM.

## Collection filter tabs

Above "Pick your socks" sits a strip of collection tabs (**Sock bundle → Collection
filters**, up to 15). The picker opens on the first, shown in full; tapping another
fetches that collection's socks from `sections/sock-bundle-picker-grid.liquid` through
the Section Rendering API and keeps it, so tapping back is instant. Socks already in the
pack stay in it, whichever tab they came from, and a sock being viewed leads any tab
that holds it. **Collection filter style** switches the pills to a dropdown, and
**Collection filter label** sets the "Filter by" text.

Only products of type **Socks** appear (**Only show this product type**), since the
3-pack bundles, gift box, gift card and the builder product share some collections.
The grid section has its own copy of that setting, defaulting to Socks.

## Popup before the pack goes in

`sections/cart-upsell.liquid`, rendered in `layout/theme.liquid`; it shows up as the
**Cart popup** section in the theme editor's sidebar, on any page. Pressing **Add bundle to cart** opens it with one of its
collection blocks picked at random (never the same twice in a row), showing up to six
products from `sections/cart-upsell-grid.liquid`:

- **Add N to my order** adds the pack and the picks together.
- **No thanks** adds just the pack.
- Closing it (or Escape) cancels, and nothing is added.

Picks count toward the pack size, so 3 socks + 2 picks earns the 5-pack code. The codes
only cover socks, so the code is applied through the Ajax cart and checked: first by
everything going in, then by socks only, then by the pack alone, stepping down until
Shopify says one applies. Seeded with New Releases, Patriotic and Bible Stories Kids
Love, with placeholder wording to edit.

## You might also like (cart drawer)

At the top of the cart drawer's footer, above the subtotal: up to six products not
already in the cart, from a collection picked at random on each page load
(**Theme settings → Cart → You might also like (cart drawer)**). Adding one removes it
from the row and has Impulse rebuild the drawer.

## Pack codes in the cart

**Theme settings → Cart → Pack discount codes** (`2:CODE, 3:CODE, 4:CODE`). When a sock
is added from the cart page or drawer suggestions, the cart moves onto the code its new
size earns, e.g. a 3-pack plus one more moves from 15% to 20%. A code the shopper typed
in themselves is never replaced. Keep these in step with the codes on the Sock bundle
blocks.

## Site-wide styles to know about

- `snippets/biblesocks-tokens.liquid` sets `body p { color: #fff !important }` for the dark
  homepage sections. The builder's messages are paragraphs, so `sock-bundle.css` restates
  their colour. Any new text added to the builder as a `<p>` needs the same.
- `theme.css.liquid` hides anything with "price" in its class name inside anything with
  "bundle" in its class name (for the BYOB app page). `sock-bundle.css` brings back the
  sock prices in the picker.

