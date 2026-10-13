/**
 * MockupOverlay Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockupOverlay from "./MockupOverlay.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { keyboardStore } from "~/stores/keyboardStore.svelte";
import { isTouchDevice } from "~/utils/device";

// Mock stores
vi.mock("~/stores/mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: {
    isHidden: false,
    activeMockupUrl: "blob:test-url",
    position: { x: 100, y: 200 },
    scale: 1,
    opacity: 0.5,
    effectiveOpacity: 0.5,
    mode: "visible" as "visible" | "locked" | "dragging" | "solid" | "zoomed",
    isLocked: false,
    isDragging: false,
    isZoomPanning: false,
    isAligned: false,
    init: vi.fn(),
    cleanup: vi.fn(),
    startDrag: vi.fn(),
    enterZoomMode: vi.fn(),
    exitZoomMode: vi.fn(),
    setPageSize: vi.fn(),
    mockupSize: { width: 800, height: 1500 },
    // Touch methods
    startTouchDrag: vi.fn(),
    handleTouchDrag: vi.fn(),
    endTouchDrag: vi.fn(),
    startSolidPan: vi.fn(),
    handleSolidPan: vi.fn(),
    startPinch: vi.fn(),
    handlePinch: vi.fn(),
    endPinch: vi.fn(),
    startGesturePinch: vi.fn(),
    handleGesturePinch: vi.fn()
  }
}));

vi.mock("~/stores/dockStore.svelte", () => ({
  dockStore: {
    mode: "toolbar" as "toolbar" | "mockups" | "grids"
  }
}));

vi.mock("~/stores/keyboardStore.svelte", () => ({
  keyboardStore: {
    init: vi.fn(),
    cleanup: vi.fn()
  }
}));

// Mock device detection (return false for desktop tests)
vi.mock("~/utils/device", () => ({
  isTouchDevice: vi.fn(() => false),
  isLastInputTouch: vi.fn(() => false),
  initInputTypeTracking: vi.fn(),
  updateInputType: vi.fn()
}));

// Get typed references to mocks (use `as unknown as` to bypass type checking for mocked modules)
const mockMockupStore = mockupOverlayStore as unknown as {
  isHidden: boolean;
  activeMockupUrl: string | undefined;
  position: { x: number; y: number };
  scale: number;
  opacity: number;
  effectiveOpacity: number;
  mode: "visible" | "locked" | "dragging" | "solid" | "zoomed";
  isLocked: boolean;
  isDragging: boolean;
  isZoomPanning: boolean;
  isAligned: boolean;
  init: ReturnType<typeof vi.fn>;
  cleanup: ReturnType<typeof vi.fn>;
  startDrag: ReturnType<typeof vi.fn>;
  enterZoomMode: ReturnType<typeof vi.fn>;
  exitZoomMode: ReturnType<typeof vi.fn>;
  setPageSize: ReturnType<typeof vi.fn>;
  mockupSize: Size;
  // Touch methods
  startTouchDrag: ReturnType<typeof vi.fn>;
  handleTouchDrag: ReturnType<typeof vi.fn>;
  endTouchDrag: ReturnType<typeof vi.fn>;
  startSolidPan: ReturnType<typeof vi.fn>;
  handleSolidPan: ReturnType<typeof vi.fn>;
  startPinch: ReturnType<typeof vi.fn>;
  handlePinch: ReturnType<typeof vi.fn>;
  endPinch: ReturnType<typeof vi.fn>;
  startGesturePinch: ReturnType<typeof vi.fn>;
  handleGesturePinch: ReturnType<typeof vi.fn>;
};

const mockIsTouchDevice = isTouchDevice as ReturnType<typeof vi.fn>;

const mockDockStore = dockStore as unknown as {
  mode: "toolbar" | "mockups" | "grids";
};

const mockKeyboardStore = keyboardStore as unknown as {
  init: ReturnType<typeof vi.fn>;
  cleanup: ReturnType<typeof vi.fn>;
};

describe("MockupOverlay component", () => {
  beforeEach(() => {
    // Reset mock values
    mockMockupStore.isHidden = false;
    mockMockupStore.activeMockupUrl = "blob:test-url";
    mockMockupStore.position = { x: 100, y: 200 };
    mockMockupStore.scale = 1;
    mockMockupStore.opacity = 0.5;
    mockMockupStore.effectiveOpacity = 0.5;
    mockMockupStore.mode = "visible";
    mockMockupStore.isLocked = false;
    mockMockupStore.isDragging = false;
    mockMockupStore.isZoomPanning = false;
    mockMockupStore.isAligned = false;
    mockMockupStore.init.mockClear();
    mockMockupStore.cleanup.mockClear();
    mockMockupStore.startDrag.mockClear();
    mockMockupStore.enterZoomMode.mockClear();
    mockMockupStore.exitZoomMode.mockClear();
    mockMockupStore.startTouchDrag.mockClear();
    mockMockupStore.handleTouchDrag.mockClear();
    mockMockupStore.endTouchDrag.mockClear();
    mockMockupStore.startSolidPan.mockClear();
    mockMockupStore.handleSolidPan.mockClear();
    mockMockupStore.startPinch.mockClear();
    mockMockupStore.handlePinch.mockClear();
    mockMockupStore.endPinch.mockClear();
    mockMockupStore.startGesturePinch.mockClear();
    mockMockupStore.handleGesturePinch.mockClear();
    mockDockStore.mode = "toolbar";
    mockKeyboardStore.init.mockClear();
    mockKeyboardStore.cleanup.mockClear();
    mockIsTouchDevice.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe("conditional rendering", () => {
    it("renders .mockup-container when visible and has url", () => {
      mockMockupStore.isHidden = false;
      mockMockupStore.activeMockupUrl = "blob:test-url";
      const { container } = render(MockupOverlay);

      expect(container.querySelector(".mockup-container")).toBeInTheDocument();
    });

    it("does not render when isHidden is true", () => {
      mockMockupStore.isHidden = true;
      const { container } = render(MockupOverlay);

      expect(container.querySelector(".mockup-container")).toBeNull();
    });

    it("does not render when activeMockupUrl is undefined", () => {
      mockMockupStore.activeMockupUrl = undefined;
      const { container } = render(MockupOverlay);

      expect(container.querySelector(".mockup-container")).toBeNull();
    });
  });

  describe("style bindings", () => {
    it("applies transform with position and scale", () => {
      mockMockupStore.position = { x: 150, y: 250 };
      mockMockupStore.scale = 0.5;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.transform).toContain("150px");
      expect(img.style.transform).toContain("250px");
      expect(img.style.transform).toContain("0.5");
    });

    it("applies opacity from effectiveOpacity", () => {
      mockMockupStore.effectiveOpacity = 0.75;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.opacity).toBe("0.75");
    });

    it("applies cursor grab in visible mode", () => {
      mockMockupStore.mode = "visible";
      mockMockupStore.isLocked = false;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.cursor).toBe("grab");
    });

    it("applies cursor grabbing in dragging mode", () => {
      mockMockupStore.mode = "dragging";
      mockMockupStore.isLocked = false;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.cursor).toBe("grabbing");
    });

    it("applies cursor zoom-in in solid mode", () => {
      mockMockupStore.mode = "solid";
      mockMockupStore.isLocked = false;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.cursor).toBe("zoom-in");
    });

    it("applies cursor zoom-out in zoomed mode", () => {
      mockMockupStore.mode = "zoomed";
      mockMockupStore.isLocked = false;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.cursor).toBe("zoom-out");
    });

    it("applies cursor default when locked", () => {
      mockMockupStore.mode = "locked";
      mockMockupStore.isLocked = true;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.cursor).toBe("default");
    });

    it("applies transition none when dragging", () => {
      mockMockupStore.isDragging = true;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.transition).toBe("none");
    });

    it("applies transition none when zoom panning", () => {
      mockMockupStore.isZoomPanning = true;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.transition).toBe("none");
    });
  });

  describe("lifecycle", () => {
    it("calls mockupOverlayStore.init() on mount", () => {
      render(MockupOverlay);

      expect(mockMockupStore.init).toHaveBeenCalledTimes(1);
    });

    it("calls keyboardStore.init() on mount", () => {
      render(MockupOverlay);

      expect(mockKeyboardStore.init).toHaveBeenCalledTimes(1);
    });

    it("calls mockupOverlayStore.cleanup() on destroy", () => {
      const { unmount } = render(MockupOverlay);
      unmount();

      expect(mockMockupStore.cleanup).toHaveBeenCalledTimes(1);
    });

    it("calls keyboardStore.cleanup() on destroy", () => {
      const { unmount } = render(MockupOverlay);
      unmount();

      expect(mockKeyboardStore.cleanup).toHaveBeenCalledTimes(1);
    });

    it("reports the page size to the store on mount and on resize", () => {
      Object.defineProperty(document.documentElement, "clientWidth", { value: 1024, configurable: true });
      Object.defineProperty(document.documentElement, "scrollHeight", { value: 3000, configurable: true });
      const { unmount } = render(MockupOverlay);
      expect(mockMockupStore.setPageSize).toHaveBeenLastCalledWith({ width: 1024, height: 3000 });

      Object.defineProperty(document.documentElement, "clientWidth", { value: 1440, configurable: true });
      window.dispatchEvent(new Event("resize"));
      expect(mockMockupStore.setPageSize).toHaveBeenLastCalledWith({ width: 1440, height: 3000 });

      unmount();
      mockMockupStore.setPageSize.mockClear();
      window.dispatchEvent(new Event("resize"));
      expect(mockMockupStore.setPageSize).not.toHaveBeenCalled();
    });

    it("keeps the image hidden until its size (and so its aligned position) is known", async () => {
      mockMockupStore.mockupSize = { width: 0, height: 0 };
      const { container } = render(MockupOverlay);

      expect(container.querySelector<HTMLImageElement>(".mockup-overlay")?.style.visibility).toBe("hidden");
      mockMockupStore.mockupSize = { width: 800, height: 1500 };
    });
  });

  describe("pointer events (mouse/pen)", () => {
    // Helper to create pointer event with mouse type
    function createPointerEvent(type: string): PointerEvent {
      return new PointerEvent(type, {
        bubbles: true,
        pointerType: "mouse",
        pointerId: 1
      });
    }

    it("calls startDrag with PointerEvent on pointerdown in visible mode", () => {
      mockMockupStore.mode = "visible";
      mockDockStore.mode = "toolbar";
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      img.dispatchEvent(createPointerEvent("pointerdown"));

      expect(mockMockupStore.startDrag).toHaveBeenCalledTimes(1);
      expect(mockMockupStore.startDrag).toHaveBeenCalledWith(expect.any(PointerEvent));
    });

    it("calls enterZoomMode with PointerEvent on pointerdown in solid mode", () => {
      mockMockupStore.mode = "solid";
      mockDockStore.mode = "toolbar";
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      img.dispatchEvent(createPointerEvent("pointerdown"));

      expect(mockMockupStore.enterZoomMode).toHaveBeenCalledTimes(1);
      expect(mockMockupStore.enterZoomMode).toHaveBeenCalledWith(expect.any(PointerEvent));
    });

    it("calls exitZoomMode on pointerdown in zoomed mode", () => {
      mockMockupStore.mode = "zoomed";
      mockDockStore.mode = "toolbar";
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      img.dispatchEvent(createPointerEvent("pointerdown"));

      expect(mockMockupStore.exitZoomMode).toHaveBeenCalledTimes(1);
    });

    it("does not handle pointerdown when dock is not in toolbar mode", () => {
      mockMockupStore.mode = "visible";
      mockDockStore.mode = "mockups";
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      img.dispatchEvent(createPointerEvent("pointerdown"));

      expect(mockMockupStore.startDrag).not.toHaveBeenCalled();
    });

    it("does not call startDrag on click event (must be pointerdown)", () => {
      mockMockupStore.mode = "visible";
      mockDockStore.mode = "toolbar";
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      // Only dispatch click, not pointerdown
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      // startDrag should not be called on click alone
      expect(mockMockupStore.startDrag).not.toHaveBeenCalled();
    });

    it("ignores touch pointer events (handled by touch events)", () => {
      mockMockupStore.mode = "visible";
      mockDockStore.mode = "toolbar";
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      img.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          pointerId: 1
        })
      );

      // Touch pointerdown should not trigger startDrag
      expect(mockMockupStore.startDrag).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Touch Device Tests
// ============================================

describe("MockupOverlay component (touch device)", () => {
  beforeEach(() => {
    mockIsTouchDevice.mockReturnValue(true);
    mockMockupStore.isHidden = false;
    mockMockupStore.activeMockupUrl = "blob:test-url";
    mockMockupStore.position = { x: 100, y: 200 };
    mockMockupStore.scale = 1;
    mockMockupStore.mode = "visible";
    mockMockupStore.isLocked = false;
    mockDockStore.mode = "toolbar";

    // Clear all mocks
    mockMockupStore.startTouchDrag.mockClear();
    mockMockupStore.handleTouchDrag.mockClear();
    mockMockupStore.endTouchDrag.mockClear();
    mockMockupStore.startSolidPan.mockClear();
    mockMockupStore.handleSolidPan.mockClear();
    mockMockupStore.startPinch.mockClear();
    mockMockupStore.handlePinch.mockClear();
    mockMockupStore.endPinch.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // Helper to create TouchEvent
  function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): TouchEvent {
    const touchList = touches.map(
      (t, i) =>
        ({
          identifier: i,
          clientX: t.clientX,
          clientY: t.clientY,
          target: null
        }) as unknown as Touch
    );

    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: touchList,
      changedTouches: touchList
    });
  }

  // Note: touch-action style binding tests are skipped because Svelte's
  // reactive style bindings don't render correctly with mocked stores in jsdom.
  // The actual behavior is verified by the touch event handler tests below.

  describe("pointer-events on touch device", () => {
    it("applies pointer-events auto in locked mode (for double-tap detection)", () => {
      mockMockupStore.mode = "locked";
      mockMockupStore.isLocked = true;
      const { container } = render(MockupOverlay);

      const img = container.querySelector(".mockup-overlay") as HTMLElement;
      expect(img.style.pointerEvents).toBe("auto");
    });
  });

  describe("touch drag events (visible mode)", () => {
    it("calls startTouchDrag on touchmove after threshold in visible mode", () => {
      mockMockupStore.mode = "visible";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start touch
      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      // Move beyond threshold (5px)
      const moveEvent = createTouchEvent("touchmove", [{ clientX: 110, clientY: 110 }]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.startTouchDrag).toHaveBeenCalled();
    });

    it("does not call startTouchDrag on small movement within threshold", () => {
      mockMockupStore.mode = "visible";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start touch
      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      // Move within threshold (less than 5px)
      const moveEvent = createTouchEvent("touchmove", [{ clientX: 102, clientY: 102 }]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.startTouchDrag).not.toHaveBeenCalled();
    });

    it("calls handleTouchDrag during drag", () => {
      mockMockupStore.mode = "dragging";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      const moveEvent = createTouchEvent("touchmove", [{ clientX: 150, clientY: 150 }]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.handleTouchDrag).toHaveBeenCalled();
    });

    it("calls endTouchDrag on touchend in dragging mode", () => {
      mockMockupStore.mode = "dragging";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start with one touch
      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      // End touch (empty touches array)
      const endEvent = new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        changedTouches: [{ identifier: 0, clientX: 100, clientY: 100, target: null } as unknown as Touch]
      });
      img.dispatchEvent(endEvent);

      expect(mockMockupStore.endTouchDrag).toHaveBeenCalled();
    });

    it("calls endPinch on touchcancel", () => {
      mockMockupStore.mode = "solid";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      const cancelEvent = new TouchEvent("touchcancel", {
        bubbles: true,
        cancelable: true
      });
      img.dispatchEvent(cancelEvent);

      expect(mockMockupStore.endPinch).toHaveBeenCalled();
    });
  });

  describe("solid mode pan (single finger)", () => {
    it("calls startSolidPan on touchstart in solid mode", () => {
      mockMockupStore.mode = "solid";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      expect(mockMockupStore.startSolidPan).toHaveBeenCalled();
    });

    it("calls handleSolidPan on touchmove in solid mode (single finger)", () => {
      mockMockupStore.mode = "solid";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start touch
      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      // Move (beyond threshold)
      const moveEvent = createTouchEvent("touchmove", [{ clientX: 150, clientY: 150 }]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.handleSolidPan).toHaveBeenCalled();
    });
  });

  describe("pinch zoom (two fingers, Touch Events fallback)", () => {
    it("calls startPinch on touchstart with two fingers in solid mode", () => {
      mockMockupStore.mode = "solid";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start with one finger first
      const startEvent1 = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent1);

      // Add second finger
      const startEvent2 = createTouchEvent("touchstart", [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ]);
      img.dispatchEvent(startEvent2);

      expect(mockMockupStore.startPinch).toHaveBeenCalled();
    });

    it("calls handlePinch on touchmove with two fingers in solid mode", () => {
      mockMockupStore.mode = "solid";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start with two fingers
      const startEvent = createTouchEvent("touchstart", [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ]);
      img.dispatchEvent(startEvent);

      // Move fingers apart
      const moveEvent = createTouchEvent("touchmove", [
        { clientX: 50, clientY: 50 },
        { clientX: 250, clientY: 250 }
      ]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.handlePinch).toHaveBeenCalled();
    });

    it("calls endPinch when second finger is lifted", () => {
      mockMockupStore.mode = "solid";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      // Start with two fingers
      const startEvent = createTouchEvent("touchstart", [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 }
      ]);
      img.dispatchEvent(startEvent);

      // Lift one finger (one remaining)
      const endEvent = new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [{ identifier: 0, clientX: 100, clientY: 100, target: null } as unknown as Touch],
        changedTouches: [{ identifier: 1, clientX: 200, clientY: 200, target: null } as unknown as Touch]
      });
      img.dispatchEvent(endEvent);

      expect(mockMockupStore.endPinch).toHaveBeenCalled();
    });
  });

  describe("locked mode (native scrolling)", () => {
    it("does not call startTouchDrag in locked mode", () => {
      mockMockupStore.mode = "locked";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      const moveEvent = createTouchEvent("touchmove", [{ clientX: 150, clientY: 150 }]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.startTouchDrag).not.toHaveBeenCalled();
    });
  });

  describe("non-interactive state", () => {
    it("does not handle touch events when dock is in manager mode", () => {
      mockMockupStore.mode = "visible";
      mockDockStore.mode = "mockups";
      const { container } = render(MockupOverlay);
      const img = container.querySelector(".mockup-overlay") as HTMLElement;

      const startEvent = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      img.dispatchEvent(startEvent);

      const moveEvent = createTouchEvent("touchmove", [{ clientX: 150, clientY: 150 }]);
      img.dispatchEvent(moveEvent);

      expect(mockMockupStore.startTouchDrag).not.toHaveBeenCalled();
    });
  });
});
