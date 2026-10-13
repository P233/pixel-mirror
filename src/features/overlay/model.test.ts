import { describe, expect, it } from "vitest";
import {
  alignmentX,
  alignmentY,
  can,
  deriveMode,
  describePlacement,
  freePlacement,
  IDLE,
  isAligned,
  placementFromSettings,
  type Interaction,
  type OverlayMode
} from "./model";

const dragging: Interaction = {
  kind: "dragging",
  pointerStart: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
  current: { x: 0, y: 0 }
};
const solid: Interaction = { kind: "inspecting", view: null, zoom: null };
const zoomed: Interaction = {
  kind: "inspecting",
  view: { x: 0, y: 0, scale: 2 },
  zoom: { returnTo: null, pointerStart: { x: 0, y: 0 }, origin: { x: 0, y: 0 }, isPanning: false }
};

describe("deriveMode", () => {
  it.each<[Interaction, boolean, OverlayMode]>([
    [IDLE, false, "visible"],
    [IDLE, true, "locked"],
    [dragging, false, "dragging"],
    [solid, false, "solid"],
    [solid, true, "solid"],
    [zoomed, false, "zoomed"],
    [zoomed, true, "zoomed"]
  ])("%o with locked=%s → %s", (interaction, isLocked, expected) => {
    expect(deriveMode(interaction, isLocked)).toBe(expected);
  });
});

describe("can", () => {
  const modes: OverlayMode[] = ["visible", "locked", "dragging", "solid", "zoomed"];

  it.each([
    ["adjustAppearance", ["visible", "locked"]],
    ["reposition", ["visible"]],
    ["zoom", ["solid"]]
  ] as const)("%s is allowed only in %o", (action, allowed) => {
    for (const mode of modes) {
      expect(can[action](mode)).toBe((allowed as readonly string[]).includes(mode));
    }
  });
});

describe("placement", () => {
  it("builds aligned and free axes from settings", () => {
    const placement = placementFromSettings("center", null, { x: 5, y: 70 });

    expect(placement).toEqual({ x: { align: "center" }, y: { offset: 70 } });
    expect(alignmentX(placement)).toBe("center");
    expect(alignmentY(placement)).toBeNull();
    expect(isAligned(placement)).toBe(true);
  });

  it("has no alignment when placed freely", () => {
    const placement = freePlacement({ x: 1, y: 2 });

    expect(isAligned(placement)).toBe(false);
    expect(alignmentX(placement)).toBeNull();
  });

  it.each([
    [placementFromSettings("center", "top", { x: 0, y: 0 }), "top·center"],
    [placementFromSettings(null, "bottom", { x: 0, y: 0 }), "bottom"],
    [placementFromSettings("right", null, { x: 0, y: 0 }), "right"],
    [freePlacement({ x: 0, y: 0 }), "x:12, y:-4"]
  ])("describes %o as %s", (placement, expected) => {
    expect(describePlacement(placement, { x: 12.4, y: -3.6 })).toBe(expected);
  });
});
