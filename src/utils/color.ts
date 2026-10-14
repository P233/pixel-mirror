/**
 * Color parsing for the grid color fields: the native color picker only edits hex colors and has
 * no alpha, so the fields split a color into channels and recombine it as rgba()
 */

import { roundTo } from "~/stores/utils";

/** Red, green and blue in 0–255, alpha in 0–1 */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX_PATTERN = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// What a native color picker with the `alpha` attribute reports (Safari), e.g. color(srgb 1 0 0 / 0.5)
const SRGB_PATTERN = /^color\(\s*srgb\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s+(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+)\s*)?\)$/i;
const RGB_PATTERN =
  /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i;

/** Hex, comma-separated rgb()/rgba() and color(srgb ...) colors; others (named, hsl(), ...) give null */
export function parseColor(color: string): Rgba | null {
  const value = color.trim();

  const hex = value.match(HEX_PATTERN);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map((digit) => digit + digit).join("") : hex[1];
    const channel = (index: number) => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return { r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? roundTo(channel(3) / 255, 2) : 1 };
  }

  const rgb = value.match(RGB_PATTERN);
  if (rgb) {
    const channel = (raw: string) => Math.min(255, Math.round(Number(raw)));
    return {
      r: channel(rgb[1]),
      g: channel(rgb[2]),
      b: channel(rgb[3]),
      a: rgb[4] === undefined ? 1 : Math.min(1, Number(rgb[4]))
    };
  }

  const srgb = value.match(SRGB_PATTERN);
  if (srgb) {
    const channel = (raw: string) => Math.round(Math.min(1, Number(raw)) * 255);
    const a = srgb[4] === undefined ? 1 : roundTo(Math.min(1, Number(srgb[4])), 2);
    return { r: channel(srgb[1]), g: channel(srgb[2]), b: channel(srgb[3]), a };
  }

  return null;
}

/** #rrggbb, as the native color picker takes it */
export function toHex({ r, g, b }: Rgba): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function toRgbaString({ r, g, b, a }: Rgba): string {
  return `rgba(${r}, ${g}, ${b}, ${roundTo(a, 2)})`;
}

/**
 * The native color picker's value. A picker with alpha (Safari) takes the whole color, others hex only.
 * A color we can't read shows the fallback, at `fallbackAlpha` where the picker has alpha: picking a
 * hue there must not make the grid opaque.
 */
export function toPickerValue(
  color: Rgba | null,
  fallbackHex: string,
  fallbackAlpha: number,
  hasAlpha: boolean
): string {
  if (!hasAlpha) return color ? toHex(color) : fallbackHex;
  return toRgbaString(color ?? { ...(parseColor(fallbackHex) ?? { r: 0, g: 0, b: 0, a: 1 }), a: fallbackAlpha });
}

/** The color to save from a pick: a picker without alpha keeps the current opacity (or the fallback one) */
export function fromPickedColor(picked: Rgba, current: Rgba | null, fallbackAlpha: number, hasAlpha: boolean): Rgba {
  return hasAlpha ? picked : { ...picked, a: current?.a ?? fallbackAlpha };
}
