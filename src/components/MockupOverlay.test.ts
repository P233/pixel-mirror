/**
 * MockupOverlay Component Tests
 *
 * Rendering, style bindings and lifecycle. Gesture recognition itself is tested in
 * features/overlay/gestures.test.ts.
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OverlayMode } from "~/features/overlay/model";

vi.mock("~/stores/mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: {
    isHidden: false,
    activeMockupUrl: "blob:test-url" as string | null,
    position: { x: 100, y: 200 },
    scale: 1,
    effectiveOpacity: 0.5,
    mode: "visible" as OverlayMode,
    isDragging: false,
    isZoomPanning: false,
    mockupSize: { width: 800, height: 1500 },
    init: vi.fn(),
    setPageSize: vi.fn(),
    beginDrag: vi.fn(),
    dragTo: vi.fn(),
    endDrag: vi.fn(),
    beginPan: vi.fn(),
    panTo: vi.fn(),
    beginPinch: vi.fn(),
    pinchTo: vi.fn(),
    enterZoomMode: vi.fn(),
    exitZoomMode: vi.fn(),
    zoomPanTo: vi.fn()
  }
}));

vi.mock("~/stores/dockStore.svelte", () => ({
  dockStore: { mode: "toolbar" as DockMode }
}));

vi.mock("~/stores/keyboardStore.svelte", () => ({
  keyboardStore: { init: vi.fn(), cleanup: vi.fn() }
}));

vi.mock("~/utils/device", () => ({ initInputTypeTracking: vi.fn() }));

import MockupOverlay from "./MockupOverlay.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { keyboardStore } from "~/stores/keyboardStore.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";

type MockStore = {
  -readonly [K in keyof typeof mockupOverlayStore]: (typeof mockupOverlayStore)[K];
};
const store = mockupOverlayStore as unknown as MockStore;
const dock = dockStore as { mode: DockMode };

const renderOverlay = () => {
  const result = render(MockupOverlay);
  return { ...result, img: () => result.container.querySelector<HTMLImageElement>(".mockup-overlay") };
};

describe("MockupOverlay component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(store, {
      isHidden: false,
      activeMockupUrl: "blob:test-url",
      position: { x: 100, y: 200 },
      scale: 1,
      effectiveOpacity: 0.5,
      mode: "visible",
      isDragging: false,
      isZoomPanning: false,
      mockupSize: { width: 800, height: 1500 }
    });
    dock.mode = "toolbar";
  });

  afterEach(() => {
    cleanup();
  });

  describe("conditional rendering", () => {
    it("renders the image when visible with a mockup", () => {
      const { img } = renderOverlay();

      expect(img()).toBeInTheDocument();
      expect(img()?.getAttribute("src")).toBe("blob:test-url");
    });

    it("renders nothing when hidden", () => {
      store.isHidden = true;
      const { container } = renderOverlay();

      expect(container.querySelector(".mockup-container")).toBeNull();
    });

    it("renders nothing without a mockup", () => {
      store.activeMockupUrl = null;
      const { container } = renderOverlay();

      expect(container.querySelector(".mockup-container")).toBeNull();
    });
  });

  describe("style bindings", () => {
    it("applies transform with position and scale", () => {
      store.position = { x: 50, y: 75 };
      store.scale = 0.5;

      expect(renderOverlay().img()?.style.transform).toBe("translate3d(50px, 75px, 0) scale(0.5)");
    });

    it("applies the effective opacity", () => {
      store.effectiveOpacity = 1;

      expect(renderOverlay().img()?.style.opacity).toBe("1");
    });

    it.each<[OverlayMode, string]>([
      ["visible", "grab"],
      ["dragging", "grabbing"],
      ["solid", "zoom-in"],
      ["zoomed", "zoom-out"],
      ["locked", "default"]
    ])("uses the %s cursor %s", (mode, cursor) => {
      store.mode = mode;

      expect(renderOverlay().img()?.style.cursor).toBe(cursor);
    });

    it.each<[OverlayMode, string]>([
      ["visible", "none"],
      ["solid", "none"],
      ["locked", "pan-x pan-y"]
    ])("sets touch-action in %s mode to %s", (mode, touchAction) => {
      store.mode = mode;

      expect(renderOverlay().img()?.style.touchAction).toBe(touchAction);
    });

    it("turns the transition off while dragging, zoom panning and in solid mode", () => {
      store.isDragging = true;
      expect(renderOverlay().img()?.style.transition).toBe("none");
      cleanup();

      store.isDragging = false;
      store.isZoomPanning = true;
      expect(renderOverlay().img()?.style.transition).toBe("none");
      cleanup();

      store.isZoomPanning = false;
      store.mode = "solid";
      expect(renderOverlay().img()?.style.transition).toBe("none");
    });

    it("animates transform changes otherwise", () => {
      expect(renderOverlay().img()?.style.transition).toBe("transform 0.2s ease-out");
    });

    it("lets pointer events through only in toolbar mode", () => {
      expect(renderOverlay().img()?.style.pointerEvents).toBe("auto");
      cleanup();

      dock.mode = "mockups";
      const { img } = renderOverlay();
      expect(img()?.style.pointerEvents).toBe("none");
      expect(img()?.style.cursor).toBe("default");
    });

    it("keeps the image hidden until its size (and so its aligned position) is known", () => {
      store.mockupSize = { width: 0, height: 0 };

      expect(renderOverlay().img()?.style.visibility).toBe("hidden");
    });
  });

  describe("lifecycle", () => {
    it("initializes the overlay and keyboard stores on mount", () => {
      renderOverlay();

      expect(store.init).toHaveBeenCalledTimes(1);
      expect(keyboardStore.init).toHaveBeenCalledTimes(1);
    });

    it("cleans up the keyboard store on destroy", () => {
      renderOverlay().unmount();

      expect(keyboardStore.cleanup).toHaveBeenCalledTimes(1);
    });

    it("reports the page size to the store on mount and on resize, until destroyed", () => {
      Object.defineProperty(document.documentElement, "clientWidth", { value: 1024, configurable: true });
      Object.defineProperty(document.documentElement, "scrollHeight", { value: 3000, configurable: true });
      const { unmount } = renderOverlay();
      expect(store.setPageSize).toHaveBeenLastCalledWith({ width: 1024, height: 3000 });

      Object.defineProperty(document.documentElement, "clientWidth", { value: 1440, configurable: true });
      window.dispatchEvent(new Event("resize"));
      expect(store.setPageSize).toHaveBeenLastCalledWith({ width: 1440, height: 3000 });

      unmount();
      vi.mocked(store.setPageSize).mockClear();
      window.dispatchEvent(new Event("resize"));
      expect(store.setPageSize).not.toHaveBeenCalled();
    });
  });

  describe("gestures", () => {
    it("starts a mouse drag on pointerdown", async () => {
      const { img } = renderOverlay();
      await Promise.resolve(); // svelte/events attaches pointer listeners after a microtask

      img()!.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: "mouse", button: 0, clientX: 10, clientY: 20 })
      );

      expect(store.beginDrag).toHaveBeenCalledWith({ x: 10, y: 20 });
    });

    it("ignores pointers while the dock is in a manager panel", async () => {
      dock.mode = "grids";
      const { img } = renderOverlay();
      await Promise.resolve();

      img()!.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", button: 0 }));

      expect(store.beginDrag).not.toHaveBeenCalled();
    });
  });
});
