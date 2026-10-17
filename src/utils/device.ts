/**
 * Device and Input Detection Utilities
 *
 * Provides two levels of detection:
 * 1. Device capability detection (isTouchDevice) - checks if device supports touch
 * 2. Input type tracking (isLastInputTouch) - tracks actual input method being used
 *
 * This allows proper support for hybrid devices (touch laptops, iPad with keyboard)
 * where both touch and keyboard/mouse are available.
 */

let cachedIsTouchDevice: boolean | null = null;

/**
 * Detects if the current device supports touch input.
 * Uses feature detection rather than User Agent for reliability.
 * Result is cached on first call.
 *
 * Note: This detects capability, not current input method.
 * Use isLastInputTouch for the input actually being used.
 */
export function isTouchDevice(): boolean {
  if (cachedIsTouchDevice === null) {
    cachedIsTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }
  return cachedIsTouchDevice;
}

/**
 * Resets the cached touch device detection.
 * Useful for testing purposes.
 */
export function resetTouchDeviceCache(): void {
  cachedIsTouchDevice = null;
}

// ============================================
// Input Type Tracking
// ============================================

export type InputType = "touch" | "mouse" | "pen" | null;

let lastInputType: InputType = null;
let inputTypeListenersAttached = false;

/**
 * Checks if the last input was a touch event.
 * Returns false if no input detected yet or last input was mouse/pen.
 */
export function isLastInputTouch(): boolean {
  return lastInputType === "touch";
}

/**
 * Initialize global input type tracking.
 * Attaches listeners to document to track pointer events.
 * Call once at app startup.
 */
export function initInputTypeTracking(): void {
  if (inputTypeListenersAttached) return;

  const trackInputType = (e: PointerEvent) => {
    lastInputType = e.pointerType as InputType;
  };
  // Pointerover precedes compatibility mouseenter; pointerdown also tracks clicks without re-entry.
  document.addEventListener("pointerover", trackInputType, { capture: true, passive: true });
  document.addEventListener("pointerdown", trackInputType, { capture: true, passive: true });

  inputTypeListenersAttached = true;
}

/**
 * Resets input type tracking state.
 * Useful for testing purposes.
 */
export function resetInputType(): void {
  lastInputType = null;
}
