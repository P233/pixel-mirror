/**
 * Double-tap recognition for touch screens (pure, no DOM)
 */

import { DOUBLE_TAP_DELAY, DRAG_THRESHOLD_GLOBAL, SCROLL_COOLDOWN } from "~/constants";

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

  return {
    /** Register a tap; returns true when it completes a double tap */
    tap(position: Position, now: number): boolean {
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

    scrolled(now: number) {
      lastScrollTime = now;
    }
  };
}
