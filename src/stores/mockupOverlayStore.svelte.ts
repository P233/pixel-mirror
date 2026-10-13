/**
 * Mockup Overlay Store
 *
 * State Machine for Mockup Overlay:
 *
 * States:
 * - visible:   Default state. Can drag, adjust opacity, scale, align
 * - locked:    Frozen in place, no pointer events
 * - dragging:  During drag operation, only drag-related events active
 * - solid:     Full opacity, preparing for zoom (Space key held)
 * - zoomed:    2x zoom with pan capability (Click in solid mode)
 *
 * Transitions:
 * - visible → dragging:  Mouse down on overlay
 * - dragging → visible:  Mouse up
 * - visible → locked:    Escape key or toggle lock
 * - locked → visible:    Escape key or toggle lock
 * - visible → solid:     Space key down
 * - locked → solid:      Space key down
 * - solid → visible:     Space key up (if was visible)
 * - solid → locked:      Space key up (if was locked)
 * - solid → zoomed:      Mouse click
 * - zoomed → solid:      Mouse click
 * - zoomed → visible:    Space key up (if was visible)
 * - zoomed → locked:     Space key up (if was locked)
 *
 * Event Availability by State:
 * - visible:  drag, opacity, scale, align, move (arrow keys)
 * - locked:   none (can only toggle lock or enter solid)
 * - dragging: only drag movement
 * - solid:    only zoom enter (click)
 * - zoomed:   only zoom exit (click) or pan (mouse move)
 */

// Constants
import { OPACITY_DEFAULT, OPACITY_MAX, OPACITY_MIN, OPACITY_STEP, SCALE_OPTIONS, ZOOM_FACTOR } from "~/constants";
// Database
import { getMockup, getSettingsByGroup, updateSetting } from "./database";
// Stores
import { toastStore } from "./toastStore.svelte";
// Utils
import { clamp, roundTo } from "./utils";

export type MockupOverlayMode = "visible" | "locked" | "dragging" | "solid" | "zoomed";

function createMockupOverlayStore() {
  // Persisted state
  let activeId = $state<string | null>(null);
  let isHidden = $state(false);
  let isLocked = $state(false);
  let opacity = $state(OPACITY_DEFAULT);
  let persistedPosition = $state<Position>({ x: 0, y: 0 });
  let alignmentX = $state<MockupAlignmentX>("center");
  let alignmentY = $state<MockupAlignmentY>("top");
  let scale = $state(1);

  // Runtime state
  let mode = $state<MockupOverlayMode>("visible");
  let activeMockupUrl = $state<string | null>(null);
  let activeMockupMetadata = $state<Mockup | undefined>(undefined);
  let mockupSize = $state<Size>({ width: 0, height: 0 });
  let bufferedPosition = $state<Position>({ x: 0, y: 0 });
  let isZoomPanning = $state(false);

  // Track mode before entering solid/zoomed to restore correctly
  let modeBeforeSolid = $state<"visible" | "locked">("visible");

  // Derived position display - uses $derived for proper reactivity tracking
  // eslint-disable-next-line prefer-const
  let positionDisplay = $derived.by(() => {
    if (alignmentX === null && alignmentY === null) {
      return `x:${Math.round(bufferedPosition.x)}, y:${Math.round(bufferedPosition.y)}`;
    }
    const parts: string[] = [];
    if (alignmentY) parts.push(alignmentY);
    if (alignmentX) parts.push(alignmentX);
    return parts.join("·");
  });

  // Initialization
  let initialized = $state(false);
  let initPromise: Promise<void> | null = null;

  // Drag state (not reactive)
  let dragStart = { x: 0, y: 0 };
  let initialPosition = { x: 0, y: 0 };

  // Zoom state (not reactive)
  let zoomInitialPosition = { x: 0, y: 0 };
  let zoomMouseStart = { x: 0, y: 0 };
  let preZoomScale = 1;
  let preZoomPosition = { x: 0, y: 0 };

  // Incremented on every load so a slow, superseded load can't overwrite a newer one
  let loadToken = 0;

  // Mobile touch state (not reactive)
  let touchDragStart = { x: 0, y: 0 };
  let touchInitialPosition = { x: 0, y: 0 };
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchCenter = { x: 0, y: 0 }; // Fixed center point for pinch
  let pinchStartPosition = { x: 0, y: 0 }; // Position at pinch start
  let solidPanStart = { x: 0, y: 0 };
  let solidPanInitialPosition = { x: 0, y: 0 };

  // Snapshot taken when entering solid mode, restored on exit (desktop and mobile)
  let preSolidScale = 1;
  let preSolidPosition = { x: 0, y: 0 };

  // ============================================
  // Internal helpers
  // ============================================

  async function loadMockup(id: string | null) {
    const token = ++loadToken;

    if (!id) {
      if (activeMockupUrl) URL.revokeObjectURL(activeMockupUrl);
      activeMockupUrl = null;
      activeMockupMetadata = undefined;
      mockupSize = { width: 0, height: 0 };
      return;
    }

    if (activeMockupMetadata?.id === id && activeMockupUrl) return;

    try {
      const mockup = await getMockup(id);
      if (token !== loadToken) return;

      if (mockup) {
        if (activeMockupUrl) URL.revokeObjectURL(activeMockupUrl);
        const blob = new Blob([mockup.originalBuffer], { type: mockup.mimeType });
        const newUrl = URL.createObjectURL(blob);
        activeMockupUrl = newUrl;
        activeMockupMetadata = mockup;

        const img = new Image();
        img.onload = () => {
          if (token !== loadToken) return;
          mockupSize = { width: img.naturalWidth, height: img.naturalHeight };
          // The aligned position depends on the image size, which is only known now
          updateAlignedPosition();
        };
        img.onerror = () => {
          if (token !== loadToken) return;
          toastStore.showError(new Error(`Failed to load mockup image.`));
          mockupSize = { width: 0, height: 0 };
        };
        img.src = newUrl;
      } else {
        toastStore.showError(new Error(`Mockup not found.`));
        activeMockupUrl = null;
        activeMockupMetadata = undefined;
        mockupSize = { width: 0, height: 0 };
      }
    } catch (e) {
      if (token !== loadToken) return;
      toastStore.showError(e, "Failed to load mockup");
      activeMockupUrl = null;
      activeMockupMetadata = undefined;
      mockupSize = { width: 0, height: 0 };
    }
  }

  function updateAlignedPosition() {
    if (alignmentX === null && alignmentY === null) return;

    const { clientWidth, scrollHeight } = document.documentElement;
    const scaledWidth = mockupSize.width * scale;
    const scaledHeight = mockupSize.height * scale;

    let newX = bufferedPosition.x;
    let newY = bufferedPosition.y;

    if (alignmentX !== null) {
      switch (alignmentX) {
        case "left":
          newX = 0;
          break;
        case "center":
          newX = ((clientWidth - scaledWidth) / 2) | 0;
          break;
        case "right":
          newX = clientWidth - scaledWidth;
          break;
      }
    }

    if (alignmentY !== null) {
      switch (alignmentY) {
        case "top":
          newY = 0;
          break;
        case "bottom":
          newY = scrollHeight - scaledHeight;
          break;
      }
    }

    if (newX !== bufferedPosition.x || newY !== bufferedPosition.y) {
      bufferedPosition = { x: newX, y: newY };
      persistedPosition = { x: newX, y: newY };
      updateSetting("mockupOverlay", "position", { ...persistedPosition }).catch(toastStore.showError);
    }
  }

  function clearAlignmentInternal() {
    if (alignmentX !== null || alignmentY !== null) {
      alignmentX = null;
      alignmentY = null;
      Promise.all([
        updateSetting("mockupOverlay", "alignmentX", null),
        updateSetting("mockupOverlay", "alignmentY", null)
      ]).catch(toastStore.showError);
    }
  }

  // ============================================
  // Event handlers
  // ============================================

  function handleGlobalMouseMove(e: MouseEvent) {
    if (mode !== "dragging") return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    bufferedPosition = {
      x: initialPosition.x + dx,
      y: initialPosition.y + dy
    };
  }

  function handleGlobalMouseUp() {
    if (mode !== "dragging") return;

    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);

    mode = "visible";
    clearAlignmentInternal();

    persistedPosition = { ...bufferedPosition };
    updateSetting("mockupOverlay", "position", { ...persistedPosition }).catch(toastStore.showError);
  }

  function handleZoomModeMove(e: MouseEvent) {
    if (mode !== "zoomed") return;

    if (!isZoomPanning) {
      isZoomPanning = true;
    }

    const dx = e.clientX - zoomMouseStart.x;
    const dy = e.clientY - zoomMouseStart.y;

    bufferedPosition = {
      x: zoomInitialPosition.x - dx,
      y: zoomInitialPosition.y - dy
    };
  }

  function enterInspection() {
    modeBeforeSolid = mode as "visible" | "locked";
    preSolidScale = scale;
    preSolidPosition = { ...bufferedPosition };
    mode = "solid";
  }

  function exitInspection() {
    if (mode !== "solid" && mode !== "zoomed") return;

    window.removeEventListener("mousemove", handleZoomModeMove);
    isZoomPanning = false;
    scale = preSolidScale;
    bufferedPosition = { ...preSolidPosition };
    mode = modeBeforeSolid;
  }

  // ============================================
  // Public API
  // ============================================

  return {
    // Getters
    get initialized() {
      return initialized;
    },
    get activeMockupId() {
      return activeId;
    },
    get activeMockupUrl() {
      return activeMockupUrl;
    },
    get mockupSize() {
      return mockupSize;
    },
    get isHidden() {
      return isHidden;
    },
    get isLocked() {
      return isLocked;
    },
    get opacity() {
      return opacity;
    },
    get position() {
      return bufferedPosition;
    },
    get alignmentX() {
      return alignmentX;
    },
    get alignmentY() {
      return alignmentY;
    },
    get isAligned() {
      return alignmentX !== null || alignmentY !== null;
    },
    get scale() {
      return scale;
    },
    get mode() {
      return mode;
    },
    get isZoomPanning() {
      return isZoomPanning;
    },
    get isDragging() {
      return mode === "dragging";
    },
    get isSolidOrZoomed() {
      return mode === "solid" || mode === "zoomed";
    },
    get isVisibleOrLocked() {
      return mode === "visible" || mode === "locked";
    },
    get effectiveOpacity() {
      return mode === "solid" || mode === "zoomed" ? 1 : opacity;
    },
    get positionDisplay() {
      return positionDisplay;
    },

    // ============================================
    // Initialization
    // ============================================

    init: async () => {
      if (initialized || initPromise) return initPromise;

      initPromise = (async () => {
        try {
          const settings = await getSettingsByGroup("mockupOverlay");

          if (settings.activeMockupId !== undefined) activeId = settings.activeMockupId;
          if (settings.isHidden !== undefined) isHidden = settings.isHidden;
          if (settings.isLocked !== undefined) isLocked = settings.isLocked;
          if (settings.opacity !== undefined) opacity = settings.opacity;
          if (settings.position !== undefined) {
            persistedPosition = settings.position;
            bufferedPosition = { ...settings.position };
          }
          if (settings.alignmentX !== undefined) alignmentX = settings.alignmentX;
          if (settings.alignmentY !== undefined) alignmentY = settings.alignmentY;
          if (settings.scale !== undefined) scale = settings.scale;

          await loadMockup(activeId);
          mode = isLocked ? "locked" : "visible";
          modeBeforeSolid = mode;
        } catch (e) {
          toastStore.showError(e, "Failed to load mockup overlay settings");
        } finally {
          initialized = true;
          initPromise = null;
        }
      })();

      return initPromise;
    },

    // ============================================
    // Mockup management
    // ============================================

    setActiveMockup: (id: string | null) => {
      activeId = id;
      loadMockup(id);

      const updates: Promise<void>[] = [updateSetting("mockupOverlay", "activeMockupId", id)];

      if (id) {
        if (isHidden) {
          isHidden = false;
          updates.push(updateSetting("mockupOverlay", "isHidden", false));
        }
        if (isLocked) {
          isLocked = false;
          mode = "visible";
          modeBeforeSolid = "visible";
          updates.push(updateSetting("mockupOverlay", "isLocked", false));
        }
      }

      Promise.all(updates).catch(toastStore.showError);
    },

    // ============================================
    // Visibility & Lock (only in visible/locked mode)
    // ============================================
    // Settings use fire-and-forget pattern: local state updates immediately,
    // persistence failure only shows error (recoverable on next session)

    toggleVisibility: () => {
      // Can toggle visibility from any mode, but will exit solid/zoomed first
      exitInspection();

      isHidden = !isHidden;
      updateSetting("mockupOverlay", "isHidden", isHidden).catch(toastStore.showError);
    },

    toggleLock: () => {
      // Can only toggle lock in visible or locked mode
      if (mode !== "visible" && mode !== "locked") return;

      isLocked = !isLocked;
      mode = isLocked ? "locked" : "visible";
      modeBeforeSolid = mode;
      updateSetting("mockupOverlay", "isLocked", isLocked).catch(toastStore.showError);
    },

    // ============================================
    // Opacity (in visible or locked mode)
    // ============================================

    adjustOpacity: (direction: number) => {
      if (mode !== "visible" && mode !== "locked") return;

      const delta = direction > 0 ? -OPACITY_STEP : OPACITY_STEP;
      const newOpacity = roundTo(opacity + delta, 2);
      opacity = clamp(newOpacity, OPACITY_MIN, OPACITY_MAX);
      updateSetting("mockupOverlay", "opacity", opacity).catch(toastStore.showError);
    },

    resetOpacity: () => {
      if (mode !== "visible" && mode !== "locked") return;

      opacity = OPACITY_DEFAULT;
      updateSetting("mockupOverlay", "opacity", opacity).catch(toastStore.showError);
    },

    // ============================================
    // Scale (only in visible mode)
    // ============================================

    cycleScale: () => {
      if (mode !== "visible") return;

      const oldScale = scale;
      const currentIndex = SCALE_OPTIONS.indexOf(oldScale as (typeof SCALE_OPTIONS)[number]);
      const nextIndex = (currentIndex + 1) % SCALE_OPTIONS.length;
      const newScale = SCALE_OPTIONS[nextIndex >= 0 ? nextIndex : 0];

      const { clientWidth, clientHeight } = document.documentElement;
      const centerX = window.scrollX + clientWidth / 2;
      const centerY = window.scrollY + clientHeight / 2;

      const { x, y } = bufferedPosition;

      const newX = centerX - ((centerX - x) / oldScale) * newScale;
      const newY = centerY - ((centerY - y) / oldScale) * newScale;

      scale = newScale;
      bufferedPosition = { x: newX, y: newY };
      persistedPosition = { x: newX, y: newY };

      clearAlignmentInternal();
      Promise.all([
        updateSetting("mockupOverlay", "scale", scale),
        updateSetting("mockupOverlay", "position", { ...persistedPosition })
      ]).catch(toastStore.showError);
    },

    // ============================================
    // Alignment (only in visible mode)
    // ============================================

    setAlignmentX: (value: MockupAlignmentX) => {
      if (mode !== "visible") return;

      alignmentX = value;
      updateSetting("mockupOverlay", "alignmentX", value).catch(toastStore.showError);
      updateAlignedPosition();
    },

    setAlignmentY: (value: MockupAlignmentY) => {
      if (mode !== "visible") return;

      alignmentY = value;
      updateSetting("mockupOverlay", "alignmentY", value).catch(toastStore.showError);
      updateAlignedPosition();
    },

    setAlignment: (y: MockupAlignmentY, x: MockupAlignmentX) => {
      if (mode !== "visible") return;

      alignmentY = y;
      alignmentX = x;
      Promise.all([
        updateSetting("mockupOverlay", "alignmentY", y),
        updateSetting("mockupOverlay", "alignmentX", x)
      ]).catch(toastStore.showError);
      updateAlignedPosition();
    },

    clearAlignment: () => {
      if (mode !== "visible") return;
      clearAlignmentInternal();
    },

    updateAlignedPosition,

    // ============================================
    // Movement (only in visible mode)
    // ============================================

    move: (dx: number, dy: number) => {
      if (mode !== "visible") return;

      clearAlignmentInternal();

      bufferedPosition = {
        x: bufferedPosition.x + dx,
        y: bufferedPosition.y + dy
      };
    },

    persistPosition: () => {
      persistedPosition = { ...bufferedPosition };
      updateSetting("mockupOverlay", "position", { ...persistedPosition }).catch(toastStore.showError);
    },

    // ============================================
    // Drag (only from visible mode)
    // ============================================

    startDrag: (e: MouseEvent) => {
      if (mode !== "visible") return;

      mode = "dragging";
      dragStart = { x: e.clientX, y: e.clientY };
      initialPosition = { ...bufferedPosition };

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
    },

    // ============================================
    // Solid Mode (from visible or locked)
    // ============================================

    enterSolidMode: () => {
      if (mode !== "visible" && mode !== "locked") return;

      enterInspection();
    },

    exitSolidMode: exitInspection,

    // ============================================
    // Zoom Mode (only from solid mode)
    // ============================================

    enterZoomMode: (e: MouseEvent) => {
      if (mode !== "solid") return;

      mode = "zoomed";
      preZoomScale = scale;
      preZoomPosition = { ...bufferedPosition };
      const zoomScale = scale * ZOOM_FACTOR;
      scale = zoomScale;

      const { clientX, clientY } = e;
      const { x, y } = bufferedPosition;

      const pageX = clientX + window.scrollX;
      const pageY = clientY + window.scrollY;

      // Calculate point on mockup that was clicked
      const mockupPointX = (pageX - x) / preZoomScale;
      const mockupPointY = (pageY - y) / preZoomScale;

      // Calculate screen center
      const { clientWidth, clientHeight } = document.documentElement;
      const centerX = window.scrollX + clientWidth / 2;
      const centerY = window.scrollY + clientHeight / 2;

      // Position mockup so clicked point is at screen center
      zoomInitialPosition = {
        x: centerX - mockupPointX * zoomScale,
        y: centerY - mockupPointY * zoomScale
      };
      zoomMouseStart = { x: clientX, y: clientY };

      bufferedPosition = { ...zoomInitialPosition };

      window.addEventListener("mousemove", handleZoomModeMove);
    },

    exitZoomMode: () => {
      if (mode !== "zoomed") return;

      window.removeEventListener("mousemove", handleZoomModeMove);
      mode = "solid";
      scale = preZoomScale;
      bufferedPosition = { ...preZoomPosition };
      isZoomPanning = false;
    },

    // ============================================
    // Cleanup
    // ============================================

    cleanup: () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleZoomModeMove);
      // The active object URL is kept: the store outlives component mounts, and a remount reuses it
    },

    // ============================================
    // Mobile Touch Methods
    // ============================================
    // Mobile state machine (simplified):
    // - visible ⇄ locked ⇄ dragging ⇄ solid (with pinch zoom)
    // - No zoomed state on mobile
    // - Double tap to toggle solid mode
    // - Single finger drag in visible mode
    // - Pinch to zoom in solid mode
    // - Single finger pan in solid mode (follows finger direction)

    /**
     * Set opacity directly (for mobile slider)
     */
    setOpacity: (value: number) => {
      if (mode !== "visible" && mode !== "locked") return;

      opacity = clamp(roundTo(value, 2), OPACITY_MIN, OPACITY_MAX);
      updateSetting("mockupOverlay", "opacity", opacity).catch(toastStore.showError);
    },

    /**
     * Start touch drag (visible mode only)
     */
    startTouchDrag: (e: TouchEvent) => {
      if (mode !== "visible") return;

      const touch = e.touches[0];
      mode = "dragging";
      touchDragStart = { x: touch.clientX, y: touch.clientY };
      touchInitialPosition = { ...bufferedPosition };
    },

    /**
     * Handle touch drag movement
     */
    handleTouchDrag: (e: TouchEvent) => {
      if (mode !== "dragging") return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchDragStart.x;
      const dy = touch.clientY - touchDragStart.y;

      bufferedPosition = {
        x: touchInitialPosition.x + dx,
        y: touchInitialPosition.y + dy
      };
    },

    /**
     * End touch drag - persist position
     */
    endTouchDrag: () => {
      if (mode !== "dragging") return;

      mode = "visible";
      clearAlignmentInternal();

      persistedPosition = { ...bufferedPosition };
      updateSetting("mockupOverlay", "position", { ...persistedPosition }).catch(toastStore.showError);
    },

    /**
     * Toggle solid mode on mobile (double tap)
     */
    toggleMobileSolidMode: () => {
      if (mode === "solid") {
        exitInspection();
      } else if (mode === "visible" || mode === "locked") {
        enterInspection();
      }
    },

    /**
     * Start pinch zoom (solid mode, 2 fingers) - Touch Events fallback
     */
    startPinch: (e: TouchEvent) => {
      if (mode !== "solid" || e.touches.length < 2) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;

      pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
      pinchStartScale = scale;
      pinchStartPosition = { ...bufferedPosition };

      // Fix the center point at pinch start (in page coordinates)
      pinchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2 + window.scrollX,
        y: (touch1.clientY + touch2.clientY) / 2 + window.scrollY
      };
    },

    /**
     * Handle pinch zoom - Touch Events fallback
     */
    handlePinch: (e: TouchEvent) => {
      if (mode !== "solid" || e.touches.length < 2 || pinchStartDistance === 0) return;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;

      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const scaleRatio = currentDistance / pinchStartDistance;
      const newScale = clamp(pinchStartScale * scaleRatio, 0.25, 4);

      // Calculate the point on the mockup that was at the pinch center
      const pointX = (pinchCenter.x - pinchStartPosition.x) / pinchStartScale;
      const pointY = (pinchCenter.y - pinchStartPosition.y) / pinchStartScale;

      // Keep that point at the same screen position
      bufferedPosition = {
        x: pinchCenter.x - pointX * newScale,
        y: pinchCenter.y - pointY * newScale
      };

      scale = newScale;
    },

    /**
     * End pinch - reset pinch state
     */
    endPinch: () => {
      pinchStartDistance = 0;
      pinchStartScale = scale;
    },

    // ============================================
    // Safari Gesture Events (preferred on iOS/Safari)
    // ============================================
    // These events provide e.scale directly, smoother than calculating from touch points

    /**
     * Start gesture pinch (Safari Gesture Events)
     * @param centerX - center X coordinate of the gesture (in page coordinates)
     * @param centerY - center Y coordinate of the gesture (in page coordinates)
     */
    startGesturePinch: (centerX: number, centerY: number) => {
      if (mode !== "solid") return;

      pinchStartScale = scale;
      pinchStartPosition = { ...bufferedPosition };
      pinchCenter = { x: centerX, y: centerY };
    },

    /**
     * Handle gesture pinch (Safari Gesture Events)
     * @param gestureScale - cumulative scale from gesture start (e.scale from GestureEvent)
     */
    handleGesturePinch: (gestureScale: number) => {
      if (mode !== "solid") return;

      const newScale = clamp(pinchStartScale * gestureScale, 0.25, 4);

      // Calculate the point on the mockup that was at the pinch center
      const pointX = (pinchCenter.x - pinchStartPosition.x) / pinchStartScale;
      const pointY = (pinchCenter.y - pinchStartPosition.y) / pinchStartScale;

      // Keep that point at the same screen position
      bufferedPosition = {
        x: pinchCenter.x - pointX * newScale,
        y: pinchCenter.y - pointY * newScale
      };

      scale = newScale;
    },

    /**
     * Start solid mode pan (single finger in solid mode)
     */
    startSolidPan: (e: TouchEvent) => {
      if (mode !== "solid") return;

      const touch = e.touches[0];
      solidPanStart = { x: touch.clientX, y: touch.clientY };
      solidPanInitialPosition = { ...bufferedPosition };
    },

    /**
     * Handle solid mode pan - follows finger direction (same direction)
     */
    handleSolidPan: (e: TouchEvent) => {
      if (mode !== "solid") return;

      const touch = e.touches[0];
      const dx = touch.clientX - solidPanStart.x;
      const dy = touch.clientY - solidPanStart.y;

      // Same direction - finger moves up, image moves up
      bufferedPosition = {
        x: solidPanInitialPosition.x + dx,
        y: solidPanInitialPosition.y + dy
      };
    }
  };
}

export const mockupOverlayStore = createMockupOverlayStore();
