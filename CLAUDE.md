# CLAUDE.md

Guidance for working with the `pixel-mirror` repository. Detailed quality review and migration notes live in `docs/quality-review.md`.

## Project Overview

Pixel Mirror is a zero-config frontend visual QA tool built as a Svelte 5 custom element (`<pixel-mirror>`) with an open Shadow DOM. It is injected into host pages during development (via Vite/Astro plugins or direct script import) to overlay design mockups and layout/baseline grids.

## Commands

```bash
pnpm dev          # Start dev server on port 3000
pnpm build        # Build IIFE library to dist/index.js
pnpm check        # Run svelte-check and TypeScript type checking
pnpm lint         # Run ESLint, Stylelint, and Prettier check (read-only)
pnpm lint:fix     # Apply ESLint, Stylelint, and Prettier fixes
pnpm test         # Run Vitest in watch mode
pnpm test:run     # Run all unit/integration tests once
```

## Architecture & Module Boundaries

```
src/
├── main.ts                          # Waits for DOM ready, guards customElements.define, mounts <pixel-mirror>
├── bootstrap.ts                     # Idempotent app initialization (dock, keyboard, device tracking, overlays, managers)
├── App.svelte                       # Shadow root host, --pm-* design tokens, global file-drop & touch double-tap
├── features/
│   └── overlay/
│       ├── model.ts                 # Pure state machine: Placement, Interaction, OverlayMode, and `can.*` guards
│       ├── geometry.ts              # Pure math: alignment resolution, focusPoint scaling, zoom view
│       ├── gestures.ts              # Unified Pointer Events attachment (drag, pan, 2-pointer pinch, tap/double-tap)
│       └── doubleTap.ts             # Pure double-tap detector with scroll cooldown
├── platform/
│   ├── typing.ts                    # Whether keys go to a text field (shared by shortcuts and popover Escape)
│   ├── blobSrc.ts                   # Svelte attachment managing Blob -> object URL lifecycle safely across remounts
│   └── settings.svelte.ts           # Reactive settings container with schema validation & debounced persistence
├── stores/
│   ├── dockStore.svelte.ts          # Dock pill & studio panel mode ("toolbar" | "mockups" | "grids"), theme, position
│   ├── mockupOverlayStore.svelte.ts # Overlay state, opacity, scale, alignment, and gesture interactions
│   ├── mockupManagerStore.svelte.ts # Mockup library CRUD & active selection
│   ├── gridOverlayStore.svelte.ts   # Spacing & layout grid display settings
│   ├── gridManagerStore.svelte.ts   # Layout grid CRUD and validated setting updates
│   ├── keyboardStore.svelte.ts      # Centralized keyboard shortcuts with host-page & Shadow DOM input guards
│   ├── toastStore.svelte.ts         # Error notification state
│   └── database.ts                  # IndexedDB v3 persistence (image bytes + MIME type, since WebKit private windows reject Blobs; retries a failed open)
├── components/
│   ├── Dock.svelte                  # Persistent floating pill HUD + Opacity, Alignment/Scale, and Studio popovers + Inspect HUD
│   ├── MockupOverlay.svelte         # Viewport-clipped mockup rendering and click-through locked mode
│   ├── MockupManager.svelte         # Mockup Studio (top-cropped thumbnails, metadata badges, 2-step clear confirmation)
│   ├── GridOverlay.svelte           # Layout & spacing grid overlay rendering
│   ├── GridManager.svelte           # Grid Studio (labelled fields, radio grid list, folded new-grid form, 2-step reset)
│   ├── ColorField.svelte            # Grid color field: picker (native alpha where supported), text, wheel/keyboard opacity
│   ├── Toast.svelte                 # Accessible role="alert" toast with auto-dismiss and hover pause
│   ├── DropZone.svelte              # Full-viewport file drop indicator
│   └── icons/                       # Icon.svelte (Lucide paths in paths.ts, see THIRD_PARTY_NOTICES.md), Opacity/AlignmentIcon.svelte (state icons)
└── utils/                           # color.ts, device.ts, errors.ts, generate-mockup-buffers.ts, validation.ts
```

## Core Invariants

1. **Host Page Non-Interference**:
   - `:host` resets inherited styles (`all: initial !important; direction: ltr !important`).
   - Keyboard shortcuts in `keyboardStore` ignore events when no mockup is active/visible, when `e.defaultPrevented` or `e.isComposing` is true, when `Ctrl`/`Meta`/`Alt` modifiers are held, or when focus is inside an editable element (traversing open Shadow DOMs).
   - Document `drop` listener ignores non-file drags and events where the host page already called `e.preventDefault()`.
   - When locked (`mode === "locked"`) or when a Studio panel is open (`dockStore.isManagerMode`), `MockupOverlay` sets `pointer-events: none` so clicks, hovers, focus, and scrolling pass straight through to the host page underneath.
2. **Derived Placement over Manual Sync**:
   - Each axis in `Placement` is `{ align: ... } | { offset: number }`. Screen coordinates are derived reactively from `placement`, `mockupSize`, and `pageSize` (tracked via `ResizeObserver` on `document.documentElement`).
   - Moving the mockup (drag or arrow keys) frees only the axes it moved along (`moveAlongAxes`), so a vertical nudge keeps a horizontal centering.
3. **Host Layout & Scrollbar Isolation**:
   - `MockupOverlay` wraps the mockup image in `.mockup-viewport` (`overflow: clip`) and `readPageSize` ignores `.mockup-viewport`'s height when measuring `document.documentElement.scrollHeight`, ensuring `2x` zoom or dragging past viewport edges never introduces host scrollbars.
   - `observePageSize` also re-measures (throttled) on host DOM mutations, resource loads and transition ends: pages with `html, body { height: 100% }` don't resize when their content changes. Never give elements in the shadow root a blanket transition (e.g. a reduced-motion `transition-duration` on `*`): it delays the collapse `readPageSize` relies on.
4. **Unified Pointer Events & Hybrid Devices**:
   - `gestures.ts` handles mouse, pen, and multi-touch gestures via Pointer Events (`setPointerCapture`), avoiding duplicate Touch/Gesture/window listeners.
   - Hover popovers check `isLastInputTouch()` so touch taps on hybrid devices do not trigger sticky hover states.
   - Mobile inputs inside `<pixel-mirror>` use `font-size: 16px` under `@media (max-width: 680px)` to prevent iOS Safari auto-zoom on focus.
