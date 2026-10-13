<script lang="ts">
  // Svelte
  import { onDestroy, onMount } from "svelte";

  // Constants
  import { DRAG_THRESHOLD } from "~/constants";

  // Stores
  import { dockStore } from "~/stores/dockStore.svelte";
  import { keyboardStore } from "~/stores/keyboardStore.svelte";
  import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";

  // Utils
  import { observePageSize } from "~/platform/viewport";
  import { initInputTypeTracking, updateInputType } from "~/utils/device";

  let stopObservingPageSize: (() => void) | null = null;

  // Pointer state for unified handling
  let activePointerId: number | null = null;

  // Touch state for gestures (pinch zoom - not supported by Pointer Events)
  let activeTouchCount = 0;
  let imgElement: HTMLImageElement | null = null;
  let useGestureEvents = false; // Safari Gesture Events support flag
  let isGesturing = false; // Track if we're in a gesture (Safari)
  let gestureListenersAttached = false;

  // Safari GestureEvent type (not in standard TypeScript definitions)
  interface SafariGestureEvent extends UIEvent {
    scale: number;
    rotation: number;
    clientX: number;
    clientY: number;
  }

  /**
   * Reset all pointer/touch-related state to initial values
   * Called when: pointercancel, visibility change, hiding overlay, cleanup
   */
  function resetPointerState() {
    activePointerId = null;
    activeTouchCount = 0;
    isGesturing = false;

    // End any ongoing operations in the store
    if (mockupOverlayStore.mode === "dragging") {
      mockupOverlayStore.endTouchDrag();
    }
    mockupOverlayStore.endPinch();
  }

  /**
   * Remove gesture event listeners from the img element
   */
  function removeGestureListeners() {
    if (!imgElement || !gestureListenersAttached) return;

    if (useGestureEvents) {
      imgElement.removeEventListener("gesturestart", handleGestureStart as EventListener);
      imgElement.removeEventListener("gesturechange", handleGestureChange as EventListener);
      imgElement.removeEventListener("gestureend", handleGestureEnd as EventListener);
    }

    // Touch events for pinch fallback
    imgElement.removeEventListener("touchstart", handleTouchStart);
    imgElement.removeEventListener("touchmove", handleTouchMove);
    imgElement.removeEventListener("touchend", handleTouchEnd);
    imgElement.removeEventListener("touchcancel", handleTouchCancel);

    gestureListenersAttached = false;
  }

  /**
   * Add gesture event listeners to the img element
   * Only for multi-touch gestures (pinch zoom)
   */
  function addGestureListeners() {
    if (!imgElement || gestureListenersAttached) return;

    // Safari Gesture Events (preferred for pinch zoom on iOS/Safari)
    if ("ongesturestart" in window) {
      useGestureEvents = true;
      imgElement.addEventListener("gesturestart", handleGestureStart as EventListener, { passive: false });
      imgElement.addEventListener("gesturechange", handleGestureChange as EventListener, { passive: false });
      imgElement.addEventListener("gestureend", handleGestureEnd as EventListener, { passive: false });
    }

    // Touch events for pinch fallback (non-Safari browsers) and touch count tracking
    imgElement.addEventListener("touchstart", handleTouchStart, { passive: false });
    imgElement.addEventListener("touchmove", handleTouchMove, { passive: false });
    imgElement.addEventListener("touchend", handleTouchEnd, { passive: false });
    imgElement.addEventListener("touchcancel", handleTouchCancel, { passive: false });

    gestureListenersAttached = true;
  }

  /**
   * Handle visibility change - reset state when page becomes hidden
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      resetPointerState();
    }
  }

  onMount(() => {
    initInputTypeTracking();
    mockupOverlayStore.init();
    keyboardStore.init();
    stopObservingPageSize = observePageSize(mockupOverlayStore.setPageSize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onDestroy(() => {
    stopObservingPageSize?.();
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    // Clean up gesture listeners and state
    removeGestureListeners();
    resetPointerState();

    imgElement = null;
    keyboardStore.cleanup();
    mockupOverlayStore.cleanup();
  });

  // Effect to manage gesture listeners based on visibility
  $effect(() => {
    const isVisible = !mockupOverlayStore.isHidden && !!mockupOverlayStore.activeMockupUrl;

    if (!imgElement) return;

    if (isVisible) {
      addGestureListeners();
    } else {
      removeGestureListeners();
      resetPointerState();
    }
  });

  // Svelte action to capture img element reference
  function captureImgElement(node: HTMLImageElement) {
    imgElement = node;

    // Initial setup - add listeners if visible
    if (!mockupOverlayStore.isHidden) {
      addGestureListeners();
    }

    return {
      destroy() {
        removeGestureListeners();
        imgElement = null;
      }
    };
  }

  /**
   * Check if pointer events should be handled on the overlay
   * Only active when dock is in toolbar mode
   */
  let isInteractive = $derived(dockStore.mode === "toolbar");

  // Cursor mapping for different overlay modes
  const CURSOR_MAP: Record<string, string> = {
    dragging: "grabbing",
    solid: "zoom-in",
    zoomed: "zoom-out",
    visible: "grab"
  };

  // Derived interaction styles based on state machine
  let interactionStyles = $derived.by(() => {
    const { mode } = mockupOverlayStore;

    if (!isInteractive) {
      return { cursor: "default", pointerEvents: "none" };
    }

    // Solid mode - full control for pan/pinch
    if (mode === "solid") {
      return {
        cursor: "zoom-in",
        pointerEvents: "auto"
      };
    }

    // Locked mode - allow pointer events for potential double-tap detection
    // The actual interaction is controlled by the event handlers
    if (mode === "locked") {
      return {
        cursor: "default",
        pointerEvents: "auto"
      };
    }

    // Visible/dragging modes - full control
    return {
      cursor: CURSOR_MAP[mode] || "grab",
      pointerEvents: "auto"
    };
  });

  let transform = $derived(
    `translate3d(${mockupOverlayStore.position.x}px, ${mockupOverlayStore.position.y}px, 0) scale(${mockupOverlayStore.scale})`
  );

  // Dynamic touch-action based on mode:
  // - locked: allow native scrolling with momentum (pan-x pan-y)
  // - other modes: disable all browser gestures (none) so JS handles everything
  let touchAction = $derived(mockupOverlayStore.mode === "locked" ? "pan-x pan-y" : "none");

  // Disable transition during dragging, zoom panning, and solid mode for immediate response
  let transition = $derived(
    mockupOverlayStore.isDragging || mockupOverlayStore.isZoomPanning || mockupOverlayStore.mode === "solid"
      ? "none"
      : "transform 0.2s ease-out"
  );

  // ============================================
  // Pointer Event Handlers (Unified mouse/touch/pen)
  // ============================================

  function handlePointerDown(e: PointerEvent) {
    if (!isInteractive) return;

    // Update input type for other parts of the app
    updateInputType(e);

    const { mode } = mockupOverlayStore;

    // In locked mode, don't handle pointer events (let double-tap handle via touch)
    if (mode === "locked") return;

    // For touch input, let touch events handle multi-finger gestures
    // Only use pointer events for single-finger interactions
    if (e.pointerType === "touch") {
      // Don't capture - let touch events handle
      return;
    }

    // Mouse/pen handling
    switch (mode) {
      case "visible":
        activePointerId = e.pointerId;
        mockupOverlayStore.startDrag(e);

        // Capture pointer for drag tracking (may not be available in all environments)
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        break;
      case "solid":
        mockupOverlayStore.enterZoomMode(e);
        break;
      case "zoomed":
        mockupOverlayStore.exitZoomMode();
        break;
    }
  }

  function handlePointerMove(e: PointerEvent) {
    // Pointer move is only used for tracking - actual drag is handled by global mouse events in the store
    // Touch moves are handled by touch events
    if (!isInteractive) return;
    if (e.pointerId !== activePointerId) return;
    if (e.pointerType === "touch") return;

    // No action needed - global mouse move handler in store handles dragging
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isInteractive) return;
    if (e.pointerId !== activePointerId) return;

    // Only handle mouse/pen (touch is handled by touch events)
    if (e.pointerType === "touch") return;

    activePointerId = null;

    // Release pointer capture (may not be available in all environments)
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  function handlePointerCancel(e: PointerEvent) {
    if (e.pointerId === activePointerId) {
      activePointerId = null;
      resetPointerState();
    }
  }

  // ============================================
  // Touch Event Handlers (for gestures and touch-specific behavior)
  // ============================================

  let touchStartPos = { x: 0, y: 0 };

  function handleTouchStart(e: TouchEvent) {
    if (!isInteractive) return;

    const { mode } = mockupOverlayStore;

    // In locked mode, let browser handle scrolling natively
    if (mode === "locked") {
      activeTouchCount = e.touches.length;
      if (activeTouchCount === 1) {
        const touch = e.touches[0];
        touchStartPos = { x: touch.clientX, y: touch.clientY };
      }
      return;
    }

    // For all other modes, prevent default since touch-action: none is set
    e.preventDefault();

    // Reset isGesturing when starting a new touch in solid mode
    if (mode === "solid" && activeTouchCount === 0) {
      isGesturing = false;
    }

    activeTouchCount = e.touches.length;

    if (activeTouchCount === 1) {
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };

      // In visible mode, just record start position - drag will start when movement exceeds threshold
      if (mode === "solid") {
        mockupOverlayStore.startSolidPan(e);
      }
    } else if (activeTouchCount === 2 && mode === "solid" && !useGestureEvents) {
      // Two fingers in solid mode - start pinch (only if not using gesture events)
      mockupOverlayStore.startPinch(e);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isInteractive) return;

    const { mode } = mockupOverlayStore;

    // In locked mode, let browser handle scrolling natively
    if (mode === "locked") {
      return;
    }

    e.preventDefault();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.x);
      const dy = Math.abs(touch.clientY - touchStartPos.y);

      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        // Start drag only when threshold is exceeded
        if (mode === "visible") {
          mockupOverlayStore.startTouchDrag(e);
        }
      }

      if (mode === "dragging") {
        mockupOverlayStore.handleTouchDrag(e);
      } else if (mode === "solid" && !isGesturing) {
        mockupOverlayStore.handleSolidPan(e);
      }
    } else if (e.touches.length === 2 && mode === "solid" && !useGestureEvents) {
      mockupOverlayStore.handlePinch(e);
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isInteractive) return;

    const { mode } = mockupOverlayStore;
    const previousTouchCount = activeTouchCount;
    activeTouchCount = e.touches.length;

    // In locked mode, nothing to do - global handler in App.svelte handles double-tap
    if (mode === "locked") return;

    // End pinch if we had 2 fingers and now have less (only for touch fallback)
    if (!useGestureEvents && previousTouchCount === 2 && activeTouchCount < 2) {
      mockupOverlayStore.endPinch();
    }

    // All fingers lifted
    if (activeTouchCount === 0) {
      if (mode === "dragging") {
        mockupOverlayStore.endTouchDrag();
      }

      isGesturing = false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleTouchCancel(_: TouchEvent) {
    resetPointerState();
  }

  // ============================================
  // Safari Gesture Event Handlers (iOS/Safari only)
  // ============================================

  function handleGestureStart(e: SafariGestureEvent) {
    if (!isInteractive) return;
    if (mockupOverlayStore.mode !== "solid") return;

    e.preventDefault();
    isGesturing = true;

    const centerX = e.clientX + window.scrollX;
    const centerY = e.clientY + window.scrollY;

    mockupOverlayStore.startGesturePinch(centerX, centerY);
  }

  function handleGestureChange(e: SafariGestureEvent) {
    if (!isInteractive) return;
    if (mockupOverlayStore.mode !== "solid") return;

    e.preventDefault();
    mockupOverlayStore.handleGesturePinch(e.scale);
  }

  function handleGestureEnd(e: SafariGestureEvent) {
    if (!isInteractive) return;

    e.preventDefault();
    mockupOverlayStore.endPinch();
  }
</script>

{#if !mockupOverlayStore.isHidden && mockupOverlayStore.activeMockupUrl}
  <div class="mockup-container">
    <img
      use:captureImgElement
      draggable="false"
      class="mockup-overlay"
      src={mockupOverlayStore.activeMockupUrl}
      alt="Mockup Overlay"
      style:transform
      style:transition
      style:cursor={interactionStyles.cursor}
      style:pointer-events={interactionStyles.pointerEvents}
      style:opacity={mockupOverlayStore.effectiveOpacity}
      style:visibility={mockupOverlayStore.mockupSize.width ? undefined : "hidden"}
      style:touch-action={touchAction}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerCancel}
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
