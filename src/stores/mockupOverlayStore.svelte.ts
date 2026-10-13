/**
 * Mockup Overlay Store
 *
 * Holds the overlay state and applies user actions to it. The state model and the
 * geometry are pure functions in ~/features/overlay; this store owns the reactive
 * state, persistence and loading the mockup image.
 *
 * Derived 5-state mode (see model.ts):
 * - visible:   Default state. Can drag, adjust opacity, scale, align
 * - locked:    Frozen in place
 * - dragging:  During a drag
 * - solid:     Full opacity for comparison (Space held / mobile double-tap), pinch/pan on mobile
 * - zoomed:    2x zoom with mouse pan (click in solid mode)
 *
 * Transitions:
 * - visible ⇄ locked:          toggleLock (Escape / toolbar)
 * - visible → dragging → visible: drag
 * - visible/locked → solid:    enterSolidMode / toggleMobileSolidMode
 * - solid ⇄ zoomed:            enterZoomMode / exitZoomMode (click)
 * - solid/zoomed → visible/locked: exitSolidMode / toggleMobileSolidMode
 *
 * The rendered position is derived from the placement (alignment or free offset), the image
 * size and the page size, so it stays correct when any of them change. Solid/zoom/pinch only
 * set a temporary view on top, which is discarded on exit.
 */

// Constants
import {
  OPACITY_DEFAULT,
  OPACITY_MAX,
  OPACITY_MIN,
  OPACITY_STEP,
  PINCH_SCALE_MAX,
  PINCH_SCALE_MIN,
  SCALE_OPTIONS,
  ZOOM_FACTOR
} from "~/constants";
// Model
import { focusPoint, resolvePosition } from "~/features/overlay/geometry";
import {
  alignmentX as getAlignmentX,
  alignmentY as getAlignmentY,
  can,
  DEFAULT_PLACEMENT,
  deriveMode,
  describePlacement,
  freePlacement,
  IDLE,
  isAligned as getIsAligned,
  placementFromSettings,
  type Interaction,
  type OverlayMode,
  type Placement,
  type View
} from "~/features/overlay/model";
// Platform
import { readViewportCenter, toPagePoint } from "~/platform/viewport";
// Database
import { getMockup, getSettingsByGroup, updateSetting } from "./database";
// Stores
import { toastStore } from "./toastStore.svelte";
// Utils
import { clamp, roundTo } from "./utils";

export type MockupOverlayMode = OverlayMode;

function createMockupOverlayStore() {
  // Persisted state
  let activeId = $state<string | null>(null);
  let isHidden = $state(false);
  let isLocked = $state(false);
  let opacity = $state(OPACITY_DEFAULT);
  let placement = $state<Placement>(DEFAULT_PLACEMENT);
  let scale = $state(1);

  // Runtime state
  let interaction = $state<Interaction>(IDLE);
  let activeMockupUrl = $state<string | null>(null);
  let activeMockupMetadata = $state<Mockup | undefined>(undefined);
  let mockupSize = $state<Size>({ width: 0, height: 0 });
  let pageSize = $state<Size>({ width: 0, height: 0 });

  const mode = $derived(deriveMode(interaction, isLocked));
  const placedPosition = $derived(resolvePosition(placement, mockupSize, scale, pageSize));
  const transform = $derived.by((): View => {
    if (interaction.kind === "dragging") return { ...interaction.current, scale };
    if (interaction.kind === "inspecting" && interaction.view) return interaction.view;
    return { ...placedPosition, scale };
  });
  const position = $derived<Position>({ x: transform.x, y: transform.y });
  const positionDisplay = $derived(describePlacement(placement, position));

  // Initialization
  let initialized = $state(false);
  let initPromise: Promise<void> | null = null;

  // Incremented on every load so a slow, superseded load can't overwrite a newer one
  let loadToken = 0;

  // Gesture start state (not reactive)
  let pinchStartView: View = { x: 0, y: 0, scale: 1 };
  let pinchCenter: Position = { x: 0, y: 0 };
  let panStart: Position = { x: 0, y: 0 };
  let panStartView: View = { x: 0, y: 0, scale: 1 };

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
          // The aligned position is derived from this size
          mockupSize = { width: img.naturalWidth, height: img.naturalHeight };
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

  function persist<K extends keyof MockupOverlaySettings>(key: K, value: MockupOverlaySettings[K]) {
    updateSetting("mockupOverlay", key, value).catch(toastStore.showError);
  }

  function persistAlignment() {
    persist("alignmentX", getAlignmentX(placement));
    persist("alignmentY", getAlignmentY(placement));
  }

  /** Pin the mockup at a position, dropping any alignment */
  function placeAt(newPosition: Position) {
    const wasAligned = getIsAligned(placement);
    placement = freePlacement(newPosition);
    if (wasAligned) persistAlignment();
  }

  function setAlignmentAxes(x: MockupAlignmentX | undefined, y: MockupAlignmentY | undefined) {
    // An axis that loses its alignment stays where it currently is
    const current = placedPosition;
    placement = {
      x: x === undefined ? placement.x : x === null ? { offset: current.x } : { align: x },
      y: y === undefined ? placement.y : y === null ? { offset: current.y } : { align: y }
    };
  }

  /** The transform currently on screen, as the starting point for a gesture */
  function currentView(): View {
    return { ...transform };
  }

  function setView(view: View | null) {
    if (interaction.kind !== "inspecting") return;
    interaction = { ...interaction, view };
  }

  function enterInspection() {
    interaction = { kind: "inspecting", view: null, zoom: null };
  }

  function exitInspection() {
    if (interaction.kind !== "inspecting") return;
    interaction = IDLE;
  }

  function endDrag() {
    if (interaction.kind !== "dragging") return;

    const finalPosition = interaction.current;
    interaction = IDLE;
    placeAt(finalPosition);
    persist("position", { ...finalPosition });
  }

  /** Scale around the pinch center captured at the start of the pinch */
  function applyPinch(scaleFactor: number) {
    const newScale = clamp(pinchStartView.scale * scaleFactor, PINCH_SCALE_MIN, PINCH_SCALE_MAX);
    const newPosition = focusPoint(pinchStartView, pinchStartView.scale, newScale, pinchCenter);
    setView({ ...newPosition, scale: newScale });
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
      return position;
    },
    get alignmentX() {
      return getAlignmentX(placement);
    },
    get alignmentY() {
      return getAlignmentY(placement);
    },
    get isAligned() {
      return getIsAligned(placement);
    },
    get scale() {
      return transform.scale;
    },
    get mode() {
      return mode;
    },
    get isZoomPanning() {
      return interaction.kind === "inspecting" && !!interaction.zoom?.isPanning;
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
          if (settings.scale !== undefined) scale = settings.scale;
          placementFromStored(settings);

          await loadMockup(activeId);
        } catch (e) {
          toastStore.showError(e, "Failed to load mockup overlay settings");
        } finally {
          initialized = true;
          initPromise = null;
        }
      })();

      return initPromise;
    },

    /** The page area the mockup aligns to; kept up to date by the overlay component */
    setPageSize: (size: Size) => {
      if (size.width !== pageSize.width || size.height !== pageSize.height) pageSize = size;
    },

    // ============================================
    // Mockup management
    // ============================================

    setActiveMockup: (id: string | null) => {
      activeId = id;
      loadMockup(id);

      persist("activeMockupId", id);

      if (id) {
        if (isHidden) {
          isHidden = false;
          persist("isHidden", false);
        }
        if (isLocked) {
          isLocked = false;
          persist("isLocked", false);
        }
      }
    },

    // ============================================
    // Visibility & Lock
    // ============================================
    // Settings use fire-and-forget pattern: local state updates immediately,
    // persistence failure only shows error (recoverable on next session)

    toggleVisibility: () => {
      // Can toggle visibility from any mode, but will exit solid/zoomed first
      exitInspection();

      isHidden = !isHidden;
      persist("isHidden", isHidden);
    },

    toggleLock: () => {
      if (!can.adjustAppearance(mode)) return;

      isLocked = !isLocked;
      persist("isLocked", isLocked);
    },

    // ============================================
    // Opacity (in visible or locked mode)
    // ============================================

    adjustOpacity: (direction: number) => {
      if (!can.adjustAppearance(mode)) return;

      const delta = direction > 0 ? -OPACITY_STEP : OPACITY_STEP;
      opacity = clamp(roundTo(opacity + delta, 2), OPACITY_MIN, OPACITY_MAX);
      persist("opacity", opacity);
    },

    resetOpacity: () => {
      if (!can.adjustAppearance(mode)) return;

      opacity = OPACITY_DEFAULT;
      persist("opacity", opacity);
    },

    /**
     * Set opacity directly (for mobile slider)
     */
    setOpacity: (value: number) => {
      if (!can.adjustAppearance(mode)) return;

      opacity = clamp(roundTo(value, 2), OPACITY_MIN, OPACITY_MAX);
      persist("opacity", opacity);
    },

    // ============================================
    // Scale (only in visible mode)
    // ============================================

    cycleScale: () => {
      if (!can.reposition(mode)) return;

      const currentIndex = SCALE_OPTIONS.indexOf(scale as (typeof SCALE_OPTIONS)[number]);
      const newScale = SCALE_OPTIONS[(currentIndex + 1) % SCALE_OPTIONS.length];

      // Keep the point at the center of the viewport fixed
      const center = readViewportCenter();
      const newPosition = focusPoint(placedPosition, scale, newScale, center);

      scale = newScale;
      placeAt(newPosition);
      persist("scale", scale);
      persist("position", { ...newPosition });
    },

    // ============================================
    // Alignment (only in visible mode)
    // ============================================

    setAlignmentX: (value: MockupAlignmentX) => {
      if (!can.reposition(mode)) return;

      setAlignmentAxes(value, undefined);
      persist("alignmentX", value);
    },

    setAlignmentY: (value: MockupAlignmentY) => {
      if (!can.reposition(mode)) return;

      setAlignmentAxes(undefined, value);
      persist("alignmentY", value);
    },

    setAlignment: (y: MockupAlignmentY, x: MockupAlignmentX) => {
      if (!can.reposition(mode)) return;

      setAlignmentAxes(x, y);
      persistAlignment();
    },

    clearAlignment: () => {
      if (!can.reposition(mode)) return;
      placeAt(placedPosition);
    },

    // ============================================
    // Movement (only in visible mode)
    // ============================================

    move: (dx: number, dy: number) => {
      if (!can.reposition(mode)) return;

      placeAt({ x: placedPosition.x + dx, y: placedPosition.y + dy });
    },

    persistPosition: () => {
      persist("position", { ...placedPosition });
    },

    // ============================================
    // Gestures
    // ============================================
    // Points are client (viewport) coordinates, as reported by pointer events.
    // The gesture layer (features/overlay/gestures.ts) decides which of these to call.

    /** Start moving the mockup (visible mode only) */
    beginDrag: (point: Position) => {
      if (!can.reposition(mode)) return;

      interaction = {
        kind: "dragging",
        pointerStart: point,
        origin: { ...placedPosition },
        current: { ...placedPosition }
      };
    },

    dragTo: (point: Position) => {
      if (interaction.kind !== "dragging") return;

      const { pointerStart, origin } = interaction;
      interaction = {
        ...interaction,
        current: { x: origin.x + point.x - pointerStart.x, y: origin.y + point.y - pointerStart.y }
      };
    },

    /** Finish the drag: the mockup stays where it was dropped, unaligned */
    endDrag,

    /** Solid mode, one finger: the mockup follows the finger */
    beginPan: (point: Position) => {
      if (mode !== "solid") return;

      panStart = point;
      panStartView = currentView();
    },

    panTo: (point: Position) => {
      if (mode !== "solid") return;

      setView({ ...panStartView, x: panStartView.x + point.x - panStart.x, y: panStartView.y + point.y - panStart.y });
    },

    /** Solid mode, two fingers: zoom around the point between them */
    beginPinch: (center: Position) => {
      if (mode !== "solid") return;

      pinchStartView = currentView();
      pinchCenter = toPagePoint(center.x, center.y);
    },

    /** @param scaleFactor current finger distance / distance at the start of the pinch */
    pinchTo: (scaleFactor: number) => {
      if (mode !== "solid") return;
      applyPinch(scaleFactor);
    },

    // ============================================
    // Solid Mode (from visible or locked)
    // ============================================

    enterSolidMode: () => {
      if (!can.adjustAppearance(mode)) return;
      enterInspection();
    },

    exitSolidMode: exitInspection,

    /**
     * Toggle solid mode on touch devices (double tap)
     */
    toggleMobileSolidMode: () => {
      if (mode === "solid") {
        exitInspection();
      } else if (can.adjustAppearance(mode)) {
        enterInspection();
      }
    },

    // ============================================
    // Zoom Mode (desktop, only from solid mode)
    // ============================================

    /** Zoom in 2x, bringing the clicked point to the center of the viewport */
    enterZoomMode: (point: Position) => {
      if (interaction.kind !== "inspecting" || !can.zoom(mode)) return;

      const from = currentView();
      const zoomScale = from.scale * ZOOM_FACTOR;
      const zoomed = focusPoint(from, from.scale, zoomScale, toPagePoint(point.x, point.y), readViewportCenter());

      interaction = {
        kind: "inspecting",
        view: { ...zoomed, scale: zoomScale },
        zoom: { returnTo: interaction.view, pointerStart: point, origin: zoomed, isPanning: false }
      };
    },

    exitZoomMode: () => {
      if (interaction.kind !== "inspecting" || !interaction.zoom) return;

      interaction = { kind: "inspecting", view: interaction.zoom.returnTo, zoom: null };
    },

    /** Mouse moves while zoomed: inverse direction, like moving the viewport over the mockup */
    zoomPanTo: (point: Position) => {
      if (interaction.kind !== "inspecting" || !interaction.zoom || !interaction.view) return;

      const { zoom, view } = interaction;
      interaction = {
        ...interaction,
        zoom: { ...zoom, isPanning: true },
        view: {
          ...view,
          x: zoom.origin.x - (point.x - zoom.pointerStart.x),
          y: zoom.origin.y - (point.y - zoom.pointerStart.y)
        }
      };
    }
  };

  function placementFromStored(settings: Partial<MockupOverlaySettings>) {
    const storedPosition = settings.position ?? { x: 0, y: 0 };
    placement = placementFromSettings(
      settings.alignmentX === undefined ? getAlignmentX(DEFAULT_PLACEMENT) : settings.alignmentX,
      settings.alignmentY === undefined ? getAlignmentY(DEFAULT_PLACEMENT) : settings.alignmentY,
      storedPosition
    );
  }
}

export const mockupOverlayStore = createMockupOverlayStore();
