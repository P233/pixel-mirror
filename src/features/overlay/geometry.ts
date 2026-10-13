/**
 * Pure geometry for placing and zooming the mockup. No DOM access: callers pass in
 * the page and viewport measurements.
 */

import type { AxisX, AxisY, Placement } from "./model";

export function resolveAxisX(axis: AxisX, imageWidth: number, pageWidth: number): number {
  if ("offset" in axis) return axis.offset;
  switch (axis.align) {
    case "left":
      return 0;
    case "center":
      // `|| 0` turns -0 into 0
      return Math.trunc((pageWidth - imageWidth) / 2) || 0;
    case "right":
      return pageWidth - imageWidth;
  }
}

export function resolveAxisY(axis: AxisY, imageHeight: number, pageHeight: number): number {
  if ("offset" in axis) return axis.offset;
  switch (axis.align) {
    case "top":
      return 0;
    case "bottom":
      return pageHeight - imageHeight;
  }
}

/**
 * Page coordinates of the mockup's top-left corner
 */
export function resolvePosition(placement: Placement, imageSize: Size, scale: number, pageSize: Size): Position {
  return {
    x: resolveAxisX(placement.x, imageSize.width * scale, pageSize.width),
    y: resolveAxisY(placement.y, imageSize.height * scale, pageSize.height)
  };
}

/**
 * Position after rescaling from `scale` to `newScale` such that the mockup point that was
 * under `point` ends up under `target` (pass the same point twice to keep it fixed)
 */
export function focusPoint(
  position: Position,
  scale: number,
  newScale: number,
  point: Position,
  target: Position = point
): Position {
  return {
    x: target.x - ((point.x - position.x) / scale) * newScale,
    y: target.y - ((point.y - position.y) / scale) * newScale
  };
}

export function distance(a: Position, b: Position): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
