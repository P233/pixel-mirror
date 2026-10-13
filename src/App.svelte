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
  import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";
  import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";
  import { isTouchDevice } from "~/utils/device";

  onMount(startApp);

  // Global double-tap: anywhere on the page (dock included) toggles solid mode
  const doubleTap = createDoubleTapDetector();

  function handleGlobalTouchEnd(e: TouchEvent) {
    // Skip in manager mode (mockups/grids panels) and while other fingers are still down
    if (dockStore.isManagerMode || e.touches.length !== 0) return;

    const touch = e.changedTouches[0];
    if (doubleTap.tap({ x: touch.clientX, y: touch.clientY }, Date.now())) {
      // Also stops the second tap from clicking whatever is under it
      e.preventDefault();
      mockupOverlayStore.toggleMobileSolidMode();
    }
  }

  // Global drag-and-drop state
  let dragEnterCount = 0;
  let showDropZone = $state(false);

  function hasFiles(e: DragEvent) {
    return e.dataTransfer?.types.includes("Files") ?? false;
  }

  function handleGlobalDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return;
    dragEnterCount++;
    if (dragEnterCount === 1) {
      showDropZone = true;
    }
  }

  function handleGlobalDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return;
    dragEnterCount--;
    if (dragEnterCount === 0) {
      showDropZone = false;
    }
  }

  function handleGlobalDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleGlobalDrop(e: DragEvent) {
    showDropZone = false;
    dragEnterCount = 0;

    // Leave text/HTML drops alone, and drops the host page already handled (e.g. its own uploader)
    if (!hasFiles(e) || e.defaultPrevented) return;
    e.preventDefault();

    const files = Array.from(e.dataTransfer?.files || []).filter((file) =>
      ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])
    );

    if (files.length > 0) {
      mockupManagerStore.uploadAndActivate(files);
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
    if (mockupOverlayStore.isHidden || !mockupOverlayStore.activeMockupUrl) return;

    document.documentElement.style.touchAction = "pan-x pan-y";
    const stops = [
      on(document, "touchend", handleGlobalTouchEnd, { passive: false }),
      on(window, "scroll", () => doubleTap.scrolled(Date.now()), { passive: true })
    ];

    return () => {
      document.documentElement.style.touchAction = "";
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
    font-family: Arial, sans-serif !important;
    direction: ltr !important;
  }

  .theme-root {
    // Dock
    --dock-bg: #fff;
    --dock-fg: #000;
    --dock-border: #000;
    --dock-outline: rgba(255, 255, 255, 0.5);

    // Text
    --text-primary: #000;
    --text-secondary: #333;

    // Border
    --border-light: #eee;
    --border-medium: #d4d4d4;

    // Input
    --input-bg: #fff;
    --input-text: #000;
    --input-placeholder: #999;
    --input-border: #d4d4d4;

    // Button
    --btn-bg: #000;
    --btn-fg: #fff;
    --btn-hover-bg: #333;
    --btn-disabled-bg: #555;

    // Focus
    --focus-ring: #d9daff;
    --focus-bg: rgba(217, 218, 255, 0.2);

    // Status
    --color-success: #10b981;
    --color-success-bg: #ecfdf5;
    --color-danger: #fe0200;

    // Mockup
    --mockup-border: #999;
    --mockup-border-hover: #000;

    // Alignment
    --align-x-bg: rgba(0, 0, 255, 0.05);
    --align-x-hover: rgba(0, 0, 255, 0.1);
    --align-x-active: rgba(0, 0, 255, 0.2);
    --align-y-bg: rgba(255, 0, 0, 0.05);
    --align-y-hover: rgba(255, 0, 0, 0.1);
    --align-y-active: rgba(255, 0, 0, 0.2);

    // Dark mode
    &.dark {
      --dock-bg: #1a1a1a;
      --dock-fg: #e8e8e8;
      --dock-border: #4d4d4d;
      --dock-outline: rgba(255, 255, 255, 0.1);

      --text-primary: #e8e8e8;
      --text-secondary: #999;

      --border-light: #3a3a3a;
      --border-medium: #4a4a4a;

      --input-bg: #2a2a2a;
      --input-text: #e8e8e8;
      --input-placeholder: #666;
      --input-border: #4a4a4a;

      --btn-bg: #3a3a3a;
      --btn-fg: #e8e8e8;
      --btn-hover-bg: #5a5a5a;
      --btn-disabled-bg: #6a6a6a;

      --focus-ring: #7a7cb8;
      --focus-bg: rgba(122, 124, 184, 0.2);

      --color-success-bg: rgba(16, 185, 129, 0.15);

      --mockup-border: #5a5a5a;
      --mockup-border-hover: #e8e8e8;

      --align-x-bg: rgba(120, 170, 240, 0.2);
      --align-x-hover: rgba(120, 170, 240, 0.3);
      --align-x-active: rgba(120, 170, 240, 0.4);
      --align-y-bg: rgba(240, 130, 150, 0.2);
      --align-y-hover: rgba(240, 130, 150, 0.3);
      --align-y-active: rgba(240, 130, 150, 0.4);
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
        transform: scale(0.95);
      }
    }

    svg {
      display: block;
      color: currentColor;
      fill: none;
    }
  }
</style>
