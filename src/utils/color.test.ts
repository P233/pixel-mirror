import { describe, expect, it, vi } from "vitest";
import {
  constrainColorOpacity,
  fromPickedColor,
  parseColor,
  resolveColor,
  toHex,
  toPickerValue,
  toRgbaString,
  withColorOpacity
} from "./color";

describe("parseColor", () => {
  it.each([
    ["#f00", { r: 255, g: 0, b: 0, a: 1 }],
    ["#ff000080", { r: 255, g: 0, b: 0, a: 128 / 255 }],
    ["#00ff00", { r: 0, g: 255, b: 0, a: 1 }],
    ["rgb(1, 2, 3)", { r: 1, g: 2, b: 3, a: 1 }],
    [" rgba(0, 0, 255, 0.05) ", { r: 0, g: 0, b: 255, a: 0.05 }],
    ["rgba(0,0,255,.5)", { r: 0, g: 0, b: 255, a: 0.5 }],
    ["rgba(300, 0, 0, 2)", { r: 255, g: 0, b: 0, a: 1 }],
    ["color(srgb 1 0 0 / 0.501961)", { r: 255, g: 0, b: 0, a: 0.501961 }],
    ["color(srgb 0 0.5 1)", { r: 0, g: 128, b: 255, a: 1 }]
  ])("parses %s", (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it.each(["red", "hsl(0 100% 50%)", "rgb(0 0 0 / 50%)", "", "#12", "color(srgb 1.2.3 0 0)", "color(srgb . 0 0)"])(
    "gives null for %o",
    (input) => {
      expect(parseColor(input)).toBeNull();
    }
  );
});

describe("native picker", () => {
  const blue = { r: 0, g: 0, b: 255, a: 0.3 };

  it("shows hex only where the picker has no alpha, the whole color where it has", () => {
    expect(toPickerValue(blue, "#ff0000", 0.05, false)).toBe("#0000ff");
    expect(toPickerValue(blue, "#ff0000", 0.05, true)).toBe("rgba(0, 0, 255, 0.3)");
  });

  it("shows the fallback at the fallback opacity for colors it can't read", () => {
    expect(toPickerValue(null, "#ff0000", 0.05, false)).toBe("#ff0000");
    // Safari: picking only a hue keeps the grid faint instead of opaque
    expect(toPickerValue(null, "#ff0000", 0.05, true)).toBe("rgba(255, 0, 0, 0.05)");
  });

  it("keeps the current opacity for pickers without alpha, and takes the picked one otherwise", () => {
    const green = { r: 0, g: 255, b: 0, a: 1 };

    expect(fromPickedColor(green, blue, 0.05, false)).toEqual({ ...green, a: 0.3 });
    expect(fromPickedColor(green, null, 0.05, false)).toEqual({ ...green, a: 0.05 });
    expect(fromPickedColor({ ...green, a: 0.5 }, blue, 0.05, true)).toEqual({ ...green, a: 0.5 });
  });
});

describe("formatting", () => {
  it("formats the picker's hex and an rgba() string with alpha rounded to 2 decimals", () => {
    const color = { r: 255, g: 8, b: 0, a: 0.4567 };

    expect(toHex(color)).toBe("#ff0800");
    expect(toRgbaString(color)).toBe("rgba(255, 8, 0, 0.46)");
  });
});

describe("grid color opacity", () => {
  it.each([
    ["rgba(1, 2, 3, 0.05)", "rgba(1, 2, 3, 0.05)"],
    ["rgba(1, 2, 3, 0.0099)", "rgba(1, 2, 3, 0.01)"],
    ["rgba(1, 2, 3, 0.0101)", "rgba(1, 2, 3, 0.0101)"],
    ["rgba(1, 2, 3, 0.9899)", "rgba(1, 2, 3, 0.9899)"],
    ["rgba(1, 2, 3, 0.9901)", "rgba(1, 2, 3, 0.99)"],
    ["rgba(1, 2, 3, 1)", "rgba(1, 2, 3, 0.99)"],
    ["#123456", "rgba(18, 52, 86, 0.99)"],
    ["#12345600", "rgba(18, 52, 86, 0.01)"],
    ["#12345619", "#12345619"],
    ["#123456e6", "#123456e6"],
    ["color(srgb 1 0 0 / 0.0999)", "color(srgb 1 0 0 / 0.0999)"],
    ["color(srgb 1 0 0 / 0.9001)", "color(srgb 1 0 0 / 0.9001)"],
    ["transparent", "rgba(0, 0, 0, 0.01)"],
    ["rebeccapurple", "rgba(102, 51, 153, 0.99)"],
    ["hsl(0 100% 50% / 0.05)", "rgba(255, 0, 0, 0.05)"],
    ["rgb(1 2 3 / 100%)", "rgba(1, 2, 3, 0.99)"],
    ["rgba(1, 2, 3, 0.5)", "rgba(1, 2, 3, 0.5)"],
    ["hsl(0 100% 50% / 0.5)", "rgba(255, 0, 0, 0.5)"],
    ["oklch(0.5 0.2 30 / 0.05)", "oklch(0.5 0.2 30 / 0.05)"],
    ["oklch(0.5 0.2 30 / none)", "oklch(0.5 0.2 30 / 0.01)"],
    ["color(display-p3 1 0 0)", "color(display-p3 1 0 0 / 0.99)"]
  ])("constrains %s", (input, expected) => {
    expect(constrainColorOpacity(input)).toBe(expected);
  });

  it("removes the temporary color probe", () => {
    const before = document.documentElement.childElementCount;
    expect(resolveColor("hsl(0 100% 50% / 0.5)")?.alpha).toBe(0.5);
    expect(document.documentElement.childElementCount).toBe(before);
  });

  it("resolves inherited colors in the same body context as the tool", () => {
    const original = document.body.style.color;
    const before = document.body.childElementCount;
    document.body.style.color = "rgba(0, 0, 255, 0.4)";
    try {
      expect(resolveColor("currentColor")?.rgba).toEqual({ r: 0, g: 0, b: 255, a: 0.4 });
      expect(document.body.childElementCount).toBe(before);
    } finally {
      document.body.style.color = original;
    }
  });

  it.each(["oklch(0.5 0.2 30", "color(display-p3 1 0 0"])(
    "reads and replaces a browser-serialized exponent alpha in %s",
    (channels) => {
      // jsdom rounds tiny alpha to zero; Chromium preserves it in exponent notation.
      const computedStyle = vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
        color: `${channels} / 1.00000e-7)`
      } as CSSStyleDeclaration);
      try {
        const color = resolveColor(`${channels} / 1e-7)`)!;
        expect(color.alpha).toBe(1e-7);
        expect(withColorOpacity(color, 0.5)).toBe(`${channels} / 0.5)`);
        expect(constrainColorOpacity(color.css)).toBe(`${channels} / 0.01)`);
      } finally {
        computedStyle.mockRestore();
      }
    }
  );
});
