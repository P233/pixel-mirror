import { describe, expect, it } from "vitest";
import { DOUBLE_TAP_DELAY, DRAG_THRESHOLD_GLOBAL, SCROLL_COOLDOWN } from "~/constants";
import { createDoubleTapDetector } from "./doubleTap";

const at = (x: number, y = x) => ({ x, y });

function tap(detector: ReturnType<typeof createDoubleTapDetector>, position: Position, time: number) {
  detector.start(position, time - 10);
  return detector.end(position, time);
}

describe("createDoubleTapDetector", () => {
  it("detects two taps in the same place within the delay", () => {
    const detector = createDoubleTapDetector();

    expect(tap(detector, at(100), 1000)).toBe(false);
    expect(tap(detector, at(100), 1000 + DOUBLE_TAP_DELAY - 1)).toBe(true);
  });

  it("ignores taps that are too far apart in time", () => {
    const detector = createDoubleTapDetector();

    tap(detector, at(100), 1000);

    expect(tap(detector, at(100), 1000 + DOUBLE_TAP_DELAY)).toBe(false);
  });

  it.each([
    [at(100 + DRAG_THRESHOLD_GLOBAL, 100), "x"],
    [at(100, 100 + DRAG_THRESHOLD_GLOBAL), "y"]
  ])("ignores taps too far apart on the %s axis", (second) => {
    const detector = createDoubleTapDetector();

    tap(detector, at(100), 1000);

    expect(tap(detector, second, 1100)).toBe(false);
  });

  it("starts over after a double tap, so a triple tap is one double tap", () => {
    const detector = createDoubleTapDetector();

    tap(detector, at(100), 1000);
    expect(tap(detector, at(100), 1100)).toBe(true);
    expect(tap(detector, at(100), 1200)).toBe(false);
    expect(tap(detector, at(100), 1300)).toBe(true);
  });

  it("does not count taps right after scrolling", () => {
    const detector = createDoubleTapDetector();

    tap(detector, at(100), 1000);
    detector.scrolled(1050);

    expect(tap(detector, at(100), 1050 + SCROLL_COOLDOWN - 1)).toBe(false);
    expect(tap(detector, at(100), 1050 + SCROLL_COOLDOWN + 50)).toBe(false);
    expect(tap(detector, at(100), 1050 + SCROLL_COOLDOWN + 100)).toBe(true);
  });

  it("accepts custom thresholds", () => {
    const detector = createDoubleTapDetector({ delay: 50, tolerance: 2, scrollCooldown: 0 });

    tap(detector, at(0), 0);
    expect(tap(detector, at(1), 49)).toBe(true);
  });

  it("rejects long presses and clears previous tap history", () => {
    const detector = createDoubleTapDetector();
    tap(detector, at(100), 1000);
    detector.start(at(100), 1050);

    expect(detector.end(at(100), 1050 + DOUBLE_TAP_DELAY)).toBe(false);
    expect(tap(detector, at(100), 1400)).toBe(false);
    expect(tap(detector, at(100), 1500)).toBe(true);
  });

  it("rejects a drag even when the finger returns to its starting point", () => {
    const detector = createDoubleTapDetector();
    tap(detector, at(100), 1000);
    detector.start(at(100), 1050);
    detector.move(at(120));
    detector.move(at(100));

    expect(detector.end(at(100), 1100)).toBe(false);
    expect(tap(detector, at(100), 1150)).toBe(false);
  });

  it("rejects movement even if no move event was delivered", () => {
    const detector = createDoubleTapDetector();
    tap(detector, at(100), 1000);
    detector.start(at(120), 1050);

    expect(detector.end(at(100), 1100)).toBe(false);
  });
});
