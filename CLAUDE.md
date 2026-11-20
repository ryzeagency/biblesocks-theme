# CLAUDE.md

Shopify theme for **BibleSocks**, maintained by Ryze Agency. It is **Impulse 7.4.1** (Archetype Themes) with a lot of custom work on top: a "build your own sock pack" bundle builder, cart upsells, pack-discount progress bars, and branded landing pages.

## Workflow

- No build step, no package manager, no tests. Files are edited directly and served by Shopify as-is. (`snippets/package.json` is Archetype's vendor metadata, not a project manifest.)
- The repo is connected to Shopify through the **GitHub integration**. Commits titled "Update from Shopify for theme biblesocks-theme/<branch>" are edits made in the theme editor and synced back. Branches `main`, `dev`, `experimental` and `feature/*` each map to a theme in the store. `main` is the live theme.
- Because of that sync, **`config/settings_data.json` and `templates/*.json` change from the admin side too.** Pull before editing them, and expect merge conflicts in those files.
- Feature work goes on `feature/*` branches and merges to `main` through a PR.
- To preview locally, use the Shopify CLI (`shopify theme dev`). `.shopify/` is gitignored.

## Layout

Standard Shopify theme structure: `layout/`, `templates/` (JSON, plus some `.liquid`), `sections/`, `snippets/`, `assets/`, `config/`, `locales/`.

- `layout/theme.liquid` loads `theme.css.liquid`, `vendor-scripts-v11.js` and `theme.js` (Impulse core), the section groups (`header-group`, `popup-group`, `footer-group`), and `{% section 'cart-upsell' %}` on every page.
- `layout/theme.zipifypages.liquid` and the `*.zipifypages*` templates, sections and snippets belong to the **Zipify Pages** app. Don't edit them by hand.
- `inf-header-scripts` / `inf-footer-scripts` are app script hooks.
- Custom JS and CSS are **not** loaded globally. Each feature's section or snippet includes its own asset (for example `sections/main-cart.liquid` loads `cart-extras.js`). When you add an asset, include it from the section or snippet that uses it.

## Custom code (not part of stock Impulse)

**Read [SOCK-BUNDLE.md](SOCK-BUNDLE.md) before touching the bundle, cart or discount code.** It describes current behaviour, the settings, and how they connect to the Shopify discounts.

| Area | Files |
| --- | --- |
| Sock bundle / pack builder | `assets/sock-bundle.js` (`<sock-bundle>`, about 2.9k lines), `assets/sock-bundle.css`, `snippets/sock-bundle*.liquid`, `sections/sock-bundle-page.liquid`, `sections/sock-bundle-cart.liquid`, `sections/sock-bundle-picker-grid.liquid`, a block in `sections/main-product.liquid`, wired in by `snippets/product-template.liquid` |
| Bundle templates | `templates/product.json` (every sock page), `templates/product.bundle-builder.json` (build-your-own product), `templates/page.sock-bundle.json` (TV-ad landing page, with `sections/tv-offer-banner.liquid`) |
| Cart popup upsell | `sections/cart-upsell.liquid`, `sections/cart-upsell-grid.liquid`, `assets/cart-upsell.{js,css}` |
| Cart page extras | `assets/cart-extras.{js,css}` (`<cart-extras>`), `snippets/cart-extras-*.liquid`, `sections/main-cart.liquid` |
| Cart drawer | `snippets/cart-drawer.liquid`, `snippets/cart-item.liquid`, `snippets/cart-pack-progress.liquid` + `sections/cart-drawer-progress.liquid` + `assets/cart-pack-progress.css` (pack progress bar), `sections/cart-drawer-recs-grid.liquid` + `assets/cart-recommendations.js` ("You might also like") |
| Quick add on product cards | `snippets/product-card-add.liquid`, `assets/product-card-add.{js,css}` |
| Collection buy more save more bar | `snippets/collection-pack-bar.liquid`, `sections/collection-pack-bar.liquid`, `assets/collection-pack-bar.{js,css}` (`<collection-pack-bar>`), rendered by `sections/main-collection.liquid`; reuses `snippets/cart-pack-progress.liquid` |
| Brand homepage sections | `sections/biblesocks-*.liquid`, which share `snippets/biblesocks-tokens.liquid` (fonts and global style overrides) |
| Landing pages | `templates/page.black-friday-2026.liquid`, `templates/page.monthly-lander.liquid` (self-contained; they hide the theme header and footer) |
| Other | `templates/llms.txt.liquid`, `assets/collection-infinite-scroll.js`, `assets/image-banner.js` |

### Patterns used in the custom code

- **Custom elements** with a guard: `if (!customElements.get('x')) customElements.define(...)`. Plain browser JS, no bundler, no imports.
- **Section Rendering API** to keep the logic in Liquid. JS fetches `?section_id=` or `?sections=` for HTML or JSON, using dedicated "grid" sections (`sock-bundle-picker-grid`, `cart-upsell-grid`, `cart-drawer-recs-grid`, `sock-bundle-cart`).
- **Ajax cart** (`/cart/add.js`, `/cart/change.js`, `/cart.js`). Discount codes are applied by redirecting through `/discount/<CODE>`.
- **Impulse events.** Dispatch `cart:build` on `document` to have Impulse rebuild the drawer and `cart:open` to open it. Listen for `cart:updated`. Reuse these; don't build a separate cart renderer.
- Liquid files start with a `{%- comment -%}` block explaining what the file does and where it is used. Keep that convention.

## Discounts and settings: things that bite

- Pack discounts of 10/15/20% are Shopify **automatic** discounts (`BIBLESOCKSMIXANDMATCH10/15/20`). Buy 6, get 3 free is also automatic. The tiers' discount-code fields are intentionally empty.
- `templates/product.json` and `templates/product.bundle-builder.json` keep **separate copies** of the Sock bundle block settings. A wording or discount change has to be made in both.
- **Theme settings → Cart** (`config/settings_schema.json`, for example `cart_pack_codes`) holds the pack codes and progress-bar steps. Keep these in step with the bundle block.
- Discount-percent values in settings are for display only. They must match the real discounts.

## Global CSS gotchas

- `snippets/biblesocks-tokens.liquid` forces `body p { color: #fff !important }` for the dark homepage sections. Any new `<p>` on a light background needs its colour restated.
- `theme.css.liquid` hides any `[class*=price]` inside `[class*=bundle]` (for the BYOB app). Avoid that naming combination, or override it as `sock-bundle.css` does.
- The mobile breakpoint used by the custom code is **769px**, matching Impulse.

## Conventions

- Theme-editor text goes in section or block `{% schema %}` settings. Stock Impulse strings use `locales/*.json` (`'key' | t`), with `en.default.json` as the source.
- Prefer adding settings over hard-coding copy, since the client edits content in the theme editor.
- When you change bundle or cart behaviour, update `SOCK-BUNDLE.md` to match. It is written in plain, non-technical language for the merchant team.
