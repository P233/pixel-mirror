/**
 * Overlay Controller
 *
 * Holds the overlay state and applies user actions to it. The state model and the
 * geometry are pure functions in ~/features/overlay; this store owns the reactive
 * interaction state and loading the mockup image. Persistent state belongs to mockupStore.
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
  deriveMode,
  describePlacement,
  freePlacement,
  IDLE,
  isAligned as getIsAligned,
  moveAlongAxes,
  placementFromSettings,
  type Interaction,
  type Placement,
  type View
} from "~/features/overlay/model";
// Platform
import { mockupStore } from "~/stores/mockupStore.svelte";
import { readViewportCenter, toPagePoint } from "~/platform/viewport";
// Database
import { getMockupImage } from "~/platform/database";
// Stores
import { toastStore } from "~/stores/toastStore.svelte";
// Utils
import { clamp, roundTo } from "~/stores/utils";

function createOverlayController() {
  const settings = {
    get current() {
      return mockupStore.appearance;
    },
    update: mockupStore.updateAppearance
  };
  const isHidden = $derived(settings.current.isHidden);
  const isLocked = $derived(settings.current.isLocked);
  const opacity = $derived(settings.current.opacity);
  const scale = $derived(settings.current.scale);
  const placement = $derived(
    placementFromSettings(settings.current.alignmentX, settings.current.alignmentY, settings.current.position)
  );

  // Runtime state
  let interaction = $state<Interaction>(IDLE);
  let activeMockupUrl = $state<string | null>(null);
  let loadedMockupId: string | null = null;
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

  function clearMockupSession() {
    if (activeMockupUrl) URL.revokeObjectURL(activeMockupUrl);
    activeMockupUrl = null;
    loadedMockupId = null;
    mockupSize = { width: 0, height: 0 };
    interaction = IDLE;
  }

  async function loadMockup(id: string | null) {
    const token = ++loadToken;

    if (!id) {
      clearMockupSession();
      return true;
    }

    if (loadedMockupId === id && activeMockupUrl) return true;

    try {
      const image = await getMockupImage(id);
      if (token !== loadToken) return loadedMockupId === mockupStore.activeMockupId;

      if (!image) {
        toastStore.showError(new Error(`Mockup not found.`));
        clearMockupSession();
        return true;
      }

      clearMockupSession();
      const newUrl = URL.createObjectURL(image);
      activeMockupUrl = newUrl;

      const size = await new Promise<Size>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error("Failed to load mockup image."));
        img.src = newUrl;
      });
      if (token !== loadToken) return loadedMockupId === mockupStore.activeMockupId;
      mockupSize = size;
      loadedMockupId = id;
      return true;
    } catch (e) {
      if (token !== loadToken) return loadedMockupId === mockupStore.activeMockupId;
      toastStore.showError(e, "Failed to load mockup");
      clearMockupSession();
      return false;
    }
  }

  function setPlacement(next: Placement) {
    settings.update({
      alignmentX: getAlignmentX(next),
      alignmentY: getAlignmentY(next),
      // An aligned axis keeps its current coordinate here, to fall back on if its alignment is cleared
      position: {
        x: "offset" in next.x ? next.x.offset : placedPosition.x,
        y: "offset" in next.y ? next.y.offset : placedPosition.y
      }
    });
  }

  /** Pin the mockup at a position, dropping any alignment */
  function placeAt(newPosition: Position) {
    setPlacement(freePlacement(newPosition));
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

    const { origin, current } = interaction;
    interaction = IDLE;
    // Only the axes the drag moved along lose their alignment; a plain click (a mouse press starts
    // a drag right away) keeps it entirely
    if (current.x !== origin.x || current.y !== origin.y) setPlacement(moveAlongAxes(placement, origin, current));
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
    get activeMockupId() {
      return mockupStore.activeMockupId;
    },
    get activeMockupUrl() {
      return activeMockupUrl;
    },
    get mockupSize() {
      return mockupSize;
    },
    get pageSize() {
      return pageSize;
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
    get effectiveOpacity() {
      return mode === "solid" || mode === "zoomed" ? 1 : opacity;
    },
    get positionDisplay() {
      return positionDisplay;
    },

    /** The page area the mockup aligns to; kept up to date by the overlay component */
    setPageSize: (size: Size) => {
      if (size.width !== pageSize.width || size.height !== pageSize.height) pageSize = size;
    },

    // ============================================
    // Mockup management
    // ============================================

    sync: () => loadMockup(mockupStore.activeMockupId),

    cleanup: () => {
      ++loadToken;
      clearMockupSession();
    },

    // ============================================
    // Visibility & Lock
    // ============================================
    // Settings use fire-and-forget pattern: local state updates immediately,
    // persistence failure only shows error (recoverable on next session)

    toggleVisibility: () => {
      // Can toggle visibility from any mode, but will exit solid/zoomed first
      exitInspection();

      settings.update({ isHidden: !isHidden });
    },

    toggleLock: () => {
      if (!can.adjustAppearance(mode)) return;

      settings.update({ isLocked: !isLocked });
    },

    // ============================================
    // Opacity (in visible or locked mode)
    // ============================================

    /** One opacity step: 1 more opaque, -1 more transparent */
    stepOpacity: (direction: 1 | -1) => {
      if (!can.adjustAppearance(mode)) return;

      settings.update({ opacity: clamp(roundTo(opacity + direction * OPACITY_STEP, 2), OPACITY_MIN, OPACITY_MAX) });
    },

    resetOpacity: () => {
      if (!can.adjustAppearance(mode)) return;

      settings.update({ opacity: OPACITY_DEFAULT });
    },

    /**
     * Set opacity directly (for slider)
     */
    setOpacity: (value: number) => {
      if (!can.adjustAppearance(mode)) return;

      settings.update({ opacity: clamp(roundTo(value, 2), OPACITY_MIN, OPACITY_MAX) });
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

      settings.update({ scale: newScale });
      placeAt(newPosition);
    },

    // ============================================
    // Alignment (only in visible mode)
    // ============================================

    setAlignment: (y: NonNullable<MockupAlignmentY>, x: NonNullable<MockupAlignmentX>) => {
      if (!can.reposition(mode)) return;

      setPlacement({ x: { align: x }, y: { align: y } });
    },

    // ============================================
    // Movement (only in visible mode)
    // ============================================

    move: (dx: number, dy: number) => {
      if (!can.reposition(mode)) return;

      const to = { x: placedPosition.x + dx, y: placedPosition.y + dy };
      setPlacement(moveAlongAxes(placement, placedPosition, to));
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
     * Toggle solid mode on touch devices (double tap). Also leaves zoom, which a mouse or pen can
     * enter on hybrid devices: the HUD has no exit button
     */
    toggleMobileSolidMode: () => {
      if (interaction.kind === "inspecting") {
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
}

export const overlayController = createOverlayController();
