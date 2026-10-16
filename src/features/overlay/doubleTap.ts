/**
 * Double-tap recognition for touch screens (pure, no DOM)
 */

import { DOUBLE_TAP_DELAY, DRAG_THRESHOLD, DRAG_THRESHOLD_GLOBAL, SCROLL_COOLDOWN } from "~/constants";

export interface DoubleTapOptions {
  /** Max time between the two taps (ms) */
  delay?: number;
  /** Max distance between the two taps on each axis (px) */
  tolerance?: number;
  /** Taps within this time after a scroll don't count (ms), e.g. the tap that stops momentum scrolling */
  scrollCooldown?: number;
}

export function createDoubleTapDetector({
  delay = DOUBLE_TAP_DELAY,
  tolerance = DRAG_THRESHOLD_GLOBAL,
  scrollCooldown = SCROLL_COOLDOWN
}: DoubleTapOptions = {}) {
  let lastTapTime = -Infinity;
  let lastTapPosition: Position = { x: 0, y: 0 };
  let lastScrollTime = -Infinity;
  let touchStart: { position: Position; time: number } | null = null;

  function cancel() {
    touchStart = null;
    lastTapTime = -Infinity;
  }

  const hasMoved = (from: Position, to: Position) =>
    Math.abs(to.x - from.x) > DRAG_THRESHOLD || Math.abs(to.y - from.y) > DRAG_THRESHOLD;

  return {
    start(position: Position, now: number) {
      touchStart = { position, time: now };
    },

    move(position: Position) {
      if (touchStart && hasMoved(touchStart.position, position)) cancel();
    },

    /** Only a short, stationary, uncancelled touch can complete a double tap */
    end(position: Position, now: number): boolean {
      const start = touchStart;
      touchStart = null;
      if (!start || now - start.time >= delay || hasMoved(start.position, position)) {
        cancel();
        return false;
      }
      if (now - lastScrollTime < scrollCooldown) {
        lastTapTime = -Infinity;
        return false;
      }

      const isDoubleTap =
        now - lastTapTime < delay &&
        Math.abs(position.x - lastTapPosition.x) < tolerance &&
        Math.abs(position.y - lastTapPosition.y) < tolerance;

      // A third tap starts over instead of completing another double tap
      lastTapTime = isDoubleTap ? -Infinity : now;
      lastTapPosition = position;
      return isDoubleTap;
    },

    cancel,

    scrolled(now: number) {
      lastScrollTime = now;
      cancel();
    }
  };
}
