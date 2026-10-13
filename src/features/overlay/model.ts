/**
 * Mockup overlay state model (pure, no DOM, no Svelte)
 *
 * The persisted state is split into orthogonal parts instead of one 5-value mode:
 * - Placement: how the mockup is positioned (aligned to a page edge/center, or a free offset)
 * - isLocked / isHidden: appearance flags
 * - Interaction: what the user is doing right now; never persisted
 *
 * The legacy 5-state `mode` (visible/locked/dragging/solid/zoomed) is derived from these.
 */

export type AxisX = { align: "left" | "center" | "right" } | { offset: number };
export type AxisY = { align: "top" | "bottom" } | { offset: number };

export interface Placement {
  x: AxisX;
  y: AxisY;
}

/** A temporary transform shown while inspecting (solid/zoomed/pinched), discarded on exit */
export interface View {
  x: number;
  y: number;
  scale: number;
}

export interface ZoomState {
  /** View to return to when leaving zoom (null: the regular placement) */
  returnTo: View | null;
  pointerStart: Position;
  origin: Position;
  isPanning: boolean;
}

export type Interaction =
  | { kind: "idle" }
  | { kind: "dragging"; pointerStart: Position; origin: Position; current: Position }
  | { kind: "inspecting"; view: View | null; zoom: ZoomState | null };

export type OverlayMode = "visible" | "locked" | "dragging" | "solid" | "zoomed";

export const IDLE: Interaction = { kind: "idle" };

export const DEFAULT_PLACEMENT: Placement = { x: { align: "center" }, y: { align: "top" } };

export function deriveMode(interaction: Interaction, isLocked: boolean): OverlayMode {
  switch (interaction.kind) {
    case "dragging":
      return "dragging";
    case "inspecting":
      return interaction.zoom ? "zoomed" : "solid";
    case "idle":
      return isLocked ? "locked" : "visible";
  }
}

/** Which actions each mode allows */
export const can = {
  /** Lock toggle, opacity changes, entering solid mode */
  adjustAppearance: (mode: OverlayMode) => mode === "visible" || mode === "locked",
  /** Dragging, nudging, scaling, aligning */
  reposition: (mode: OverlayMode) => mode === "visible",
  zoom: (mode: OverlayMode) => mode === "solid"
};

export function alignmentX(placement: Placement): MockupAlignmentX {
  return "align" in placement.x ? placement.x.align : null;
}

export function alignmentY(placement: Placement): MockupAlignmentY {
  return "align" in placement.y ? placement.y.align : null;
}

export function isAligned(placement: Placement): boolean {
  return alignmentX(placement) !== null || alignmentY(placement) !== null;
}

/** A placement at a fixed position with no alignment */
export function freePlacement(position: Position): Placement {
  return { x: { offset: position.x }, y: { offset: position.y } };
}

/**
 * Build a placement from the persisted settings: aligned axes follow the alignment,
 * the others use the stored position
 */
export function placementFromSettings(x: MockupAlignmentX, y: MockupAlignmentY, position: Position): Placement {
  return {
    x: x === null ? { offset: position.x } : { align: x },
    y: y === null ? { offset: position.y } : { align: y }
  };
}

/** Shown above the dock: the alignment (e.g. "top·center") or rounded coordinates */
export function describePlacement(placement: Placement, position: Position): string {
  const parts = [alignmentY(placement), alignmentX(placement)].filter(Boolean);
  if (parts.length > 0) return parts.join("·");
  return `x:${Math.round(position.x)}, y:${Math.round(position.y)}`;
}
