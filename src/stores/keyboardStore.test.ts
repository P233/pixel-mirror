/**
 * KeyboardStore Tests
 *
 * Tests for centralized keyboard event handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dockStore
vi.mock("./dockStore.svelte", () => ({
  dockStore: {
    mode: "toolbar" as "toolbar" | "mockups" | "grids"
  }
}));

// Mock mockupOverlayStore
vi.mock("./mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: {
    isHidden: false,
    activeMockupUrl: "blob:mockup" as string | null,
    mode: "visible" as "visible" | "locked" | "dragging" | "solid" | "zoomed",
    adjustOpacity: vi.fn(),
    enterSolidMode: vi.fn(),
    exitSolidMode: vi.fn(),
    toggleLock: vi.fn(),
    move: vi.fn(),
    persistPosition: vi.fn()
  }
}));

describe("keyboardStore", () => {
  let keyboardStore: typeof import("./keyboardStore.svelte").keyboardStore;
  let dockStore: { mode: "toolbar" | "mockups" | "grids" };
  let mockupOverlayStore: {
    isHidden: boolean;
    activeMockupUrl: string | null;
    mode: "visible" | "locked" | "dragging" | "solid" | "zoomed";
    adjustOpacity: ReturnType<typeof vi.fn>;
    enterSolidMode: ReturnType<typeof vi.fn>;
    exitSolidMode: ReturnType<typeof vi.fn>;
    toggleLock: ReturnType<typeof vi.fn>;
    move: ReturnType<typeof vi.fn>;
    persistPosition: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    // Get fresh mocks
    const dockModule = await import("./dockStore.svelte");
    const mockupModule = await import("./mockupOverlayStore.svelte");

    dockStore = dockModule.dockStore as unknown as typeof dockStore;
    mockupOverlayStore = mockupModule.mockupOverlayStore as unknown as typeof mockupOverlayStore;

    // Reset mock state
    dockStore.mode = "toolbar";
    mockupOverlayStore.isHidden = false;
    mockupOverlayStore.activeMockupUrl = "blob:mockup";
    mockupOverlayStore.mode = "visible";
    mockupOverlayStore.adjustOpacity.mockReset();
    mockupOverlayStore.enterSolidMode.mockReset();
    mockupOverlayStore.exitSolidMode.mockReset();
    mockupOverlayStore.toggleLock.mockReset();
    mockupOverlayStore.move.mockReset();
    mockupOverlayStore.persistPosition.mockReset();

    // Import fresh store
    const module = await import("./keyboardStore.svelte");
    keyboardStore = module.keyboardStore;
  });

  afterEach(() => {
    keyboardStore.cleanup();
  });

  describe("initial state", () => {
    it("has all modifier keys as false", () => {
      expect(keyboardStore.isControlPressed).toBe(false);
      expect(keyboardStore.isShiftPressed).toBe(false);
      expect(keyboardStore.isSpacePressed).toBe(false);
    });
  });

  describe("init and cleanup", () => {
    it("initializes event listeners", () => {
      const addSpy = vi.spyOn(window, "addEventListener");

      keyboardStore.init();

      expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith("keyup", expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith("blur", expect.any(Function));

      addSpy.mockRestore();
    });

    it("only initializes once", () => {
      const addSpy = vi.spyOn(window, "addEventListener");

      keyboardStore.init();
      keyboardStore.init();

      const keydownCalls = addSpy.mock.calls.filter((c) => c[0] === "keydown");
      expect(keydownCalls).toHaveLength(1);

      addSpy.mockRestore();
    });

    it("removes event listeners on cleanup", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");

      keyboardStore.init();
      keyboardStore.cleanup();

      expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("keyup", expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith("blur", expect.any(Function));

      removeSpy.mockRestore();
    });

    it("cleanup does nothing if not initialized", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");

      keyboardStore.cleanup();

      expect(removeSpy).not.toHaveBeenCalled();

      removeSpy.mockRestore();
    });
  });

  describe("without an active mockup", () => {
    beforeEach(() => {
      keyboardStore.init();
      mockupOverlayStore.activeMockupUrl = null;
    });

    it.each(["ArrowDown", " ", "Escape"])("leaves '%s' to the host page", (key) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(mockupOverlayStore.move).not.toHaveBeenCalled();
      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();
      expect(mockupOverlayStore.toggleLock).not.toHaveBeenCalled();
    });

    it("does not persist position on arrow key release", () => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown" }));

      expect(mockupOverlayStore.persistPosition).not.toHaveBeenCalled();
    });
  });

  describe("Control key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("tracks Control key press", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      expect(keyboardStore.isControlPressed).toBe(true);
    });

    it("tracks Control key release", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" }));

      expect(keyboardStore.isControlPressed).toBe(false);
    });

    it("attaches wheel listener when Control is pressed", () => {
      const addSpy = vi.spyOn(window, "addEventListener");

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      expect(addSpy).toHaveBeenCalledWith("wheel", expect.any(Function), { passive: false });

      addSpy.mockRestore();
    });

    it("detaches wheel listener when Control is released", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Control" }));

      expect(removeSpy).toHaveBeenCalledWith("wheel", expect.any(Function));

      removeSpy.mockRestore();
    });
  });

  describe("Shift key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("tracks Shift key press", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));

      expect(keyboardStore.isShiftPressed).toBe(true);
    });

    it("tracks Shift key release", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));

      expect(keyboardStore.isShiftPressed).toBe(false);
    });
  });

  describe("Space key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("enters solid mode on space press in visible mode", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).toHaveBeenCalled();
      expect(keyboardStore.isSpacePressed).toBe(true);
    });

    it("enters solid mode on space press in locked mode", () => {
      mockupOverlayStore.mode = "locked";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).toHaveBeenCalled();
    });

    it("exits solid mode on space release", () => {
      mockupOverlayStore.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));

      expect(mockupOverlayStore.exitSolidMode).toHaveBeenCalled();
      expect(keyboardStore.isSpacePressed).toBe(false);
    });

    it("does not enter solid mode in dragging mode", () => {
      mockupOverlayStore.mode = "dragging";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();
    });

    it("does not enter solid mode when mockup is hidden", () => {
      mockupOverlayStore.isHidden = true;

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();
    });

    it("does not enter solid mode when dock is in manager mode", () => {
      dockStore.mode = "mockups";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();
    });
  });

  describe("Escape key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("toggles lock on Escape in visible mode", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(mockupOverlayStore.toggleLock).toHaveBeenCalled();
    });

    it("toggles lock on Escape in locked mode", () => {
      mockupOverlayStore.mode = "locked";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(mockupOverlayStore.toggleLock).toHaveBeenCalled();
    });

    it("does not toggle lock in other modes", () => {
      mockupOverlayStore.mode = "dragging";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(mockupOverlayStore.toggleLock).not.toHaveBeenCalled();
    });
  });

  describe("Arrow key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("moves mockup up on ArrowUp", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));

      expect(mockupOverlayStore.move).toHaveBeenCalledWith(0, -1);
    });

    it("moves mockup down on ArrowDown", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));

      expect(mockupOverlayStore.move).toHaveBeenCalledWith(0, 1);
    });

    it("moves mockup left on ArrowLeft", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));

      expect(mockupOverlayStore.move).toHaveBeenCalledWith(-1, 0);
    });

    it("moves mockup right on ArrowRight", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

      expect(mockupOverlayStore.move).toHaveBeenCalledWith(1, 0);
    });

    it("moves 10 pixels when Shift is held", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true }));

      expect(mockupOverlayStore.move).toHaveBeenCalledWith(10, 0);
    });

    it("persists position on arrow key release", () => {
      mockupOverlayStore.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight" }));

      expect(mockupOverlayStore.persistPosition).toHaveBeenCalled();
    });

    it("does not move in locked mode", () => {
      mockupOverlayStore.mode = "locked";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

      expect(mockupOverlayStore.move).not.toHaveBeenCalled();
    });
  });

  describe("wheel event for opacity", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("adjusts opacity on wheel when Control is pressed", () => {
      mockupOverlayStore.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: 100 });
      window.dispatchEvent(wheelEvent);

      expect(mockupOverlayStore.adjustOpacity).toHaveBeenCalledWith(-1);
    });

    it("adjusts opacity in positive direction on scroll up", () => {
      mockupOverlayStore.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: -100 });
      window.dispatchEvent(wheelEvent);

      expect(mockupOverlayStore.adjustOpacity).toHaveBeenCalledWith(1);
    });

    it("adjusts opacity in locked mode", () => {
      mockupOverlayStore.mode = "locked";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: 100 });
      window.dispatchEvent(wheelEvent);

      expect(mockupOverlayStore.adjustOpacity).toHaveBeenCalled();
    });

    it("does not adjust opacity in other modes", () => {
      mockupOverlayStore.mode = "dragging";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: 100 });
      window.dispatchEvent(wheelEvent);

      expect(mockupOverlayStore.adjustOpacity).not.toHaveBeenCalled();
    });
  });

  describe("keys reserved for the host page and browser", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    const press = (key: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init });
      window.dispatchEvent(event);
      return event;
    };

    it.each([{ metaKey: true }, { altKey: true }, { ctrlKey: true }])("ignores arrow keys with %o", (modifier) => {
      const event = press("ArrowLeft", modifier);

      expect(event.defaultPrevented).toBe(false);
      expect(mockupOverlayStore.move).not.toHaveBeenCalled();
    });

    it("still nudges by 10px with Shift + arrow", () => {
      press("ArrowLeft", { shiftKey: true });

      expect(mockupOverlayStore.move).toHaveBeenCalledWith(-10, 0);
    });

    it("leaves Shift+Space (page up) to the browser", () => {
      const event = press(" ", { shiftKey: true });

      expect(event.defaultPrevented).toBe(false);
      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();
    });

    it("ignores keys during IME composition", () => {
      const event = press("ArrowDown", { isComposing: true });

      expect(event.defaultPrevented).toBe(false);
      expect(mockupOverlayStore.move).not.toHaveBeenCalled();
    });

    it("ignores keys the host page already handled", () => {
      const hostHandler = (e: KeyboardEvent) => e.preventDefault();
      window.addEventListener("keydown", hostHandler, { capture: true });

      press("Escape");
      press("ArrowDown");

      window.removeEventListener("keydown", hostHandler, { capture: true });
      expect(mockupOverlayStore.toggleLock).not.toHaveBeenCalled();
      expect(mockupOverlayStore.move).not.toHaveBeenCalled();
    });

    it("ignores keys typed into an input inside an open shadow root", () => {
      const host = document.createElement("div");
      const input = document.createElement("input");
      host.attachShadow({ mode: "open" }).appendChild(input);
      document.body.appendChild(host);

      const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(event);

      document.body.removeChild(host);
      expect(event.defaultPrevented).toBe(false);
      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();
    });
  });

  describe("input element detection", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("ignores keydown when focused on input", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it("ignores keydown when focused on textarea", () => {
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it("ignores keydown when focused on select", () => {
      const select = document.createElement("select");
      document.body.appendChild(select);
      select.focus();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(mockupOverlayStore.enterSolidMode).not.toHaveBeenCalled();

      document.body.removeChild(select);
    });
  });

  describe("resetModifierStates", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("resets Control key state", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      expect(keyboardStore.isControlPressed).toBe(true);

      keyboardStore.resetModifierStates();

      expect(keyboardStore.isControlPressed).toBe(false);
    });

    it("resets Space key state and exits solid mode", () => {
      mockupOverlayStore.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      expect(keyboardStore.isSpacePressed).toBe(true);

      keyboardStore.resetModifierStates();

      expect(keyboardStore.isSpacePressed).toBe(false);
      expect(mockupOverlayStore.exitSolidMode).toHaveBeenCalled();
    });

    it("resets Shift key state", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
      expect(keyboardStore.isShiftPressed).toBe(true);

      keyboardStore.resetModifierStates();

      expect(keyboardStore.isShiftPressed).toBe(false);
    });

    it("is called on window blur", () => {
      mockupOverlayStore.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      window.dispatchEvent(new Event("blur"));

      expect(keyboardStore.isSpacePressed).toBe(false);
    });

    it("is called on visibility change when document is hidden", () => {
      mockupOverlayStore.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      // Mock document.hidden
      Object.defineProperty(document, "hidden", { value: true, writable: true });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(keyboardStore.isSpacePressed).toBe(false);

      // Reset
      Object.defineProperty(document, "hidden", { value: false, writable: true });
    });
  });
});
