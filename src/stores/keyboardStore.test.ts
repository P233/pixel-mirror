/**
 * KeyboardStore Tests
 *
 * Tests for centralized keyboard event handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dockStore
vi.mock("./dockStore.svelte", () => ({
  dockStore: {
    mode: "toolbar" as "toolbar" | "mockups" | "grids",
    enterToolbar: vi.fn()
  }
}));

// Mock overlayController
vi.mock("~/features/overlay/controller.svelte", () => ({
  overlayController: {
    isHidden: false,
    activeMockupUrl: "blob:mockup" as string | null,
    mode: "visible" as "visible" | "locked" | "dragging" | "solid" | "zoomed",
    stepOpacity: vi.fn(),
    enterSolidMode: vi.fn(),
    exitSolidMode: vi.fn(),
    toggleLock: vi.fn(),
    move: vi.fn(),
    persistPosition: vi.fn()
  }
}));

describe("keyboardStore", () => {
  let keyboardStore: typeof import("./keyboardStore.svelte").keyboardStore;
  let dockStore: { mode: "toolbar" | "mockups" | "grids"; enterToolbar: ReturnType<typeof vi.fn> };
  let overlayController: {
    isHidden: boolean;
    activeMockupUrl: string | null;
    mode: "visible" | "locked" | "dragging" | "solid" | "zoomed";
    stepOpacity: ReturnType<typeof vi.fn>;
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
    const mockupModule = await import("~/features/overlay/controller.svelte");

    dockStore = dockModule.dockStore as unknown as typeof dockStore;
    overlayController = mockupModule.overlayController as unknown as typeof overlayController;

    // Reset mock state
    dockStore.mode = "toolbar";
    dockStore.enterToolbar.mockReset();
    overlayController.isHidden = false;
    overlayController.activeMockupUrl = "blob:mockup";
    overlayController.mode = "visible";
    overlayController.stepOpacity.mockReset();
    overlayController.enterSolidMode.mockReset();
    overlayController.exitSolidMode.mockReset();
    overlayController.toggleLock.mockReset();
    overlayController.move.mockReset();
    overlayController.persistPosition.mockReset();

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
      overlayController.activeMockupUrl = null;
    });

    it.each(["ArrowDown", " ", "Escape"])("leaves '%s' to the host page", (key) => {
      const event = new KeyboardEvent("keydown", { key, cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(overlayController.move).not.toHaveBeenCalled();
      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();
      expect(overlayController.toggleLock).not.toHaveBeenCalled();
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

  describe("Space key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("enters solid mode on space press in visible mode", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).toHaveBeenCalled();
      expect(keyboardStore.isSpacePressed).toBe(true);
    });

    it("enters solid mode on space press in locked mode", () => {
      overlayController.mode = "locked";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).toHaveBeenCalled();
    });

    it("exits solid mode on space release", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));

      expect(overlayController.exitSolidMode).toHaveBeenCalled();
      expect(keyboardStore.isSpacePressed).toBe(false);
    });

    it("does not enter solid mode in dragging mode", () => {
      overlayController.mode = "dragging";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();
    });

    it("does not enter solid mode when mockup is hidden", () => {
      overlayController.isHidden = true;

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();
    });

    it("does not enter solid mode when dock is in manager mode", () => {
      dockStore.mode = "mockups";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();
    });
  });

  describe("Escape key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("toggles lock on Escape in visible mode", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(overlayController.toggleLock).toHaveBeenCalled();
    });

    it("ignores auto-repeated Escape while the key is held", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", repeat: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", repeat: true }));

      expect(overlayController.toggleLock).toHaveBeenCalledTimes(1);
    });

    it("toggles lock on Escape in locked mode", () => {
      overlayController.mode = "locked";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(overlayController.toggleLock).toHaveBeenCalled();
    });

    it("does not toggle lock in other modes", () => {
      overlayController.mode = "dragging";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(overlayController.toggleLock).not.toHaveBeenCalled();
    });

    it("closes manager panel and returns to toolbar when Escape is pressed in manager mode", () => {
      dockStore.mode = "mockups";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

      expect(dockStore.enterToolbar).toHaveBeenCalledTimes(1);
      expect(overlayController.toggleLock).not.toHaveBeenCalled();
    });
  });

  describe("Arrow key handling", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("moves mockup up on ArrowUp", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));

      expect(overlayController.move).toHaveBeenCalledWith(0, -1);
    });

    it("moves mockup down on ArrowDown", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));

      expect(overlayController.move).toHaveBeenCalledWith(0, 1);
    });

    it("moves mockup left on ArrowLeft", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));

      expect(overlayController.move).toHaveBeenCalledWith(-1, 0);
    });

    it("moves mockup right on ArrowRight", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

      expect(overlayController.move).toHaveBeenCalledWith(1, 0);
    });

    it("moves 10 pixels when Shift is held", () => {
      overlayController.mode = "visible";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true }));

      expect(overlayController.move).toHaveBeenCalledWith(10, 0);
    });

    it("does not move in locked mode", () => {
      overlayController.mode = "locked";

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

      expect(overlayController.move).not.toHaveBeenCalled();
    });
  });

  describe("wheel event for opacity", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("makes the mockup more opaque on scroll down with Control pressed", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: 100 });
      window.dispatchEvent(wheelEvent);

      expect(overlayController.stepOpacity).toHaveBeenCalledWith(1);
    });

    it("makes the mockup more transparent on scroll up", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: -100 });
      window.dispatchEvent(wheelEvent);

      expect(overlayController.stepOpacity).toHaveBeenCalledWith(-1);
    });

    it("adjusts opacity in locked mode", () => {
      overlayController.mode = "locked";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: 100 });
      window.dispatchEvent(wheelEvent);

      expect(overlayController.stepOpacity).toHaveBeenCalled();
    });

    it("leaves wheel events already handled by the host page alone", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      const wheelEvent = new WheelEvent("wheel", { deltaY: 100, cancelable: true });
      wheelEvent.preventDefault();

      window.dispatchEvent(wheelEvent);

      expect(overlayController.stepOpacity).not.toHaveBeenCalled();
    });

    it("does not adjust opacity in other modes", () => {
      overlayController.mode = "dragging";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));

      const wheelEvent = new WheelEvent("wheel", { deltaY: 100 });
      window.dispatchEvent(wheelEvent);

      expect(overlayController.stepOpacity).not.toHaveBeenCalled();
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
      expect(overlayController.move).not.toHaveBeenCalled();
    });

    it("still nudges by 10px with Shift + arrow", () => {
      press("ArrowLeft", { shiftKey: true });

      expect(overlayController.move).toHaveBeenCalledWith(-10, 0);
    });

    it("leaves Shift+Space (page up) to the browser", () => {
      const event = press(" ", { shiftKey: true });

      expect(event.defaultPrevented).toBe(false);
      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();
    });

    it("ignores keys during IME composition", () => {
      const event = press("ArrowDown", { isComposing: true });

      expect(event.defaultPrevented).toBe(false);
      expect(overlayController.move).not.toHaveBeenCalled();
    });

    it("ignores keys the host page already handled", () => {
      const hostHandler = (e: KeyboardEvent) => e.preventDefault();
      window.addEventListener("keydown", hostHandler, { capture: true });

      press("Escape");
      press("ArrowDown");

      window.removeEventListener("keydown", hostHandler, { capture: true });
      expect(overlayController.toggleLock).not.toHaveBeenCalled();
      expect(overlayController.move).not.toHaveBeenCalled();
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
      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();
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

      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it("ignores keydown when focused on textarea", () => {
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it("ignores keydown when focused on select", () => {
      const select = document.createElement("select");
      document.body.appendChild(select);
      select.focus();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      expect(overlayController.enterSolidMode).not.toHaveBeenCalled();

      document.body.removeChild(select);
    });
  });

  describe("releasing held keys", () => {
    beforeEach(() => {
      keyboardStore.init();
    });

    it("releases Control on window blur", () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
      expect(keyboardStore.isControlPressed).toBe(true);

      window.dispatchEvent(new Event("blur"));

      expect(keyboardStore.isControlPressed).toBe(false);
    });

    it("releases Space and exits solid mode on window blur", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      expect(keyboardStore.isSpacePressed).toBe(true);

      window.dispatchEvent(new Event("blur"));

      expect(keyboardStore.isSpacePressed).toBe(false);
      expect(overlayController.exitSolidMode).toHaveBeenCalled();
    });

    it("releases Space on keyup even after the dock left toolbar mode", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      dockStore.mode = "mockups";

      window.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));

      expect(keyboardStore.isSpacePressed).toBe(false);
      expect(overlayController.exitSolidMode).toHaveBeenCalled();
    });

    it("is called on window blur", () => {
      overlayController.mode = "visible";
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));

      window.dispatchEvent(new Event("blur"));

      expect(keyboardStore.isSpacePressed).toBe(false);
    });

    it("is called on visibility change when document is hidden", () => {
      overlayController.mode = "visible";
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
