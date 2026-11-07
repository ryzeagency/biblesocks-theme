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

## Product first (BOM Socks' dev theme layout)

Sock pages (`templates/product.json`) use the block's **Layout: Product first, buy more
save more**, matching BOM Socks' `dev` branch:

- The theme's own buy box sells this sock: sizes, quantity and a black **Add to cart**
  that adds it to the cart like any product.
- Under it, the bundle block: where a pack stands ("Add 2 socks to save 10%", "Mix &
  match any designs") and a yellow **Mix & match designs** button (**Open the picker
  button**). It swaps the photos for the picker; the ladder then shows and becomes the
  pack, a short "15% off unlocked!" pops up at each rung, and **Checkout** adds the pack,
  applies the pack's code and goes to checkout.
- The cart is not emptied first (**Empty the cart before adding a pack** is off on sock
  pages), so socks added with the normal Add to cart stay. The code tried first is the
  one the whole cart earns, e.g. 1 sock already in the cart + a 2-sock pack gets the
  15% code; it steps down to the pack's own code if Shopify will not take it.
- Socks added only with the normal Add to cart get no code by themselves.
- Picker cards: each size carries its price, the Add button counts ("Added ×2"), the
  name opens a quick view, and the photo opens a lightbox.
- Phones: once a pack is started the picker takes the photos' place and the pack docks
  to the bottom, folded to its message, bar, subtotal and checkout.

The builder product (`product.bundle-builder.json`) keeps the **Pack builder** layout,
and still empties the cart before its pack goes in. Wording for Product first is under
**Product first** at the bottom of the block.

## Mix & match popup

**Sock bundle → Open the picker as a full-screen popup** (on for sock pages): Mix & match
covers the whole page with the picker and the pack instead of swapping out the photos.
A bar across the top carries the title (the **Open the picker button** text) and a ×;
Escape and a phone's back button close it too. On a computer the socks fill the left and
the pack sits on the right; on a phone the socks scroll and the pack docks to the bottom,
folded. Closing puts the picker and the pack back on the page, with the pack as it was.

## Discounts

Packs use the discount codes `BIBLESOCKSMIXANDMATCH10/15/20`, set on each tier in both
product templates and in **Theme settings → Cart → Pack discount codes**. The popup
before the pack goes in (**Cart popup**) is switched off for now.

## 9 socks: buy 6 get 3 free

At 9 socks or more the pack uses `BUY6GET3FREE` instead of the 20% code (**Sock bundle →
Bigger pack code**, in both product templates). It is not on the ladder: the pack just
switches code once it gets there, tags its 3 cheapest socks Free, prices the pack to
match, and pops up "3 socks free unlocked!". The cart moves onto it too when socks added
from the cart page or drawer reach 9 (`9:BUY6GET3FREE` in **Theme settings → Cart →
Pack discount codes**).

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

