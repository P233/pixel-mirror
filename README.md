# Pixel Mirror

![Pixel Mirror toolbar with layout and spacing grids](https://raw.githubusercontent.com/P233/pixel-mirror/v2.1.0/docs/app.png)

Overlay design mockups on web pages for pixel-perfect UI implementation. Features adjustable transparency, scaling, alignment, and grid guides.

## Features

- **Mockup overlay** with opacity, scale, alignment, drag positioning, and a 5-state mode system (visible / locked / dragging / solid / zoomed)
- **Grid overlay** with layout columns and spacing guides
- **Desktop**: keyboard shortcuts, Ctrl+Scroll opacity, click-to-zoom (2x), mouse pan
- **Mobile / Touch**: double-tap solid mode, pinch-to-zoom (0.25x–4x), touch drag & pan, slide-to-adjust opacity
- **Hybrid device support**: touch and keyboard/mouse inputs coexist seamlessly

## Overlay Modes

The mockup overlay has 5 modes:

| Mode         | Description                                                                   |
| ------------ | ----------------------------------------------------------------------------- |
| **Visible**  | Default. Drag, adjust opacity/scale/alignment.                                |
| **Locked**   | Position frozen; clicks, hovers and scrolling pass through to the page.       |
| **Dragging** | Active during drag, returns to visible on release.                            |
| **Solid**    | 100% opacity for pixel comparison. Desktop: hold `Space`; Mobile: double-tap. |
| **Zoomed**   | 2x zoom with mouse pan. Click in solid mode to enter, click again to leave.   |

## Usage

### Desktop

| Action                          | Shortcut                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Add mockups                     | Drop images on the page, or Mockup Studio                                                    |
| Show / Hide mockup              | Toolbar button                                                                               |
| Lock / Unlock position          | `Escape` or toolbar button                                                                   |
| Snap to an edge or center       | Hover the alignment button; click it for top center                                          |
| Adjust opacity                  | Hover the opacity button, or focus it and press `Enter`, or `Ctrl + Scroll` (click to reset) |
| Drag mockup                     | Mouse drag on overlay                                                                        |
| Nudge mockup (1px)              | Arrow keys                                                                                   |
| Nudge mockup (10px)             | `Shift` + Arrow keys                                                                         |
| Enter solid mode (100% opacity) | Hold `Space`                                                                                 |
| Zoom (2x) in solid mode         | Click                                                                                        |
| Pan in zoomed mode              | Move mouse                                                                                   |
| Cycle scale (1x / 0.5x)         | Toolbar button                                                                               |
| Grid color opacity              | Scroll over the color field in Grid Studio                                                   |

Moving the mockup only releases the alignment of the axis you move it along: center it horizontally, then nudge it down with the arrow keys to check a section further down the page.

### Mobile / Touch

| Action                    | Gesture                                            |
| ------------------------- | -------------------------------------------------- |
| Add mockups               | Mockup Studio                                      |
| Show / Hide mockup        | Toolbar button                                     |
| Lock / Unlock position    | Toolbar button                                     |
| Snap to an edge or center | Tap the alignment button; tap again for top center |
| Adjust opacity            | Tap for controls, or slide on the opacity button   |
| Drag mockup               | Touch drag on overlay                              |
| Toggle solid mode         | Double-tap outside controls                        |
| Pinch zoom in solid mode  | Two-finger pinch (0.25x–4x)                        |
| Pan in solid mode         | Single finger drag                                 |
| Cycle scale (1x / 0.5x)   | Toolbar button                                     |

## Installation

```bash
npm install pixel-mirror --save-dev
```

### Vite

```js
// vite.config.js
import pixelMirror from "pixel-mirror/vite";

export default defineConfig({
  plugins: [pixelMirror()]
});
```

The plugin only runs in dev (`vite serve`) and injects the tool into `index.html`.

### Any bundler / SSR frameworks (SvelteKit, Nuxt, Remix, ...)

Frameworks that render HTML themselves don't go through Vite's `index.html` transform. Import the package from your client entry instead; it is dropped from production builds:

```js
if (import.meta.env.DEV) import("pixel-mirror");
```

### Astro

```js
// astro.config.mjs
import pixelMirror from "pixel-mirror/astro";

export default defineConfig({
  integrations: [pixelMirror()]
});
```

### Next.js

```jsx
// _document.jsx <Head>
{
  process.env.NODE_ENV === "development" && (
    <Script src="https://cdn.jsdelivr.net/npm/pixel-mirror/dist/index.js" strategy="afterInteractive" />
  );
}
```

### CDN

```html
<script defer src="https://cdn.jsdelivr.net/npm/pixel-mirror/dist/index.js"></script>
```

Remove in production.

## Note

Pixel Mirror leaves the host `<html>` element's `position` unchanged. The mockup uses a fixed viewport clip, with a separate scroll translation to keep it aligned with its document coordinates. Scrolling is separate from the image's move and scale transitions.

Scroll compensation runs in JavaScript and can [lag behind asynchronous scrolling](https://firefox-source-docs.mozilla.org/performance/scroll-linked_effects.html) while the main thread is busy.

Avoid `transform` or `contain: layout` on `<html>`, which can affect the positioning of the mockup, toolbar and grids.

Spacing grids use alternating horizontal stripes with a default height of `8px`. Height accepts `px` and `rem`, with `4px`, `8px` and `16px` presets. Saved heights are retained.

On touch devices, browser pinch-to-zoom is temporarily disabled while the mockup overlay is visible to avoid conflicts with the tool's gesture handling. It reverts to normal when the overlay is hidden.

If your page enforces [Trusted Types](https://developer.mozilla.org/docs/Web/API/Trusted_Types_API) (`require-trusted-types-for 'script'`), allow the `svelte-trusted-html` policy in your dev CSP, e.g. `trusted-types your-policies svelte-trusted-html 'allow-duplicates'` (`'allow-duplicates'` is only needed if your app also uses Svelte).

## Development

Use Node.js 24 and pnpm 12.11.2:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm lint
pnpm build
pnpm test:run
```

CI runs these checks on pushes and pull requests. The build runs before tests so the Vite plugin tests can serve the bundle.

Settings updates merge only changed fields in an IndexedDB transaction. Failed settings and resource loads retry when the window regains focus; failed writes retry on the next edit. Loading settings preserves edits whose writes are still in flight.

Layout and spacing grids use a 1%–99% opacity range and default to 10%. Grid colors entered as text, picked natively or loaded from stored settings are clamped to this range. Mockup opacity ranges from 10% to 90%, with a default of 50%. Solid mode uses 100% opacity for comparison.

## Credits

Icons from [Lucide](https://lucide.dev) (ISC License); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
