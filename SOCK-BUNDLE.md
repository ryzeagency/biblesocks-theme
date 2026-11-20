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
  button**). It opens the picker and the pack (see Mix & match popup); a short "15% off
  unlocked!" pops up at each rung, and **Add bundle to cart** (**Pack button text**) adds
  the pack, applies the pack's code, closes the popup, empties the pack and opens the cart
  drawer (**After adding a pack → Open the cart drawer**).
- The cart is not emptied first (**Empty the cart before adding a pack** is off on sock
  pages), so socks added with the normal Add to cart stay. The code tried first is the
  one the whole cart earns, e.g. 1 sock already in the cart + a 2-sock pack gets the
  15% code; it steps down to the pack's own code if Shopify will not take it.
- Socks added only with the normal Add to cart get no code by themselves.
- Picker cards: each size carries its price, the Add button counts ("Added ×2"), the
  name is plain text (it used to open a quick view), and the photo opens a lightbox.
- Phones, product pages: the bundle takes over the screen while it's open. The picker
  jumps to just under the header and the page locks there, so only the list of socks
  scrolls. The list fills the space down to the docked pack, and "Back to product photos"
  is the only way out (it unlocks the page). The list is always sized to the *folded*
  pack, so when the pack opens to show a new sock it slides over the bottom of the list
  instead of shrinking it, and folds away again on the next scroll. Not the bundle page
  section or the build-your-own page, where the picker is the page.
- Phones: on product pages the list of socks scrolls on its own, running down to the
  docked pack. On the TV offer / bundle page section it doesn't: every sock shows at full
  length and the page itself scrolls, with room at the bottom so the docked pack never
  covers the last row.
- Phones: once a pack is started the picker takes the photos' place and the pack docks
  to the bottom. It opens on its socks when the cart already has some (on page load
  too), and folded to its message, bar, subtotal and checkout when empty. When the first sock
  goes in, the pack opens so the shopper sees it land. As soon as they scroll the page
  or the list of socks, it folds again to give the socks the room. The same happens
  after opening it. On phones the number of socks picked isn't shown at the top, either
  beside "Pick your socks" or on the pack's top line. The subtotal ("(3 socks)") and the
  cards' "Added ×2" carry it. The whole pack opens and closes it, not just its arrow (its buttons,
  links and boxes keep their own taps). While folded, the arrow gives a small upward hop every
  4 seconds to show the pack can be opened. It stays still for shoppers whose phone is
  set to reduce motion. This applies to sock pages, the builder product and
  the sock bundle page section.

The builder product (`product.bundle-builder.json`) uses the same Product first picker
and pack, opening straight on them (**Single lets the shopper choose any sock** makes it
a build-your-own page): no Mix & match button and no popup. On a computer the picker
takes the photos' column and the pack sits beside it; on a phone the picker fills the
page and the pack docks to the bottom. **Add bundle to cart** adds the pack and opens the
drawer, and the picker stays open with the pack emptied. Wording for Product first is
under **Product first** at the bottom of the block.

## Add to cart opens the picker, and the pack is the cart (dev)

Ported from BOM Socks' `main` (2026-11-12). Sock pages (`templates/product.json`) use
**Sock bundle → Picker opens: From Add to cart, with this sock** and **After adding a
pack: Keep the pack in the cart**:

- The page first looks like a plain sock page: photos, title, price, size, quantity and
  Add to cart, with no pack and no Mix & match button.
- Add to cart puts that many of the sock, in the size picked, into the pack and the cart,
  and the picker takes the photos' place (no popup). While it shows, everything above the
  pack in the buy column steps aside; "Back to product photos" brings the page back, with
  the pack still showing under Add to cart. Pressing Add to cart again adds more.
- The pack is the cart: it starts from the cart's pairs (counted like the drawer's pack
  bar), each pick or × goes into or out of the cart straight away, and the drawer's + and
  − or Remove show in the pack a moment later. The drawer redraws without opening; the
  pack's button (**Pack button text**: "View cart") opens it. Emptying the pack goes back
  to the plain page.
- The 10/15/20% discounts are Shopify **automatic** discounts now (titled
  BIBLESOCKSMIXANDMATCH10/15/20, seen on 2026-11-12), so they apply however the pairs reach
  the cart, and the tiers' **Discount code** fields are empty in both templates. If a tier
  is given a code again, the pack moves the cart onto the code its pairs earn after every
  change (none at 1 pair or at 9), leaving a code the shopper typed alone.
- Files: `sections/sock-bundle-cart.liquid` and `snippets/sock-bundle-cart-lines.liquid`
  (the cart's pairs as JSON), and the "pack is the cart" part of `assets/sock-bundle.js`.

The build-your-own page (`product.bundle-builder.json`) keeps the pack in the cart too.
With **Picker opens: From its button** and **Open the cart drawer**, a page works as
before (Mix & match button, Add bundle to cart).

## Picker top on sock pages (add-more tool)

On sock pages, Add to cart opens the picker as an *add-more* tool, on phones and computers.
The top is kept to one row, and the pack's tracker does the talking:

- **"← Back to product"** on the left, the only way out. It puts the photos back, and the
  pack and cart are kept. It replaced "Back to product photos" at the bottom of the list.
  The text is in **"Back to product" link text**. On phones the filter icon sits at the
  right of the same row.
- **No heading.** **Picker heading** is empty in `product.json`, since the tracker already
  says "Add 1 more to save 15%". An empty heading is simply left out. The build-your-own
  product and the bundle page section keep "Pick your socks".
- **"Added" toast.** Add to cart pops up "✓ Bible Hero Socks (Men) added" (or "2 × …")
  with the sock's photo for 3 seconds: at the top of the screen on a phone and the bottom
  on a computer. If that add also unlocks a discount, one toast says both:
  "✓ … added · 15% off unlocked!". The wording is in **Sock bundle → "Added" toast** (`picker_added_toast`; not
  `picker_added_text`, which is the card button's "Added"), with
  `[item]` for the sock, size and quantity.

## Mix & match popup

**Sock bundle → Open the picker as a full-screen popup** (on for sock pages): Mix & match
covers the whole page with the picker and the pack instead of swapping out the photos.
A bar across the top carries the title (the **Open the picker button** text) and a ×;
Escape and a phone's back button close it too. On a computer the socks fill the left and
the pack sits on the right; on a phone the socks scroll and the pack docks to the bottom,
folded. Closing puts the picker and the pack back on the page, with the pack as it was.

## Discounts

The 10/15/20% pack discounts are Shopify automatic discounts (BIBLESOCKSMIXANDMATCH10/15/20),
so the tiers' code fields are empty in both product templates. **Theme settings → Cart →
Pack discount codes** still lists the old codes. The popup
before the pack goes in (**Cart popup**) is switched off for now.

## 9 socks: 3 free (automatic discount)

The free socks come from a Shopify **automatic** discount (buy 6, get 3 free), not a code.
In both product templates **Sock bundle → Bigger pack** has 9 socks, 3 free and an empty
**Discount code**. It is the top of the ladder, as on BOM Socks: boxes 1 to 9, where 6 to 8
read "20% off / Free ship" (what the pack has by then) and the last "9+ socks / 3 socks
free"; the bar fills toward 9, with a dot and a small truck at 5, where free shipping
starts (dark once reached). At 9 socks or more the pack tags its 3 cheapest socks Free, prices
itself to match, pops up "3 socks free unlocked!", and adds itself without a code: if a
10/15/20% pack code is on the cart it comes off, so it does not stand in the automatic
discount's way. A code the shopper typed in is left alone. The cart page and drawer do
the same when their suggestions take the cart to 9 (`9:automatic` in **Theme settings →
Cart → Pack discount codes**).

The automatic discount should make the cheapest socks the free ones, so the pack's
price matches checkout.
## Collection filter tabs

Above "Pick your socks" sits a strip of collection tabs (**Sock bundle → Collection
filters**, up to 15). The picker opens on the first, shown in full; tapping another
fetches that collection's socks from `sections/sock-bundle-picker-grid.liquid` through
the Section Rendering API and keeps it, so tapping back is instant. Socks already in the
pack stay in it, whichever tab they came from, and a sock being viewed leads any tab
that holds it. **Collection filter style** switches the pills to a dropdown, and
**Collection filter label** sets the "Filter by" text.

On phones the tabs fold into a **filter icon** on the "Pick your socks" heading, next to
the name of the collection on show. Tapping it opens a drawer from the bottom listing
every collection with its sock count, the one on show ticked. Picking one swaps the
socks and closes the drawer, and ×, the dark backdrop or Escape close it without a
change. It works the same with either **Collection filter style**, and the drawer's
title is the **Collection filter label**. Computers keep the pills or the dropdown.

**Phone filters** (under Collection filters) sets which collections the phone's drawer
lists. The collection the picker opens on (All Socks) always comes first as the way back
to every sock, followed by those chosen, e.g. Men, Women, Kids. Leave it empty to list
every collection filter. It's set separately on each of the three templates, like the
other settings. It's set to Men (`men`), Youth (`youth`) and Kids (`children`) in all three.
Women's and Youth socks are the same size, so the Youth collection serves both.

**Filter names** renames a filter in the picker (pills, dropdown, phone drawer and the
icon's label) without renaming the collection in Shopify, written as `handle:Name`,
separated by commas. The default is `youth:Women / Youth, children:Kids`, so phones read
All socks, Men, Women / Youth, Kids.

**Filters pick the size.** Tapping a filter (pill or drawer row) switches every sock's size
dropdown to the size named like the filter, when that size is in stock, and the card's
price follows. Men picks "Men" or "Men's" (never "Women's") and Youth picks "Youth". A
filter that names no size (All socks, Patriotic) leaves the dropdowns as they were. Where
a collection and its size are named differently, pair them in **Size each filter picks**
as `handle:Size`, separated by commas. The default is `children:Kids`. Filters match on the
collection's own title, not its Filter name, so Youth still picks the Youth size.

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

## Pack progress bar (cart drawer)

Ported from BOM Socks: under the cart drawer's title, above the items and outside the
part that scrolls, the next step ("Add 1 more to save 15%.") sits centred above a bar
that fills toward 9 socks, with a dot and a tiny truck where the cart reaches free
shipping, and a second line saying "$15.76 away from free shipping" or "Free shipping
unlocked!". Settings: **Theme settings → Cart → Pack progress bar (cart drawer)** (steps
`2:10, 3:15, 4:20, 9:3 free`, free shipping from $70; empty steps hide the bar). It only
describes the discounts; the pack codes and the automatic 9 sock discount give them. Socks
are counted from "Socks that count", or everything but gift cards and package protection.
A code the shopper typed (not a pack code) hides the bar. Files:
`snippets/cart-pack-progress.liquid`, `sections/cart-drawer-progress.liquid` (redrawn
after every cart change by the script at the end of `snippets/cart-drawer.liquid`),
`assets/cart-pack-progress.css`.

## Buy more save more bar (collection pages)

The pack progress bar from the cart drawer also docks to the bottom of collection pages.
On a phone it runs full width, like the sock pages' docked pack. On a computer it's a card
centred at the bottom. It shows the next step, the bar with the free-shipping truck, the
pack as boxes, the cart subtotal and **View cart**, which opens the drawer.

- **The boxes** work like the sock pages' docked pack. There's one per pair in the cart,
  with its photo and size and a × that takes that pair out of the cart. Then come empty
  boxes up to the top step, each reading what that many socks earns ("3 socks / + 15% off").
  The last one ("9+ socks / + 3 free") is in yellow. Counts with no step of their own
  (5 to 8) read as what the pack already has. Five boxes show on a phone and seven on a
  computer, sliding sideways for more. They're built from the same steps and "Socks that
  count" as the tracker. Unlike the sock pages, there's no picker here: shoppers fill
  the boxes with the Add to cart under each product.

- It appears once the cart has socks that count, and comes up after every **Add to cart**
  under a product card. The drawer stays shut by default. Turn on **Also open the cart
  drawer after an add to cart** to open both.
- The drawer opens anyway when the bar has nothing to show, e.g. a gift card was added or
  the shopper typed their own code.
- **It's an accordion.** Folded, it keeps the next step, the tracker, the subtotal and
  View cart, and the boxes tuck away. It comes up open, including on page load with socks
  already in the cart, and opens again after each add to cart, so the shopper sees the
  pair land. It folds again as soon as they scroll the page, like
  the sock pages' docked pack. Tapping anywhere on the bar (or its arrow) opens and closes it by hand, apart from its
  buttons, links and boxes, and while folded it
  gives a small hop every 4 seconds (still for shoppers set to reduce motion).
- Settings: **Collection → Product grid block → Buy more save more bar**. The steps and
  wording are the drawer's (**Theme settings → Cart → Pack progress bar (cart drawer)**),
  so the bar always agrees with the drawer.
- Files: `snippets/collection-pack-bar.liquid` (contents),
  `sections/collection-pack-bar.liquid` (redraws them after each cart change),
  `assets/collection-pack-bar.{js,css}`, wired in by `sections/main-collection.liquid`
  and `assets/product-card-add.js`.

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

