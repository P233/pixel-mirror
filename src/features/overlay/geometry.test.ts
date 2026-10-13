import { describe, expect, it } from "vitest";
import { distance, focusPoint, midpoint, resolveAxisX, resolveAxisY, resolvePosition } from "./geometry";

describe("resolveAxisX", () => {
  it.each([
    [{ align: "left" } as const, 0],
    [{ align: "center" } as const, 112],
    [{ align: "right" } as const, 224],
    [{ offset: 37 }, 37]
  ])("%o in a 1024px page with an 800px image → %d", (axis, expected) => {
    expect(resolveAxisX(axis, 800, 1024)).toBe(expected);
  });

  it("truncates a fractional center toward zero", () => {
    expect(resolveAxisX({ align: "center" }, 801, 1024)).toBe(111);
    expect(resolveAxisX({ align: "center" }, 1025, 1024)).toBe(0);
  });

  it("centers an image wider than the page at a negative offset", () => {
    expect(resolveAxisX({ align: "center" }, 1440, 1024)).toBe(-208);
  });
});

describe("resolveAxisY", () => {
  it.each([
    [{ align: "top" } as const, 0],
    [{ align: "bottom" } as const, 1500],
    [{ offset: -20 }, -20]
  ])("%o in a 3000px page with a 1500px image → %d", (axis, expected) => {
    expect(resolveAxisY(axis, 1500, 3000)).toBe(expected);
  });
});

describe("resolvePosition", () => {
  it("aligns the scaled image size", () => {
    const placement = { x: { align: "center" }, y: { align: "bottom" } } as const;

    expect(resolvePosition(placement, { width: 800, height: 1500 }, 0.5, { width: 1024, height: 3000 })).toEqual({
      x: 312,
      y: 2250
    });
  });

  it("returns free offsets as-is regardless of size", () => {
    const placement = { x: { offset: 10 }, y: { offset: 20 } };

    expect(resolvePosition(placement, { width: 800, height: 1500 }, 2, { width: 0, height: 0 })).toEqual({
      x: 10,
      y: 20
    });
  });
});

describe("focusPoint", () => {
  const mockupPointUnder = (position: Position, scale: number, point: Position) => ({
    x: (point.x - position.x) / scale,
    y: (point.y - position.y) / scale
  });

  it.each([
    [{ x: 0, y: 0 }, 1, 2, { x: 640, y: 400 }],
    [{ x: 100, y: -50 }, 1, 0.5, { x: 960, y: 540 }],
    [{ x: -300, y: 20 }, 2, 0.25, { x: 10, y: 10 }]
  ])("keeps the mockup point under the anchor fixed (%o, %d → %d)", (position, scale, newScale, anchor) => {
    const before = mockupPointUnder(position, scale, anchor);
    const after = mockupPointUnder(focusPoint(position, scale, newScale, anchor), newScale, anchor);

    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("moves the mockup point under `point` to `target`", () => {
    const position = { x: 0, y: 0 };
    const clicked = { x: 100, y: 100 };
    const center = { x: 640, y: 400 };

    const zoomed = focusPoint(position, 1, 2, clicked, center);

    // mockup point (100, 100) at 2x is 200px from the corner, so the corner moves to center - 200
    expect(zoomed).toEqual({ x: 440, y: 200 });
  });
});

describe("distance and midpoint", () => {
  it("measures between two touch points", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(midpoint({ x: 0, y: 10 }, { x: 20, y: 30 })).toEqual({ x: 10, y: 20 });
  });
});
