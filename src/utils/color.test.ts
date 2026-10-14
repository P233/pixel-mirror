import { describe, expect, it } from "vitest";
import { fromPickedColor, parseColor, toHex, toPickerValue, toRgbaString } from "./color";

describe("parseColor", () => {
  it.each([
    ["#f00", { r: 255, g: 0, b: 0, a: 1 }],
    ["#ff000080", { r: 255, g: 0, b: 0, a: 0.5 }],
    ["#00ff00", { r: 0, g: 255, b: 0, a: 1 }],
    ["rgb(1, 2, 3)", { r: 1, g: 2, b: 3, a: 1 }],
    [" rgba(0, 0, 255, 0.05) ", { r: 0, g: 0, b: 255, a: 0.05 }],
    ["rgba(0,0,255,.5)", { r: 0, g: 0, b: 255, a: 0.5 }],
    ["rgba(300, 0, 0, 2)", { r: 255, g: 0, b: 0, a: 1 }],
    ["color(srgb 1 0 0 / 0.501961)", { r: 255, g: 0, b: 0, a: 0.5 }],
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
