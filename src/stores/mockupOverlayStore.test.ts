/**
 * MockupOverlayStore State Machine Tests
 *
 * Tests the 5 states and their transitions:
 * - visible: Default state, can drag, adjust opacity, scale, align
 * - locked: Frozen, no pointer events
 * - dragging: During drag operation
 * - solid: Full opacity, preparing for zoom (Space key held)
 * - zoomed: 2x zoom with pan capability
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module
vi.mock("./database", () => ({
  getMockup: vi.fn().mockResolvedValue(undefined),
  getSettingsByGroup: vi.fn().mockResolvedValue({}),
  updateSetting: vi.fn().mockResolvedValue(undefined)
}));

// Mock toastStore
vi.mock("./toastStore.svelte", () => ({
  toastStore: {
    showError: vi.fn(),
    clear: vi.fn(),
    errorMessage: undefined
  }
}));

describe("mockupOverlayStore", () => {
  let mockupOverlayStore: typeof import("./mockupOverlayStore.svelte").mockupOverlayStore;
  let getMockup: ReturnType<typeof vi.fn>;
  let getSettingsByGroup: ReturnType<typeof vi.fn>;
  let updateSetting: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Mock URL.createObjectURL and URL.revokeObjectURL while preserving URL constructor
    const OriginalURL = globalThis.URL;
    vi.spyOn(OriginalURL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(OriginalURL, "revokeObjectURL").mockImplementation(() => {});

    // Get fresh mocks
    const dbModule = await import("./database");
    getMockup = dbModule.getMockup as ReturnType<typeof vi.fn>;
    getSettingsByGroup = dbModule.getSettingsByGroup as ReturnType<typeof vi.fn>;
    updateSetting = dbModule.updateSetting as ReturnType<typeof vi.fn>;

    // Reset mocks
    getMockup.mockReset().mockResolvedValue(undefined);
    getSettingsByGroup.mockReset().mockResolvedValue({});
    updateSetting.mockReset().mockResolvedValue(undefined);

    // Import fresh store
    const module = await import("./mockupOverlayStore.svelte");
    mockupOverlayStore = module.mockupOverlayStore;
  });

  afterEach(() => {
    if (mockupOverlayStore) {
      mockupOverlayStore.cleanup();
    }
  });

  describe("initial state", () => {
    it("starts uninitialized", () => {
      expect(mockupOverlayStore.initialized).toBe(false);
    });

    it("has default values before init", () => {
      expect(mockupOverlayStore.activeMockupId).toBeNull();
      expect(mockupOverlayStore.isHidden).toBe(false);
      expect(mockupOverlayStore.isLocked).toBe(false);
      expect(mockupOverlayStore.opacity).toBe(0.5);
      expect(mockupOverlayStore.scale).toBe(1);
      expect(mockupOverlayStore.mode).toBe("visible");
    });
  });

  describe("init", () => {
    it("loads settings from database", async () => {
      getSettingsByGroup.mockResolvedValue({
        activeMockupId: "test-id",
        isHidden: true,
        isLocked: true,
        opacity: 0.7,
        scale: 0.5,
        position: { x: 100, y: 200 },
        alignmentX: "center",
        alignmentY: "top"
      });

      await mockupOverlayStore.init();

      expect(mockupOverlayStore.initialized).toBe(true);
      expect(mockupOverlayStore.activeMockupId).toBe("test-id");
      expect(mockupOverlayStore.isHidden).toBe(true);
      expect(mockupOverlayStore.isLocked).toBe(true);
      expect(mockupOverlayStore.opacity).toBe(0.7);
      expect(mockupOverlayStore.scale).toBe(0.5);
      expect(mockupOverlayStore.alignmentX).toBe("center");
      expect(mockupOverlayStore.alignmentY).toBe("top");
    });

    it("sets mode to locked if isLocked is true", async () => {
      getSettingsByGroup.mockResolvedValue({ isLocked: true });

      await mockupOverlayStore.init();

      expect(mockupOverlayStore.mode).toBe("locked");
    });

    it("only initializes once", async () => {
      await mockupOverlayStore.init();
      await mockupOverlayStore.init();

      expect(getSettingsByGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe("state machine transitions", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    describe("visible state", () => {
      it("starts in visible mode", () => {
        expect(mockupOverlayStore.mode).toBe("visible");
      });

      it("can toggle lock (visible → locked)", () => {
        mockupOverlayStore.toggleLock();

        expect(mockupOverlayStore.mode).toBe("locked");
        expect(mockupOverlayStore.isLocked).toBe(true);
      });

      it("can enter solid mode (visible → solid)", () => {
        mockupOverlayStore.enterSolidMode();

        expect(mockupOverlayStore.mode).toBe("solid");
      });

      it("can start drag (visible → dragging)", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        mockupOverlayStore.startDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("dragging");
        expect(mockupOverlayStore.isDragging).toBe(true);
      });
    });

    describe("locked state", () => {
      beforeEach(() => {
        mockupOverlayStore.toggleLock();
        expect(mockupOverlayStore.mode).toBe("locked");
      });

      it("can toggle lock back to visible (locked → visible)", () => {
        mockupOverlayStore.toggleLock();

        expect(mockupOverlayStore.mode).toBe("visible");
        expect(mockupOverlayStore.isLocked).toBe(false);
      });

      it("can enter solid mode (locked → solid)", () => {
        mockupOverlayStore.enterSolidMode();

        expect(mockupOverlayStore.mode).toBe("solid");
      });

      it("cannot start drag", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        mockupOverlayStore.startDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("locked");
      });

      it("allows opacity adjustment in locked mode", () => {
        // Locked mode still allows opacity adjustments (per state machine design)
        const initialOpacity = mockupOverlayStore.opacity;
        mockupOverlayStore.adjustOpacity(1);

        expect(mockupOverlayStore.opacity).toBeLessThan(initialOpacity);
      });

      it("ignores scale change", () => {
        mockupOverlayStore.cycleScale();

        expect(mockupOverlayStore.scale).toBe(1);
      });

      it("ignores alignment changes", () => {
        mockupOverlayStore.setAlignmentX("left");
        mockupOverlayStore.setAlignmentY("bottom");

        expect(mockupOverlayStore.alignmentX).toBe("center");
        expect(mockupOverlayStore.alignmentY).toBe("top");
      });

      it("ignores movement", () => {
        const initialPosition = { ...mockupOverlayStore.position };
        mockupOverlayStore.move(50, 50);

        expect(mockupOverlayStore.position).toEqual(initialPosition);
      });
    });

    describe("solid state", () => {
      beforeEach(() => {
        mockupOverlayStore.enterSolidMode();
        expect(mockupOverlayStore.mode).toBe("solid");
      });

      it("has full effective opacity", () => {
        expect(mockupOverlayStore.effectiveOpacity).toBe(1);
      });

      it("reports isSolidOrZoomed as true", () => {
        expect(mockupOverlayStore.isSolidOrZoomed).toBe(true);
      });

      it("can exit to previous mode (solid → visible)", () => {
        mockupOverlayStore.exitSolidMode();

        expect(mockupOverlayStore.mode).toBe("visible");
      });

      it("returns to locked if was locked before solid", async () => {
        // Reset and start from locked
        vi.resetModules();
        const module = await import("./mockupOverlayStore.svelte");
        const store = module.mockupOverlayStore;

        await store.init();
        store.toggleLock();
        expect(store.mode).toBe("locked");

        store.enterSolidMode();
        expect(store.mode).toBe("solid");

        store.exitSolidMode();
        expect(store.mode).toBe("locked");

        store.cleanup();
      });

      it("cannot toggle lock", () => {
        mockupOverlayStore.toggleLock();

        expect(mockupOverlayStore.mode).toBe("solid");
      });

      it("cannot start drag", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        mockupOverlayStore.startDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("solid");
      });
    });

    describe("zoomed state", () => {
      beforeEach(() => {
        mockupOverlayStore.enterSolidMode();

        // Mock document properties needed for zoom calculations
        Object.defineProperty(document.documentElement, "clientWidth", { value: 1920, configurable: true });
        Object.defineProperty(document.documentElement, "clientHeight", { value: 1080, configurable: true });
        Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      });

      it("can enter zoom from solid (solid → zoomed)", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        mockupOverlayStore.enterZoomMode(mockEvent);

        expect(mockupOverlayStore.mode).toBe("zoomed");
      });

      it("doubles the scale when zoomed", () => {
        const originalScale = mockupOverlayStore.scale;
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;

        mockupOverlayStore.enterZoomMode(mockEvent);

        expect(mockupOverlayStore.scale).toBe(originalScale * 2);
      });

      it("reports isSolidOrZoomed as true", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        mockupOverlayStore.enterZoomMode(mockEvent);

        expect(mockupOverlayStore.isSolidOrZoomed).toBe(true);
      });

      it("can exit zoom to solid (zoomed → solid)", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        mockupOverlayStore.enterZoomMode(mockEvent);

        mockupOverlayStore.exitZoomMode();

        expect(mockupOverlayStore.mode).toBe("solid");
      });

      it("restores scale when exiting zoom", () => {
        const originalScale = mockupOverlayStore.scale;
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;

        mockupOverlayStore.enterZoomMode(mockEvent);
        mockupOverlayStore.exitZoomMode();

        expect(mockupOverlayStore.scale).toBe(originalScale);
      });

      it("can exit zoom via exitSolidMode (zoomed → visible/locked)", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        mockupOverlayStore.enterZoomMode(mockEvent);

        mockupOverlayStore.exitSolidMode();

        expect(mockupOverlayStore.mode).toBe("visible");
      });
    });

    describe("dragging state", () => {
      it("transitions to dragging on mouse down", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        mockupOverlayStore.startDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("dragging");
      });

      it("reports isDragging as true", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        mockupOverlayStore.startDrag(mockEvent);

        expect(mockupOverlayStore.isDragging).toBe(true);
      });

      it("only allows drag from visible mode", () => {
        mockupOverlayStore.toggleLock();
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;

        mockupOverlayStore.startDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("locked");
        expect(mockupOverlayStore.isDragging).toBe(false);
      });
    });
  });

  describe("opacity controls", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("adjusts opacity up (negative direction increases)", () => {
      const initial = mockupOverlayStore.opacity;
      mockupOverlayStore.adjustOpacity(-1);

      expect(mockupOverlayStore.opacity).toBeGreaterThan(initial);
    });

    it("adjusts opacity down (positive direction decreases)", () => {
      const initial = mockupOverlayStore.opacity;
      mockupOverlayStore.adjustOpacity(1);

      expect(mockupOverlayStore.opacity).toBeLessThan(initial);
    });

    it("clamps opacity to minimum", () => {
      // Decrease many times to hit minimum
      for (let i = 0; i < 20; i++) {
        mockupOverlayStore.adjustOpacity(1);
      }

      expect(mockupOverlayStore.opacity).toBe(0.1);
    });

    it("clamps opacity to maximum", () => {
      // Increase many times to hit maximum
      for (let i = 0; i < 20; i++) {
        mockupOverlayStore.adjustOpacity(-1);
      }

      expect(mockupOverlayStore.opacity).toBe(0.9);
    });

    it("resets opacity to default", () => {
      mockupOverlayStore.adjustOpacity(1);
      mockupOverlayStore.adjustOpacity(1);

      mockupOverlayStore.resetOpacity();

      expect(mockupOverlayStore.opacity).toBe(0.5);
    });

    it("persists opacity changes", () => {
      mockupOverlayStore.adjustOpacity(1);

      expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "opacity", expect.any(Number));
    });
  });

  describe("visibility toggle", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("toggles hidden state", () => {
      expect(mockupOverlayStore.isHidden).toBe(false);

      mockupOverlayStore.toggleVisibility();
      expect(mockupOverlayStore.isHidden).toBe(true);

      mockupOverlayStore.toggleVisibility();
      expect(mockupOverlayStore.isHidden).toBe(false);
    });

    it("persists visibility changes", () => {
      mockupOverlayStore.toggleVisibility();

      expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "isHidden", true);
    });

    it("exits solid/zoomed mode when toggling visibility", () => {
      mockupOverlayStore.enterSolidMode();
      expect(mockupOverlayStore.mode).toBe("solid");

      mockupOverlayStore.toggleVisibility();

      expect(mockupOverlayStore.mode).toBe("visible");
    });
  });

  describe("alignment", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("sets horizontal alignment", () => {
      mockupOverlayStore.setAlignmentX("left");
      expect(mockupOverlayStore.alignmentX).toBe("left");

      mockupOverlayStore.setAlignmentX("right");
      expect(mockupOverlayStore.alignmentX).toBe("right");
    });

    it("sets vertical alignment", () => {
      mockupOverlayStore.setAlignmentY("bottom");
      expect(mockupOverlayStore.alignmentY).toBe("bottom");
    });

    it("sets both alignments at once", () => {
      mockupOverlayStore.setAlignment("bottom", "right");

      expect(mockupOverlayStore.alignmentX).toBe("right");
      expect(mockupOverlayStore.alignmentY).toBe("bottom");
    });

    it("clears alignment", () => {
      mockupOverlayStore.setAlignment("top", "center");
      mockupOverlayStore.clearAlignment();

      expect(mockupOverlayStore.alignmentX).toBeNull();
      expect(mockupOverlayStore.alignmentY).toBeNull();
    });

    it("reports isAligned correctly", () => {
      mockupOverlayStore.clearAlignment();
      expect(mockupOverlayStore.isAligned).toBe(false);

      mockupOverlayStore.setAlignmentX("center");
      expect(mockupOverlayStore.isAligned).toBe(true);
    });
  });

  describe("computed properties", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("effectiveOpacity is 1 in solid mode", () => {
      mockupOverlayStore.enterSolidMode();
      expect(mockupOverlayStore.effectiveOpacity).toBe(1);
    });

    it("effectiveOpacity equals opacity in visible mode", () => {
      expect(mockupOverlayStore.effectiveOpacity).toBe(mockupOverlayStore.opacity);
    });

    it("isVisibleOrLocked is true for visible/locked", () => {
      expect(mockupOverlayStore.isVisibleOrLocked).toBe(true);

      mockupOverlayStore.toggleLock();
      expect(mockupOverlayStore.isVisibleOrLocked).toBe(true);

      mockupOverlayStore.enterSolidMode();
      expect(mockupOverlayStore.isVisibleOrLocked).toBe(false);
    });

    it("positionDisplay shows coordinates when not aligned", () => {
      mockupOverlayStore.clearAlignment();
      expect(mockupOverlayStore.positionDisplay).toMatch(/x:\d+, y:\d+/);
    });

    it("positionDisplay shows alignment when aligned", () => {
      mockupOverlayStore.setAlignment("top", "center");
      expect(mockupOverlayStore.positionDisplay).toBe("top·center");
    });
  });

  describe("movement", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("moves position by delta", () => {
      const initial = { ...mockupOverlayStore.position };
      mockupOverlayStore.move(10, 20);

      expect(mockupOverlayStore.position.x).toBe(initial.x + 10);
      expect(mockupOverlayStore.position.y).toBe(initial.y + 20);
    });

    it("clears alignment when moving", () => {
      mockupOverlayStore.setAlignment("top", "center");
      mockupOverlayStore.move(1, 1);

      expect(mockupOverlayStore.alignmentX).toBeNull();
      expect(mockupOverlayStore.alignmentY).toBeNull();
    });

    it("persists position after persistPosition call", () => {
      mockupOverlayStore.move(50, 50);
      mockupOverlayStore.persistPosition();

      expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "position", expect.any(Object));
    });
  });

  describe("scale cycling", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
      // Mock document properties needed for scale calculations
      Object.defineProperty(document.documentElement, "clientWidth", { value: 1920, configurable: true });
      Object.defineProperty(document.documentElement, "clientHeight", { value: 1080, configurable: true });
      Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    });

    it("cycles scale from 1 to 0.5", () => {
      expect(mockupOverlayStore.scale).toBe(1);

      mockupOverlayStore.cycleScale();

      expect(mockupOverlayStore.scale).toBe(0.5);
    });

    it("cycles scale from 0.5 back to 1", async () => {
      // Reset with 0.5 scale
      vi.resetModules();
      const dbModule = await import("./database");
      const gsModule = dbModule.getSettingsByGroup as ReturnType<typeof vi.fn>;
      gsModule.mockReset().mockResolvedValue({ scale: 0.5 });

      const module = await import("./mockupOverlayStore.svelte");
      const store = module.mockupOverlayStore;

      await store.init();
      expect(store.scale).toBe(0.5);

      store.cycleScale();
      expect(store.scale).toBe(1);

      store.cleanup();
    });

    it("persists scale and position changes", () => {
      mockupOverlayStore.cycleScale();

      expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "scale", 0.5);
      expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "position", expect.any(Object));
    });

    it("clears alignment when cycling scale", () => {
      mockupOverlayStore.setAlignment("top", "center");
      mockupOverlayStore.cycleScale();

      expect(mockupOverlayStore.alignmentX).toBeNull();
      expect(mockupOverlayStore.alignmentY).toBeNull();
    });

    it("does not cycle scale when not in visible mode", () => {
      mockupOverlayStore.toggleLock();
      expect(mockupOverlayStore.mode).toBe("locked");

      mockupOverlayStore.cycleScale();

      expect(mockupOverlayStore.scale).toBe(1);
    });
  });

  describe("positionDisplay variations", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("shows only Y alignment when X is null", () => {
      mockupOverlayStore.clearAlignment();
      mockupOverlayStore.setAlignmentY("top");

      // alignmentX is null, alignmentY is "top", so should show just "top"
      expect(mockupOverlayStore.positionDisplay).toBe("top");
    });

    it("shows only X alignment when Y is null", () => {
      mockupOverlayStore.clearAlignment();
      mockupOverlayStore.setAlignmentX("left");

      // alignmentY is null, alignmentX is "left", so should show just "left"
      expect(mockupOverlayStore.positionDisplay).toBe("left");
    });

    it("shows both alignments when both are set", () => {
      mockupOverlayStore.setAlignment("bottom", "left");

      expect(mockupOverlayStore.positionDisplay).toBe("bottom·left");
    });

    it("shows alignment with center", () => {
      mockupOverlayStore.setAlignment("top", "center");

      expect(mockupOverlayStore.positionDisplay).toBe("top·center");
    });
  });

  describe("setActiveMockup", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("sets active mockup id", () => {
      mockupOverlayStore.setActiveMockup("new-mockup-id");

      expect(mockupOverlayStore.activeMockupId).toBe("new-mockup-id");
    });

    it("clears active mockup when null", () => {
      mockupOverlayStore.setActiveMockup("test-id");
      mockupOverlayStore.setActiveMockup(null);

      expect(mockupOverlayStore.activeMockupId).toBeNull();
    });

    it("unhides mockup when setting new active mockup", () => {
      mockupOverlayStore.toggleVisibility();
      expect(mockupOverlayStore.isHidden).toBe(true);

      mockupOverlayStore.setActiveMockup("new-id");

      expect(mockupOverlayStore.isHidden).toBe(false);
    });

    it("unlocks mockup when setting new active mockup", () => {
      mockupOverlayStore.toggleLock();
      expect(mockupOverlayStore.isLocked).toBe(true);

      mockupOverlayStore.setActiveMockup("new-id");

      expect(mockupOverlayStore.isLocked).toBe(false);
      expect(mockupOverlayStore.mode).toBe("visible");
    });

    it("persists activeMockupId change", () => {
      mockupOverlayStore.setActiveMockup("new-id");

      expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "activeMockupId", "new-id");
    });
  });

  describe("loading mockups", () => {
    class FakeImage {
      static width = 800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = FakeImage.width;
      naturalHeight = 2000;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }

    const mockup = (id: string) => ({ id, originalBuffer: new ArrayBuffer(1), mimeType: "image/png" });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    beforeEach(() => {
      vi.stubGlobal("Image", FakeImage);
      let urlCount = 0;
      vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:url-${++urlCount}`);
      mockupOverlayStore.setPageSize({ width: 1024, height: 3000 });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("applies the default top-center alignment once the image size is known", async () => {
      getMockup.mockImplementation(async (id: string) => mockup(id));
      await mockupOverlayStore.init();

      mockupOverlayStore.setActiveMockup("a");
      await flush();

      expect(mockupOverlayStore.positionDisplay).toBe("top·center");
      expect(mockupOverlayStore.position.x).toBe((1024 - 800) / 2);
    });

    it("re-aligns when switching to a mockup of a different width", async () => {
      getMockup.mockImplementation(async (id: string) => mockup(id));
      await mockupOverlayStore.init();
      mockupOverlayStore.setActiveMockup("a");
      await flush();

      FakeImage.width = 1000;
      mockupOverlayStore.setActiveMockup("b");
      await flush();
      FakeImage.width = 800;

      expect(mockupOverlayStore.position.x).toBe((1024 - 1000) / 2);
    });

    it("ignores a slower load that was superseded by a newer selection", async () => {
      let resolveA: (value: ReturnType<typeof mockup>) => void = () => {};
      getMockup.mockImplementation((id: string) =>
        id === "a" ? new Promise((resolve) => (resolveA = resolve)) : Promise.resolve(mockup(id))
      );
      await mockupOverlayStore.init();

      mockupOverlayStore.setActiveMockup("a");
      mockupOverlayStore.setActiveMockup("b");
      await flush();
      const urlForB = mockupOverlayStore.activeMockupUrl;

      resolveA(mockup("a"));
      await flush();

      expect(mockupOverlayStore.activeMockupId).toBe("b");
      expect(mockupOverlayStore.activeMockupUrl).toBe(urlForB);
    });

    it("keeps the active image URL usable across cleanup and re-init (remount)", async () => {
      getSettingsByGroup.mockResolvedValue({ activeMockupId: "a" });
      getMockup.mockImplementation(async (id: string) => mockup(id));
      await mockupOverlayStore.init();
      const url = mockupOverlayStore.activeMockupUrl;

      mockupOverlayStore.cleanup();
      await mockupOverlayStore.init();

      expect(mockupOverlayStore.activeMockupUrl).toBe(url);
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(url);
    });
  });

  describe("derived position", () => {
    class FakeImage {
      onload: (() => void) | null = null;
      naturalWidth = 800;
      naturalHeight = 1500;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    beforeEach(async () => {
      vi.stubGlobal("Image", FakeImage);
      getMockup.mockResolvedValue({ id: "a", originalBuffer: new ArrayBuffer(1), mimeType: "image/png" });
      await mockupOverlayStore.init();
      mockupOverlayStore.setActiveMockup("a");
      await flush();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("follows the page width while centered", () => {
      mockupOverlayStore.setPageSize({ width: 1024, height: 3000 });
      expect(mockupOverlayStore.position.x).toBe(112);

      mockupOverlayStore.setPageSize({ width: 1440, height: 3000 });
      expect(mockupOverlayStore.position.x).toBe(320);
    });

    it("stays at the bottom when the document grows", () => {
      mockupOverlayStore.setAlignmentY("bottom");

      mockupOverlayStore.setPageSize({ width: 1024, height: 3000 });
      expect(mockupOverlayStore.position.y).toBe(1500);

      mockupOverlayStore.setPageSize({ width: 1024, height: 5000 });
      expect(mockupOverlayStore.position.y).toBe(3500);
    });

    it("keeps a freely placed mockup where it is when the page resizes", () => {
      mockupOverlayStore.setPageSize({ width: 1024, height: 3000 });
      mockupOverlayStore.move(5, 5);

      mockupOverlayStore.setPageSize({ width: 1440, height: 3000 });

      expect(mockupOverlayStore.position).toEqual({ x: 117, y: 5 });
    });

    it("keeps the current coordinate of an axis whose alignment is cleared", () => {
      mockupOverlayStore.setPageSize({ width: 1024, height: 3000 });

      mockupOverlayStore.setAlignmentX(null);
      mockupOverlayStore.setPageSize({ width: 1440, height: 3000 });

      expect(mockupOverlayStore.position.x).toBe(112);
      expect(mockupOverlayStore.alignmentY).toBe("top");
    });
  });

  describe("zoom from a pinched view", () => {
    it("returns to the pinched view when leaving zoom, and to the placement when leaving solid", () => {
      Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      mockupOverlayStore.enterSolidMode();
      mockupOverlayStore.startGesturePinch(0, 0);
      mockupOverlayStore.handleGesturePinch(1.5);
      const pinched = { position: { ...mockupOverlayStore.position }, scale: mockupOverlayStore.scale };

      mockupOverlayStore.enterZoomMode(new MouseEvent("pointerdown", { clientX: 10, clientY: 10 }));
      expect(mockupOverlayStore.scale).toBe(3);
      mockupOverlayStore.exitZoomMode();

      expect(mockupOverlayStore.scale).toBe(pinched.scale);
      expect(mockupOverlayStore.position).toEqual(pinched.position);

      mockupOverlayStore.exitSolidMode();
      expect(mockupOverlayStore.scale).toBe(1);
      expect(mockupOverlayStore.mode).toBe("visible");
    });
  });

  describe("leaving solid mode", () => {
    it("restores the pre-solid scale when hiding from mobile solid mode", () => {
      mockupOverlayStore.cycleScale(); // 1x -> 0.5x
      mockupOverlayStore.toggleMobileSolidMode();
      mockupOverlayStore.startGesturePinch(0, 0);
      mockupOverlayStore.handleGesturePinch(3);

      mockupOverlayStore.toggleVisibility();

      expect(mockupOverlayStore.scale).toBe(0.5);
      expect(mockupOverlayStore.mode).toBe("visible");
    });

    it("restores the pre-solid scale when exiting desktop solid mode after a pinch", () => {
      mockupOverlayStore.enterSolidMode();
      mockupOverlayStore.startGesturePinch(0, 0);
      mockupOverlayStore.handleGesturePinch(2);

      mockupOverlayStore.exitSolidMode();

      expect(mockupOverlayStore.scale).toBe(1);
    });
  });

  describe("cleanup", () => {
    it("removes event listeners", async () => {
      await mockupOverlayStore.init();

      const removeSpy = vi.spyOn(window, "removeEventListener");

      mockupOverlayStore.cleanup();

      expect(removeSpy).toHaveBeenCalled();
      removeSpy.mockRestore();
    });

    it("does not throw when called multiple times", async () => {
      await mockupOverlayStore.init();

      expect(() => {
        mockupOverlayStore.cleanup();
        mockupOverlayStore.cleanup();
      }).not.toThrow();
    });
  });

  describe("getters", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    it("activeMockupUrl is null initially", () => {
      expect(mockupOverlayStore.activeMockupUrl).toBeNull();
    });

    it("mockupSize is zero initially", () => {
      expect(mockupOverlayStore.mockupSize).toEqual({ width: 0, height: 0 });
    });

    it("isZoomPanning is false initially", () => {
      expect(mockupOverlayStore.isZoomPanning).toBe(false);
    });
  });

  // ============================================
  // Mobile Touch Methods Tests
  // ============================================

  describe("mobile touch methods", () => {
    beforeEach(async () => {
      await mockupOverlayStore.init();
    });

    describe("setOpacity", () => {
      it("sets opacity directly", () => {
        mockupOverlayStore.setOpacity(0.75);

        expect(mockupOverlayStore.opacity).toBe(0.75);
      });

      it("clamps opacity to minimum", () => {
        mockupOverlayStore.setOpacity(0);

        expect(mockupOverlayStore.opacity).toBe(0.1);
      });

      it("clamps opacity to maximum", () => {
        mockupOverlayStore.setOpacity(1);

        expect(mockupOverlayStore.opacity).toBe(0.9);
      });

      it("persists opacity change", () => {
        mockupOverlayStore.setOpacity(0.6);

        expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "opacity", 0.6);
      });

      it("does not change opacity when not in visible or locked mode", () => {
        mockupOverlayStore.enterSolidMode();
        const initial = mockupOverlayStore.opacity;

        mockupOverlayStore.setOpacity(0.8);

        expect(mockupOverlayStore.opacity).toBe(initial);
      });
    });

    describe("touch drag (visible mode)", () => {
      it("starts touch drag from visible mode", () => {
        const mockTouch = { clientX: 100, clientY: 100 };
        const mockEvent = { touches: [mockTouch] } as unknown as TouchEvent;

        mockupOverlayStore.startTouchDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("dragging");
      });

      it("does not start touch drag from locked mode", () => {
        mockupOverlayStore.toggleLock();
        const mockTouch = { clientX: 100, clientY: 100 };
        const mockEvent = { touches: [mockTouch] } as unknown as TouchEvent;

        mockupOverlayStore.startTouchDrag(mockEvent);

        expect(mockupOverlayStore.mode).toBe("locked");
      });

      it("handles touch drag movement", () => {
        const startTouch = { clientX: 100, clientY: 100 };
        const moveTouch = { clientX: 150, clientY: 200 };
        const startEvent = { touches: [startTouch] } as unknown as TouchEvent;
        const moveEvent = { touches: [moveTouch] } as unknown as TouchEvent;

        const initialPosition = { ...mockupOverlayStore.position };
        mockupOverlayStore.startTouchDrag(startEvent);
        mockupOverlayStore.handleTouchDrag(moveEvent);

        expect(mockupOverlayStore.position.x).toBe(initialPosition.x + 50);
        expect(mockupOverlayStore.position.y).toBe(initialPosition.y + 100);
      });

      it("ends touch drag and persists position", () => {
        const mockTouch = { clientX: 100, clientY: 100 };
        const mockEvent = { touches: [mockTouch] } as unknown as TouchEvent;

        mockupOverlayStore.startTouchDrag(mockEvent);
        mockupOverlayStore.endTouchDrag();

        expect(mockupOverlayStore.mode).toBe("visible");
        expect(updateSetting).toHaveBeenCalledWith("mockupOverlay", "position", expect.any(Object));
      });

      it("clears alignment after touch drag", () => {
        mockupOverlayStore.setAlignment("top", "center");
        const mockTouch = { clientX: 100, clientY: 100 };
        const mockEvent = { touches: [mockTouch] } as unknown as TouchEvent;

        mockupOverlayStore.startTouchDrag(mockEvent);
        mockupOverlayStore.endTouchDrag();

        expect(mockupOverlayStore.alignmentX).toBeNull();
        expect(mockupOverlayStore.alignmentY).toBeNull();
      });
    });

    describe("toggleMobileSolidMode (double tap)", () => {
      it("enters solid mode from visible", () => {
        mockupOverlayStore.toggleMobileSolidMode();

        expect(mockupOverlayStore.mode).toBe("solid");
      });

      it("exits solid mode back to visible", () => {
        mockupOverlayStore.toggleMobileSolidMode(); // Enter
        mockupOverlayStore.toggleMobileSolidMode(); // Exit

        expect(mockupOverlayStore.mode).toBe("visible");
      });

      it("returns to locked if was locked before solid", () => {
        mockupOverlayStore.toggleLock(); // Lock
        mockupOverlayStore.toggleMobileSolidMode(); // Enter solid

        expect(mockupOverlayStore.mode).toBe("solid");

        mockupOverlayStore.toggleMobileSolidMode(); // Exit solid

        expect(mockupOverlayStore.mode).toBe("locked");
      });

      it("restores scale when exiting solid mode", () => {
        const originalScale = mockupOverlayStore.scale;
        mockupOverlayStore.toggleMobileSolidMode(); // Enter

        // Simulate pinch zoom by changing scale
        // (In real usage this would be via handlePinch)

        mockupOverlayStore.toggleMobileSolidMode(); // Exit

        expect(mockupOverlayStore.scale).toBe(originalScale);
      });
    });

    describe("pinch zoom (solid mode)", () => {
      beforeEach(() => {
        mockupOverlayStore.enterSolidMode();
        // Mock scroll position
        Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      });

      it("starts pinch with two fingers", () => {
        const mockEvent = {
          touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 200, clientY: 200 }
          ]
        } as unknown as TouchEvent;

        // Should not throw
        expect(() => mockupOverlayStore.startPinch(mockEvent)).not.toThrow();
      });

      it("does not start pinch with one finger", () => {
        const mockEvent = {
          touches: [{ clientX: 100, clientY: 100 }]
        } as unknown as TouchEvent;

        // Should not throw and should not crash
        expect(() => mockupOverlayStore.startPinch(mockEvent)).not.toThrow();
      });

      it("handles pinch zoom", () => {
        const initialScale = mockupOverlayStore.scale;

        // Start pinch with distance 100
        const startEvent = {
          touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 200, clientY: 100 }
          ]
        } as unknown as TouchEvent;
        mockupOverlayStore.startPinch(startEvent);

        // Move fingers apart (distance 200, 2x zoom)
        const moveEvent = {
          touches: [
            { clientX: 50, clientY: 100 },
            { clientX: 250, clientY: 100 }
          ]
        } as unknown as TouchEvent;
        mockupOverlayStore.handlePinch(moveEvent);

        expect(mockupOverlayStore.scale).toBe(initialScale * 2);
      });

      it("clamps scale to reasonable bounds", () => {
        // Start pinch
        const startEvent = {
          touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 200, clientY: 100 }
          ]
        } as unknown as TouchEvent;
        mockupOverlayStore.startPinch(startEvent);

        // Extreme zoom in (10x)
        const extremeZoomEvent = {
          touches: [
            { clientX: 0, clientY: 100 },
            { clientX: 1000, clientY: 100 }
          ]
        } as unknown as TouchEvent;
        mockupOverlayStore.handlePinch(extremeZoomEvent);

        expect(mockupOverlayStore.scale).toBeLessThanOrEqual(4);
      });

      it("resets pinch state on endPinch", () => {
        const startEvent = {
          touches: [
            { clientX: 100, clientY: 100 },
            { clientX: 200, clientY: 100 }
          ]
        } as unknown as TouchEvent;
        mockupOverlayStore.startPinch(startEvent);

        // Should not throw
        expect(() => mockupOverlayStore.endPinch()).not.toThrow();
      });
    });

    describe("Safari Gesture Events (startGesturePinch/handleGesturePinch)", () => {
      beforeEach(() => {
        mockupOverlayStore.enterSolidMode();
        // Mock scroll position
        Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      });

      it("starts gesture pinch in solid mode", () => {
        expect(() => mockupOverlayStore.startGesturePinch(150, 150)).not.toThrow();
      });

      it("does not start gesture pinch outside solid mode", () => {
        mockupOverlayStore.exitSolidMode();
        const initialScale = mockupOverlayStore.scale;

        mockupOverlayStore.startGesturePinch(150, 150);
        mockupOverlayStore.handleGesturePinch(2); // 2x scale

        // Scale should remain unchanged
        expect(mockupOverlayStore.scale).toBe(initialScale);
      });

      it("handles gesture pinch with e.scale value", () => {
        const initialScale = mockupOverlayStore.scale;

        mockupOverlayStore.startGesturePinch(150, 150);
        mockupOverlayStore.handleGesturePinch(2); // 2x scale

        expect(mockupOverlayStore.scale).toBe(initialScale * 2);
      });

      it("clamps gesture scale to bounds", () => {
        mockupOverlayStore.startGesturePinch(150, 150);

        // Extreme zoom
        mockupOverlayStore.handleGesturePinch(10); // 10x scale

        expect(mockupOverlayStore.scale).toBeLessThanOrEqual(4);
      });

      it("adjusts position to keep pinch center in place", () => {
        const initialPosition = { ...mockupOverlayStore.position };
        const centerX = 200;
        const centerY = 300;

        mockupOverlayStore.startGesturePinch(centerX, centerY);
        mockupOverlayStore.handleGesturePinch(2); // 2x scale

        // Position should change to keep the pinch center in place
        // The exact calculation depends on the initial position and scale
        expect(mockupOverlayStore.position.x).not.toBe(initialPosition.x);
        expect(mockupOverlayStore.position.y).not.toBe(initialPosition.y);
      });

      it("endPinch resets state for gesture events too", () => {
        mockupOverlayStore.startGesturePinch(150, 150);
        mockupOverlayStore.handleGesturePinch(2);

        expect(() => mockupOverlayStore.endPinch()).not.toThrow();
      });
    });

    describe("solid pan (single finger in solid mode)", () => {
      beforeEach(() => {
        mockupOverlayStore.enterSolidMode();
      });

      it("starts solid pan", () => {
        const mockEvent = {
          touches: [{ clientX: 100, clientY: 100 }]
        } as unknown as TouchEvent;

        expect(() => mockupOverlayStore.startSolidPan(mockEvent)).not.toThrow();
      });

      it("handles solid pan movement (same direction)", () => {
        const initialPosition = { ...mockupOverlayStore.position };

        const startEvent = {
          touches: [{ clientX: 100, clientY: 100 }]
        } as unknown as TouchEvent;
        mockupOverlayStore.startSolidPan(startEvent);

        const moveEvent = {
          touches: [{ clientX: 150, clientY: 200 }]
        } as unknown as TouchEvent;
        mockupOverlayStore.handleSolidPan(moveEvent);

        // Same direction: finger moves right (+50), image moves right (+50)
        expect(mockupOverlayStore.position.x).toBe(initialPosition.x + 50);
        // Same direction: finger moves down (+100), image moves down (+100)
        expect(mockupOverlayStore.position.y).toBe(initialPosition.y + 100);
      });
    });
  });
});
