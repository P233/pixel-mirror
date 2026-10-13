<script lang="ts">
  // Svelte
  import { onMount } from "svelte";

  // Features
  import { overlayGestures } from "~/features/overlay/gestures";

  // Platform
  import { observePageSize } from "~/platform/viewport";

  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";

  // The aligned position depends on the page size
  onMount(() => observePageSize(mockupOverlayStore.setPageSize));

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

  let cursor = $derived(isInteractive ? CURSOR_MAP[mockupOverlayStore.mode] : "default");

  // Locked mode keeps pointer events so scrolling over the mockup works with momentum (see touch-action)
  let pointerEvents = $derived(isInteractive ? "auto" : "none");

  let transform = $derived(
    `translate3d(${mockupOverlayStore.position.x}px, ${mockupOverlayStore.position.y}px, 0) scale(${mockupOverlayStore.scale})`
  );

  // Dynamic touch-action based on mode:
  // - locked: allow native scrolling with momentum (pan-x pan-y)
  // - other modes: disable all browser gestures (none) so the gesture handlers get every pointer event
  let touchAction = $derived(mockupOverlayStore.mode === "locked" ? "pan-x pan-y" : "none");

  // Disable transition during dragging, zoom panning, and solid mode for immediate response
  let transition = $derived(
    mockupOverlayStore.isDragging || mockupOverlayStore.isZoomPanning || mockupOverlayStore.mode === "solid"
      ? "none"
      : "transform 0.2s ease-out"
  );
</script>

{#if !mockupOverlayStore.isHidden && mockupOverlayStore.activeMockupUrl}
  <div class="mockup-container">
    <img
      {@attach overlayGestures(mockupOverlayStore, () => isInteractive)}
      draggable="false"
      class="mockup-overlay"
      src={mockupOverlayStore.activeMockupUrl}
      alt="Mockup Overlay"
      style:transform
      style:transition
      style:cursor
      style:pointer-events={pointerEvents}
      style:opacity={mockupOverlayStore.effectiveOpacity}
      style:visibility={mockupOverlayStore.mockupSize.width ? undefined : "hidden"}
      style:touch-action={touchAction}
    />
  </div>
{/if}

<style lang="scss">
  .mockup-container {
    position: absolute;
    inset: 0;
    z-index: $max-z-index - 3;
    overflow: hidden;
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
