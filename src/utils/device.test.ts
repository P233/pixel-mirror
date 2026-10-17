import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the module fresh each time
describe("device detection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("isTouchDevice", () => {
    it("should return true when ontouchstart is in window", async () => {
      // Setup before importing
      Object.defineProperty(window, "ontouchstart", {
        value: vi.fn(),
        writable: true,
        configurable: true
      });

      const { isTouchDevice } = await import("./device");
      expect(isTouchDevice()).toBe(true);

      // Cleanup
      delete (window as { ontouchstart?: unknown }).ontouchstart;
    });

    it("should return true when maxTouchPoints > 0", async () => {
      // Ensure ontouchstart is not present
      delete (window as { ontouchstart?: unknown }).ontouchstart;

      // Mock maxTouchPoints
      const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints");
      Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
        get: () => 5,
        configurable: true
      });

      const { isTouchDevice } = await import("./device");
      expect(isTouchDevice()).toBe(true);

      // Restore
      if (originalDescriptor) {
        Object.defineProperty(Navigator.prototype, "maxTouchPoints", originalDescriptor);
      }
    });

    it("should return false when neither touch indicator is present", async () => {
      // Ensure ontouchstart is not present
      delete (window as { ontouchstart?: unknown }).ontouchstart;

      // Mock maxTouchPoints to 0
      const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints");
      Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
        get: () => 0,
        configurable: true
      });

      const { isTouchDevice } = await import("./device");
      expect(isTouchDevice()).toBe(false);

      // Restore
      if (originalDescriptor) {
        Object.defineProperty(Navigator.prototype, "maxTouchPoints", originalDescriptor);
      }
    });

    it("should cache the result after first call", async () => {
      // Setup touch device
      Object.defineProperty(window, "ontouchstart", {
        value: vi.fn(),
        writable: true,
        configurable: true
      });

      const { isTouchDevice } = await import("./device");

      // First call
      const result1 = isTouchDevice();
      expect(result1).toBe(true);

      // Change the property (but cache should still return true)
      delete (window as { ontouchstart?: unknown }).ontouchstart;

      // Second call should still return cached value
      const result2 = isTouchDevice();
      expect(result2).toBe(true); // Cached value
    });

    it("should return fresh value after resetTouchDeviceCache", async () => {
      // Setup touch device
      Object.defineProperty(window, "ontouchstart", {
        value: vi.fn(),
        writable: true,
        configurable: true
      });

      const { isTouchDevice, resetTouchDeviceCache } = await import("./device");

      expect(isTouchDevice()).toBe(true);

      // Reset cache
      resetTouchDeviceCache();

      // Change the property
      delete (window as { ontouchstart?: unknown }).ontouchstart;

      // Mock maxTouchPoints to 0
      const originalDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "maxTouchPoints");
      Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
        get: () => 0,
        configurable: true
      });

      // Now should return fresh value
      expect(isTouchDevice()).toBe(false);

      // Restore
      if (originalDescriptor) {
        Object.defineProperty(Navigator.prototype, "maxTouchPoints", originalDescriptor);
      }
    });
  });

  describe("input type tracking", () => {
    it("reports no touch input before any pointer event", async () => {
      const { isLastInputTouch, resetInputType } = await import("./device");

      resetInputType();
      expect(isLastInputTouch()).toBe(false);
    });

    it("follows the pointer type of the latest pointerdown", async () => {
      const { initInputTypeTracking, isLastInputTouch, resetInputType } = await import("./device");
      resetInputType();
      initInputTypeTracking();

      document.body.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }));
      expect(isLastInputTouch()).toBe(true);

      document.body.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "pen", bubbles: true }));
      expect(isLastInputTouch()).toBe(false);
    });

    it.each([
      ["touch", true],
      ["mouse", false],
      ["pen", false]
    ] as const)("tracks %s before compatibility mouseenter", async (pointerType, isTouch) => {
      const { initInputTypeTracking, isLastInputTouch, resetInputType } = await import("./device");
      resetInputType();
      initInputTypeTracking();
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { pointerType: isTouch ? "mouse" : "touch", bubbles: true })
      );

      document.body.dispatchEvent(new PointerEvent("pointerover", { pointerType, bubbles: true }));

      expect(isLastInputTouch()).toBe(isTouch);
    });
  });

  describe("initInputTypeTracking", () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      addEventListenerSpy = vi.spyOn(document, "addEventListener");
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
    });

    it.each(["pointerdown", "pointerover"])("should attach a %s listener to document", async (type) => {
      const { initInputTypeTracking } = await import("./device");

      initInputTypeTracking();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        type,
        expect.any(Function),
        expect.objectContaining({ capture: true, passive: true })
      );
    });

    it("should not attach duplicate listeners", async () => {
      const { initInputTypeTracking } = await import("./device");

      initInputTypeTracking();
      const callCount = addEventListenerSpy.mock.calls.length;

      initInputTypeTracking();
      expect(addEventListenerSpy.mock.calls.length).toBe(callCount);
    });
  });
});
