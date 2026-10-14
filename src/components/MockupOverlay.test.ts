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
    isSolidOrZoomed: false,
    mockupSize: { width: 800, height: 1500 },
    pageSize: { width: 1024, height: 3000 },
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

import MockupOverlay from "./MockupOverlay.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";

type MockStore = {
  -readonly [K in keyof typeof mockupOverlayStore]: (typeof mockupOverlayStore)[K];
};
const store = mockupOverlayStore as unknown as MockStore;
const dock = dockStore as { mode: DockMode };

const renderOverlay = () => {
  const result = render(MockupOverlay);
  return {
    ...result,
    viewport: () => result.container.querySelector<HTMLDivElement>(".mockup-viewport"),
    img: () => result.container.querySelector<HTMLImageElement>(".mockup-overlay")
  };
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
      isSolidOrZoomed: false,
      mockupSize: { width: 800, height: 1500 },
      pageSize: { width: 1024, height: 3000 }
    });
    dock.mode = "toolbar";
  });

  afterEach(() => {
    cleanup();
  });

  describe("conditional rendering", () => {
    it("renders the image inside a clipping viewport when visible with a mockup", () => {
      const { viewport, img } = renderOverlay();

      expect(viewport()).toBeInTheDocument();
      expect(viewport()?.style.height).toBe("3000px");
      expect(img()).toBeInTheDocument();
      expect(viewport()?.contains(img())).toBe(true);
      expect(img()?.getAttribute("src")).toBe("blob:test-url");
    });

    it("renders nothing when hidden", () => {
      store.isHidden = true;
      const { viewport, img } = renderOverlay();

      expect(viewport()).toBeNull();
      expect(img()).toBeNull();
    });

    it("renders nothing without a mockup", () => {
      store.activeMockupUrl = null;
      const { viewport, img } = renderOverlay();

      expect(viewport()).toBeNull();
      expect(img()).toBeNull();
    });
  });

  describe("style bindings", () => {
    it("applies transform with position and scale while keeping viewport bounded to host page height", () => {
      store.position = { x: -200, y: -100 };
      store.scale = 2;
      store.pageSize = { width: 1024, height: 2400 };

      const { viewport, img } = renderOverlay();
      expect(img()?.style.transform).toBe("translate3d(-200px, -100px, 0) scale(2)");
      expect(viewport()?.style.height).toBe("2400px");
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

    it("lets pointer events through to the host page when locked or in manager mode", () => {
      expect(renderOverlay().img()?.style.pointerEvents).toBe("auto");
      cleanup();

      store.mode = "locked";
      expect(renderOverlay().img()?.style.pointerEvents).toBe("none");
      cleanup();

      store.mode = "visible";
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
    it("reports the page size to the store on mount and on resize, collapsing the viewport during measurement", () => {
      Object.defineProperty(document.documentElement, "clientWidth", { value: 1024, configurable: true });
      const { viewport, unmount } = renderOverlay();

      let heightDuringRead = "";
      Object.defineProperty(document.documentElement, "scrollHeight", {
        get: () => {
          heightDuringRead = viewport()?.style.height ?? "";
          return 1800;
        },
        configurable: true
      });

      Object.defineProperty(document.documentElement, "clientWidth", { value: 1440, configurable: true });
      window.dispatchEvent(new Event("resize"));
      expect(heightDuringRead).toBe("0px");
      expect(viewport()?.style.height).toBe("3000px");
      expect(store.setPageSize).toHaveBeenLastCalledWith({ width: 1440, height: 1800 });

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
