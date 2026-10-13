import { describe, expect, it } from "vitest";
import { DOUBLE_TAP_DELAY, DRAG_THRESHOLD_GLOBAL, SCROLL_COOLDOWN } from "~/constants";
import { createDoubleTapDetector } from "./doubleTap";

const at = (x: number, y = x) => ({ x, y });

describe("createDoubleTapDetector", () => {
  it("detects two taps in the same place within the delay", () => {
    const detector = createDoubleTapDetector();

    expect(detector.tap(at(100), 1000)).toBe(false);
    expect(detector.tap(at(100), 1000 + DOUBLE_TAP_DELAY - 1)).toBe(true);
  });

  it("ignores taps that are too far apart in time", () => {
    const detector = createDoubleTapDetector();

    detector.tap(at(100), 1000);

    expect(detector.tap(at(100), 1000 + DOUBLE_TAP_DELAY)).toBe(false);
  });

  it.each([
    [at(100 + DRAG_THRESHOLD_GLOBAL, 100), "x"],
    [at(100, 100 + DRAG_THRESHOLD_GLOBAL), "y"]
  ])("ignores taps too far apart on the %s axis", (second) => {
    const detector = createDoubleTapDetector();

    detector.tap(at(100), 1000);

    expect(detector.tap(second, 1100)).toBe(false);
  });

  it("starts over after a double tap, so a triple tap is one double tap", () => {
    const detector = createDoubleTapDetector();

    detector.tap(at(100), 1000);
    expect(detector.tap(at(100), 1100)).toBe(true);
    expect(detector.tap(at(100), 1200)).toBe(false);
    expect(detector.tap(at(100), 1300)).toBe(true);
  });

  it("does not count taps right after scrolling", () => {
    const detector = createDoubleTapDetector();

    detector.tap(at(100), 1000);
    detector.scrolled(1050);

    expect(detector.tap(at(100), 1050 + SCROLL_COOLDOWN - 1)).toBe(false);
    expect(detector.tap(at(100), 1050 + SCROLL_COOLDOWN + 50)).toBe(false);
    expect(detector.tap(at(100), 1050 + SCROLL_COOLDOWN + 100)).toBe(true);
  });

  it("accepts custom thresholds", () => {
    const detector = createDoubleTapDetector({ delay: 50, tolerance: 2, scrollCooldown: 0 });

    detector.tap(at(0), 0);
    expect(detector.tap(at(1), 49)).toBe(true);
  });
});
