<!-- No tag name here: main.ts registers the element itself so a second copy of the script cannot throw -->
<svelte:options customElement={{ shadow: "open" }} />

<script lang="ts">
  import { onMount } from "svelte";
  import { on } from "svelte/events";
  import { startApp } from "~/bootstrap";
  import Dock from "~/components/Dock.svelte";
  import DropZone from "~/components/DropZone.svelte";
  import GridOverlay from "~/components/GridOverlay.svelte";
  import MockupOverlay from "~/components/MockupOverlay.svelte";
  import Toast from "~/components/Toast.svelte";
  import { ALLOWED_MIME_TYPES } from "~/constants";
  import { createDoubleTapDetector } from "~/features/overlay/doubleTap";
  import { dockStore } from "~/stores/dockStore.svelte";
  import { mockupStore } from "~/stores/mockupStore.svelte";
  import { overlayController } from "~/features/overlay/controller.svelte";
  import { isTouchDevice } from "~/utils/device";

  onMount(startApp);

  // Global double-tap: anywhere on the page (dock included) toggles solid mode
  const doubleTap = createDoubleTapDetector();

  function handleGlobalTouchStart(e: TouchEvent) {
    if (dockStore.isManagerMode || e.touches.length !== 1) return doubleTap.cancel();
    const touch = e.touches[0];
    doubleTap.start({ x: touch.clientX, y: touch.clientY }, Date.now());
  }

  function handleGlobalTouchMove(e: TouchEvent) {
    if (e.touches.length !== 1) return doubleTap.cancel();
    const touch = e.touches[0];
    doubleTap.move({ x: touch.clientX, y: touch.clientY });
  }

  function handleGlobalTouchEnd(e: TouchEvent) {
    if (dockStore.isManagerMode || e.touches.length !== 0) return doubleTap.cancel();

    const touch = e.changedTouches[0];
    if (doubleTap.end({ x: touch.clientX, y: touch.clientY }, Date.now())) {
      // Also stops the second tap from clicking whatever is under it
      e.preventDefault();
      overlayController.toggleMobileSolidMode();
    }
  }

  // Global drag-and-drop state
  let dragEnterCount = 0;
  let showDropZone = $state(false);

  /** A file drag the tool may take: not over a host <input type="file">, which accepts files natively */
  function isFileDragForTool(e: DragEvent) {
    if (!e.dataTransfer?.types.includes("Files")) return false;
    const target = e.composedPath()[0];
    return !(target instanceof HTMLInputElement && target.type === "file");
  }

  function handleGlobalDragEnter(e: DragEvent) {
    if (!isFileDragForTool(e)) return;
    dragEnterCount++;
    if (dragEnterCount === 1) {
      showDropZone = true;
    }
  }

  function handleGlobalDragLeave(e: DragEvent) {
    if (!isFileDragForTool(e)) return;
    dragEnterCount--;
    if (dragEnterCount === 0) {
      showDropZone = false;
    }
  }

  function handleGlobalDragOver(e: DragEvent) {
    // Cancelling dragover makes the page the drop target, which would bypass a native file input
    if (!isFileDragForTool(e)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleGlobalDrop(e: DragEvent) {
    showDropZone = false;
    dragEnterCount = 0;

    // Leave text/HTML drops alone, and drops the host page already handled (e.g. its own uploader)
    if (!isFileDragForTool(e) || e.defaultPrevented) return;
    e.preventDefault();

    const files = Array.from(e.dataTransfer?.files || []).filter((file) =>
      ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])
    );

    if (files.length > 0) {
      mockupStore.uploadAndActivate(files);
    }
  }

  // Global drag-and-drop listeners
  $effect(() => {
    const stops = [
      on(document, "dragenter", handleGlobalDragEnter),
      on(document, "dragleave", handleGlobalDragLeave),
      on(document, "dragover", handleGlobalDragOver),
      on(document, "drop", handleGlobalDrop)
    ];
    return () => stops.forEach((stop) => stop());
  });

  // Conditionally prevent browser zoom gestures and enable global double-tap
  // - When mockup overlay is visible: disable zoom, enable double-tap to toggle solid mode
  // - When mockup overlay is hidden: allow normal browser zoom behavior
  // Note: Uses isTouchDevice() to check capability, but keyboard shortcuts work in parallel
  $effect(() => {
    // Only set up touch handlers on devices that support touch
    // Keyboard shortcuts are handled separately and always work
    if (!isTouchDevice()) return;
    if (overlayController.isHidden || !overlayController.activeMockupUrl) return;

    const style = document.documentElement.style;
    const previousTouchAction = style.getPropertyValue("touch-action");
    const previousPriority = style.getPropertyPriority("touch-action");
    style.setProperty("touch-action", "pan-x pan-y");
    const stops = [
      on(document, "touchstart", handleGlobalTouchStart, { passive: true }),
      on(document, "touchmove", handleGlobalTouchMove, { passive: true }),
      on(document, "touchend", handleGlobalTouchEnd, { passive: false }),
      on(document, "touchcancel", doubleTap.cancel, { passive: true }),
      on(window, "scroll", () => doubleTap.scrolled(Date.now()), { passive: true })
    ];

    return () => {
      if (style.getPropertyValue("touch-action") === "pan-x pan-y" && !style.getPropertyPriority("touch-action")) {
        style.setProperty("touch-action", previousTouchAction, previousPriority);
      }
      doubleTap.cancel();
      stops.forEach((stop) => stop());
    };
  });
</script>

<div class="theme-root" class:dark={dockStore.theme === "dark"}>
  <GridOverlay />
  <MockupOverlay />
  <Dock />
  <Toast />
  <DropZone visible={showDropZone} />
</div>

<style lang="scss">
  // Isolate the tool from the host page: inherited properties (font, letter-spacing,
  // text-transform, line-height, color, ...) would otherwise leak into the shadow root.
  // `!important` is needed because host rules matching <pixel-mirror> itself (e.g. `* {}`)
  // beat normal :host rules, while important :host rules beat the host page's.
  // `all` doesn't cover `direction`, so RTL pages would still flip the toolbar without it.
  :host {
    all: initial !important;
    font-family:
      ui-sans-serif,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      sans-serif !important;
    direction: ltr !important;
  }

  .theme-root {
    --pm-font-sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --pm-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

    // Surfaces: the floating toolbar is translucent, panels and popovers are solid
    --pm-surface-primary: rgba(255, 255, 255, 0.9);
    --pm-surface-elevated: #ffffff;
    --pm-surface-subtle: #f5f5f7;
    --pm-surface-hover: rgba(24, 24, 27, 0.05);
    --pm-surface-active: rgba(24, 24, 27, 0.08);
    --pm-backdrop-blur: blur(20px) saturate(180%);

    // Borders (form control borders need 3:1 against their surroundings)
    --pm-border-subtle: rgba(24, 24, 27, 0.06);
    --pm-border-strong: rgba(24, 24, 27, 0.12);
    --pm-border-control: #8a8a92;

    // Text
    --pm-text-primary: #18181b;
    --pm-text-secondary: #52525b;
    --pm-text-muted: #71717a;

    // Monochrome emphasis (no chromatic accent): active, selected, switched-on and focused
    // states use black in the light theme and white in the dark one
    --pm-accent: #18181b;
    --pm-accent-hover: #3f3f46;
    --pm-accent-fg: #ffffff;
    --pm-accent-subtle: rgba(24, 24, 27, 0.1);
    --pm-accent-text: #18181b;
    --pm-focus-ring: #18181b;

    --pm-danger: #dc2626;
    --pm-danger-hover: #b91c1c;
    // Lucide chevron-down for selects (see THIRD_PARTY_NOTICES.md), in --pm-text-secondary (CSS variables can't reach into a data URL)
    --pm-select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352525b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    --pm-danger-text: #b91c1c;
    --pm-switch-off: #d4d4d8;

    // Elevation
    --pm-shadow-hud: 0 1px 2px rgba(0, 0, 0, 0.06), 0 8px 24px -4px rgba(0, 0, 0, 0.14);
    --pm-shadow-panel: 0 2px 6px rgba(0, 0, 0, 0.05), 0 20px 48px -8px rgba(0, 0, 0, 0.2);

    // Radii
    --pm-radius-pill: 9999px;
    --pm-radius-panel: 16px;
    --pm-radius-card: 12px;
    --pm-radius-control: 8px;

    // Primary buttons
    --pm-button-bg: var(--pm-accent);
    --pm-button-fg: var(--pm-accent-fg);
    --pm-button-hover-bg: var(--pm-accent-hover);
    --pm-button-disabled-bg: #a1a1aa;

    // Mockup cards
    --pm-mockup-border: rgba(24, 24, 27, 0.1);
    --pm-mockup-border-hover: rgba(24, 24, 27, 0.24);

    color-scheme: light;

    &.dark {
      --pm-surface-primary: rgba(28, 28, 32, 0.9);
      --pm-surface-elevated: #1c1c20;
      --pm-surface-subtle: #232328;
      --pm-surface-hover: rgba(255, 255, 255, 0.06);
      --pm-surface-active: rgba(255, 255, 255, 0.1);

      --pm-border-subtle: rgba(255, 255, 255, 0.06);
      --pm-border-strong: rgba(255, 255, 255, 0.12);
      --pm-border-control: #71717a;

      --pm-text-primary: #f4f4f5;
      --pm-text-secondary: #a1a1aa;
      --pm-text-muted: #93939b;

      --pm-accent: #f4f4f5;
      --pm-accent-hover: #d4d4d8;
      --pm-accent-fg: #18181b;
      --pm-accent-subtle: rgba(255, 255, 255, 0.12);
      --pm-accent-text: #fafafa;
      --pm-focus-ring: #f4f4f5;

      --pm-danger-text: #f87171;
      --pm-select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      --pm-switch-off: #3f3f46;

      --pm-shadow-hud: 0 1px 2px rgba(0, 0, 0, 0.3), 0 10px 30px -4px rgba(0, 0, 0, 0.5);
      --pm-shadow-panel: 0 2px 8px rgba(0, 0, 0, 0.3), 0 24px 56px -8px rgba(0, 0, 0, 0.6);

      --pm-button-disabled-bg: #3f3f46;

      --pm-mockup-border: rgba(255, 255, 255, 0.1);
      --pm-mockup-border-hover: rgba(255, 255, 255, 0.24);

      color-scheme: dark;
    }
  }

  :global {
    * {
      box-sizing: border-box;
    }

    button {
      padding: 0;
      margin: 0;
      font: inherit;
      color: inherit;
      cursor: pointer;
      outline: none;
      background: none;
      border: none;
      -webkit-tap-highlight-color: transparent;

      &:disabled {
        cursor: default;
      }

      &:not(:disabled):active {
        transform: scale(0.96);
      }
    }

    svg {
      display: block;
      color: currentColor;
      fill: none;
    }

    // `none` rather than a near-zero duration: a duration on every element would turn any property
    // change into a transition, e.g. the page measurement that briefly collapses the mockup viewport
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        transition: none !important;
        animation: none !important;
      }
    }
  }
</style>
