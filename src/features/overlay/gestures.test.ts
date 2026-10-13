import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { overlayGestures, type GestureTarget } from "./gestures";
import type { OverlayMode } from "./model";

function createTarget(mode: OverlayMode = "visible") {
  const target = {
    mode,
    beginDrag: vi.fn((): void => {
      target.mode = "dragging";
    }),
    dragTo: vi.fn(),
    endDrag: vi.fn((): void => {
      target.mode = "visible";
    }),
    beginPan: vi.fn(),
    panTo: vi.fn(),
    beginPinch: vi.fn(),
    pinchTo: vi.fn(),
    enterZoomMode: vi.fn(),
    exitZoomMode: vi.fn(),
    zoomPanTo: vi.fn()
  } satisfies GestureTarget;
  return target;
}

type Init = { id?: number; x?: number; y?: number; type?: string; button?: number };
const pointer = (type: string, { id = 1, x = 0, y = 0, type: pointerType = "touch", button = 0 }: Init = {}) =>
  new PointerEvent(type, {
    pointerId: id,
    clientX: x,
    clientY: y,
    pointerType,
    button,
    bubbles: true,
    cancelable: true
  });

describe("overlayGestures", () => {
  let node: HTMLDivElement;
  let target: ReturnType<typeof createTarget>;
  let enabled: boolean;
  let detach: (() => void) | void;

  const attach = async (mode: OverlayMode) => {
    target = createTarget(mode);
    detach = overlayGestures(target, () => enabled)(node);
    // svelte/events attaches pointer listeners after a microtask
    await Promise.resolve();
  };
  const fire = (type: string, init?: Init) => node.dispatchEvent(pointer(type, init));

  beforeEach(() => {
    node = document.createElement("div");
    document.body.appendChild(node);
    enabled = true;
  });

  afterEach(() => {
    detach?.();
    node.remove();
  });

  describe("mouse and pen", () => {
    it("drags in visible mode, also outside the element via pointer capture", async () => {
      await attach("visible");

      fire("pointerdown", { type: "mouse", x: 10, y: 10 });
      fire("pointermove", { type: "mouse", x: 30, y: 40 });
      fire("pointerup", { type: "mouse", x: 30, y: 40 });

      expect(target.beginDrag).toHaveBeenCalledWith({ x: 10, y: 10 });
      expect(target.dragTo).toHaveBeenCalledWith({ x: 30, y: 40 });
      expect(target.endDrag).toHaveBeenCalledTimes(1);
    });

    it("ignores secondary buttons", async () => {
      await attach("visible");

      fire("pointerdown", { type: "mouse", button: 2 });

      expect(target.beginDrag).not.toHaveBeenCalled();
    });

    it("zooms in on click in solid mode and out in zoomed mode", async () => {
      await attach("solid");
      fire("pointerdown", { type: "pen", x: 5, y: 6 });
      expect(target.enterZoomMode).toHaveBeenCalledWith({ x: 5, y: 6 });

      target.mode = "zoomed";
      fire("pointerdown", { type: "mouse" });
      expect(target.exitZoomMode).toHaveBeenCalledTimes(1);
    });

    it("pans with plain mouse movement anywhere while zoomed", async () => {
      await attach("zoomed");

      window.dispatchEvent(pointer("pointermove", { type: "mouse", x: 300, y: 200 }));
      target.mode = "solid";
      window.dispatchEvent(pointer("pointermove", { type: "mouse", x: 310, y: 210 }));

      expect(target.zoomPanTo).toHaveBeenCalledTimes(1);
      expect(target.zoomPanTo).toHaveBeenCalledWith({ x: 300, y: 200 });
    });
  });

  describe("touch, visible mode", () => {
    it("does not start a drag on a tap, so alignment is kept", async () => {
      await attach("visible");

      fire("pointerdown", { x: 100, y: 100 });
      fire("pointermove", { x: 103, y: 104 });
      fire("pointerup", { x: 103, y: 104 });

      expect(target.beginDrag).not.toHaveBeenCalled();
      expect(target.endDrag).not.toHaveBeenCalled();
    });

    it("starts the drag where the finger crosses the threshold, then follows it", async () => {
      await attach("visible");

      fire("pointerdown", { x: 100, y: 100 });
      fire("pointermove", { x: 107, y: 100 });
      fire("pointermove", { x: 150, y: 120 });
      fire("pointerup", { x: 150, y: 120 });

      expect(target.beginDrag).toHaveBeenCalledWith({ x: 107, y: 100 });
      expect(target.dragTo).toHaveBeenCalledWith({ x: 150, y: 120 });
      expect(target.endDrag).toHaveBeenCalledTimes(1);
    });

    it("ends the drag when the system cancels the pointer", async () => {
      await attach("visible");
      fire("pointerdown", { x: 100, y: 100 });
      fire("pointermove", { x: 130, y: 100 });

      fire("pointercancel");

      expect(target.endDrag).toHaveBeenCalledTimes(1);
    });

    it("ends an active drag when the tab is hidden", async () => {
      await attach("visible");
      fire("pointerdown", { x: 100, y: 100 });
      fire("pointermove", { x: 130, y: 100 });

      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "hidden", { value: false, configurable: true });

      expect(target.endDrag).toHaveBeenCalledTimes(1);
    });
  });

  describe("touch, solid mode", () => {
    it("pans with one finger", async () => {
      await attach("solid");

      fire("pointerdown", { x: 100, y: 100 });
      fire("pointermove", { x: 80, y: 60 });

      expect(target.beginPan).toHaveBeenCalledWith({ x: 100, y: 100 });
      expect(target.panTo).toHaveBeenCalledWith({ x: 80, y: 60 });
    });

    it("pinches with two fingers around their midpoint, relative to the starting distance", async () => {
      await attach("solid");

      fire("pointerdown", { id: 1, x: 100, y: 200 });
      fire("pointerdown", { id: 2, x: 200, y: 200 });
      fire("pointermove", { id: 1, x: 50, y: 200 });
      fire("pointermove", { id: 2, x: 250, y: 200 });

      expect(target.beginPinch).toHaveBeenCalledWith({ x: 150, y: 200 });
      expect(target.pinchTo).toHaveBeenLastCalledWith(2);
    });

    it("does not pan with the remaining finger after a pinch until all fingers are lifted", async () => {
      await attach("solid");
      fire("pointerdown", { id: 1, x: 100, y: 200 });
      fire("pointerdown", { id: 2, x: 200, y: 200 });
      fire("pointerup", { id: 2 });
      target.panTo.mockClear();

      fire("pointermove", { id: 1, x: 10, y: 10 });
      expect(target.panTo).not.toHaveBeenCalled();

      fire("pointerup", { id: 1 });
      fire("pointerdown", { id: 3, x: 0, y: 0 });
      fire("pointermove", { id: 3, x: 5, y: 5 });
      expect(target.panTo).toHaveBeenCalledWith({ x: 5, y: 5 });
    });
  });

  describe("ignored input", () => {
    it("lets the browser handle touches in locked mode (native scrolling)", async () => {
      await attach("locked");

      fire("pointerdown", { x: 100, y: 100 });
      fire("pointermove", { x: 100, y: 300 });

      expect(target.beginDrag).not.toHaveBeenCalled();
      expect(target.beginPan).not.toHaveBeenCalled();
    });

    it("does nothing while disabled", async () => {
      enabled = false;
      await attach("visible");

      fire("pointerdown", { type: "mouse" });
      fire("pointerdown", { x: 0, y: 0 });
      fire("pointermove", { x: 50, y: 50 });

      expect(target.beginDrag).not.toHaveBeenCalled();
    });

    it("prevents Safari's page pinch-zoom over the overlay except when locked", async () => {
      await attach("solid");
      const gesture = new Event("gesturestart", { cancelable: true });
      node.dispatchEvent(gesture);
      expect(gesture.defaultPrevented).toBe(true);

      target.mode = "locked";
      const lockedGesture = new Event("gesturestart", { cancelable: true });
      node.dispatchEvent(lockedGesture);
      expect(lockedGesture.defaultPrevented).toBe(false);
    });

    it("removes its listeners when detached", async () => {
      await attach("visible");
      detach?.();
      detach = undefined;

      fire("pointerdown", { type: "mouse" });

      expect(target.beginDrag).not.toHaveBeenCalled();
    });
  });
});
