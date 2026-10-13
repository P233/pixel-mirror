/**
 * Pointer gestures on the mockup image, as a Svelte attachment
 *
 * One Pointer Events pipeline for mouse, pen and touch:
 * - Mouse/pen, visible mode: drag (pointer capture keeps it working outside the image)
 * - Mouse/pen, solid/zoomed: click toggles 2x zoom; while zoomed, moving the mouse pans
 * - Touch, visible mode: one finger drags once it moves past DRAG_THRESHOLD, so taps keep the alignment
 * - Touch, solid mode: one finger pans, two fingers pinch-zoom
 * - Locked mode: ignored, so the browser scrolls natively (touch-action: pan-x pan-y)
 */

import { on } from "svelte/events";
import type { Attachment } from "svelte/attachments";
import { DRAG_THRESHOLD } from "~/constants";
import { distance, midpoint } from "./geometry";
import type { OverlayMode } from "./model";

/** The overlay actions gestures drive; points are client coordinates */
export interface GestureTarget {
  readonly mode: OverlayMode;
  beginDrag(point: Position): void;
  dragTo(point: Position): void;
  endDrag(): void;
  beginPan(point: Position): void;
  panTo(point: Position): void;
  beginPinch(center: Position): void;
  pinchTo(scaleFactor: number): void;
  enterZoomMode(point: Position): void;
  exitZoomMode(): void;
  zoomPanTo(point: Position): void;
}

const pointOf = (e: PointerEvent): Position => ({ x: e.clientX, y: e.clientY });

const isPastThreshold = (from: Position, to: Position) =>
  Math.abs(to.x - from.x) > DRAG_THRESHOLD || Math.abs(to.y - from.y) > DRAG_THRESHOLD;

export function overlayGestures(target: GestureTarget, isEnabled: () => boolean): Attachment<HTMLElement> {
  return (node) => {
    // Active touch points by pointer id
    const touches = new Map<number, Position>();
    // Where the first finger went down, until a drag starts
    let touchStart: Position | null = null;
    let pinchStartDistance = 0;
    // A second finger joined: no one-finger panning until all fingers are lifted
    let hadMultiTouch = false;
    let mousePointerId: number | null = null;

    function reset() {
      touches.clear();
      touchStart = null;
      pinchStartDistance = 0;
      hadMultiTouch = false;
      mousePointerId = null;
      if (target.mode === "dragging") target.endDrag();
    }

    function handlePointerDown(e: PointerEvent) {
      if (!isEnabled() || target.mode === "locked") return;

      if (e.pointerType !== "touch") {
        if (e.button !== 0) return;
        switch (target.mode) {
          case "visible":
            mousePointerId = e.pointerId;
            node.setPointerCapture?.(e.pointerId);
            target.beginDrag(pointOf(e));
            break;
          case "solid":
            target.enterZoomMode(pointOf(e));
            break;
          case "zoomed":
            target.exitZoomMode();
            break;
        }
        return;
      }

      touches.set(e.pointerId, pointOf(e));
      if (touches.size === 1) {
        touchStart = pointOf(e);
        hadMultiTouch = false;
        if (target.mode === "solid") target.beginPan(pointOf(e));
      } else if (touches.size === 2 && target.mode === "solid") {
        const [a, b] = touches.values();
        hadMultiTouch = true;
        pinchStartDistance = distance(a, b);
        target.beginPinch(midpoint(a, b));
      }
    }

    function handlePointerMove(e: PointerEvent) {
      if (e.pointerId === mousePointerId) {
        target.dragTo(pointOf(e));
        return;
      }
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, pointOf(e));

      if (touches.size >= 2) {
        if (pinchStartDistance > 0 && target.mode === "solid") {
          const [a, b] = touches.values();
          target.pinchTo(distance(a, b) / pinchStartDistance);
        }
        return;
      }

      const point = pointOf(e);
      switch (target.mode) {
        case "visible":
          // The drag starts from where the finger crossed the threshold
          if (touchStart && isPastThreshold(touchStart, point)) {
            touchStart = null;
            target.beginDrag(point);
          }
          break;
        case "dragging":
          target.dragTo(point);
          break;
        case "solid":
          if (!hadMultiTouch) target.panTo(point);
          break;
      }
    }

    function handlePointerUp(e: PointerEvent) {
      if (e.pointerId === mousePointerId) {
        mousePointerId = null;
        node.releasePointerCapture?.(e.pointerId);
        target.endDrag();
        return;
      }
      if (!touches.delete(e.pointerId)) return;

      if (touches.size < 2) pinchStartDistance = 0;
      if (touches.size === 0) reset();
    }

    // While zoomed, the mouse pans without a button pressed, anywhere in the window
    function handleWindowPointerMove(e: PointerEvent) {
      if (e.pointerType !== "touch" && target.mode === "zoomed") target.zoomPanTo(pointOf(e));
    }

    const stops = [
      on(node, "pointerdown", handlePointerDown),
      on(node, "pointermove", handlePointerMove),
      on(node, "pointerup", handlePointerUp),
      on(node, "pointercancel", reset),
      on(window, "pointermove", handleWindowPointerMove),
      // Safari: keep its native page pinch-zoom off the overlay while we handle pinches
      on(node, "gesturestart", (e) => target.mode !== "locked" && e.preventDefault(), { passive: false }),
      on(document, "visibilitychange", () => document.hidden && reset())
    ];

    return () => {
      stops.forEach((stop) => stop());
      reset();
    };
  };
}
