<script lang="ts">
  // Svelte
  import { onMount } from "svelte";
  import { on } from "svelte/events";

  // Features
  import { overlayGestures } from "~/features/overlay/gestures";

  // Platform
  import { observePageSize } from "~/platform/viewport";

  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { overlayController } from "~/features/overlay/controller.svelte";

  let scrollPosition = $state({ x: window.scrollX, y: window.scrollY });

  onMount(() => {
    const stopSize = observePageSize((size) => overlayController.setPageSize(size));
    const updateScroll = () => {
      scrollPosition = { x: window.scrollX, y: window.scrollY };
    };
    updateScroll();
    const stopScroll = on(window, "scroll", updateScroll, { passive: true });
    return () => {
      stopSize();
      stopScroll();
    };
  });

  /**
   * Pointer events on the overlay are only handled when the dock is in toolbar mode
   */
  let isInteractive = $derived(dockStore.mode === "toolbar");

  // Cursor mapping for different overlay modes
  const CURSOR_MAP: Record<string, string> = {
    dragging: "grabbing",
    solid: "zoom-in",
    zoomed: "zoom-out",
    visible: "grab",
    locked: "default"
  };

  let cursor = $derived(isInteractive ? CURSOR_MAP[overlayController.mode] : "default");

  // Locked mode uses pointer-events: none so clicks, hovers, and scrolling pass through to the host page
  let pointerEvents = $derived(isInteractive && overlayController.mode !== "locked" ? "auto" : "none");

  let transform = $derived(
    `translate3d(${overlayController.position.x}px, ${overlayController.position.y}px, 0) scale(${overlayController.scale})`
  );

  // Dynamic touch-action based on mode:
  // - locked: allow native scrolling with momentum (pan-x pan-y)
  // - other modes: disable all browser gestures (none) so the gesture handlers get every pointer event
  let touchAction = $derived(overlayController.mode === "locked" ? "pan-x pan-y" : "none");

  // Disable transition during dragging, zoom panning, and solid mode for immediate response
  let transition = $derived(
    overlayController.isDragging || overlayController.isZoomPanning || overlayController.mode === "solid"
      ? "none"
      : "transform 0.2s ease-out"
  );
</script>

{#if !overlayController.isHidden && overlayController.activeMockupUrl}
  <div class="mockup-viewport">
    <div
      class="mockup-document"
      style:width={`${overlayController.pageSize.width}px`}
      style:height={`${overlayController.pageSize.height}px`}
      style:transform={`translate3d(${-scrollPosition.x}px, ${-scrollPosition.y}px, 0)`}
    >
      <img
        {@attach overlayGestures(overlayController, () => isInteractive)}
        draggable="false"
        class="mockup-overlay"
        src={overlayController.activeMockupUrl}
        alt="Mockup Overlay"
        style:transform
        style:transition
        style:cursor
        style:pointer-events={pointerEvents}
        style:opacity={overlayController.effectiveOpacity}
        style:visibility={overlayController.mockupSize.width ? undefined : "hidden"}
        style:touch-action={touchAction}
      />
    </div>
  </div>
{/if}

<style lang="scss">
  // A fixed clip keeps the document-sized alignment layer out of host layout.
  .mockup-viewport {
    position: fixed;
    inset: 0;
    z-index: $max-z-index - 3;
    overflow: hidden;
    overflow: clip;
    pointer-events: none;
  }

  .mockup-document {
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
    overflow: clip;
    pointer-events: none;
  }

  .mockup-overlay {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    // touch-action is set dynamically via inline style based on mode
    -webkit-user-select: none;
    user-select: none;
    transform-origin: top left;
    backface-visibility: hidden;
    will-change: transform;

    // Mobile touch behavior
    -webkit-touch-callout: none;
  }
</style>
