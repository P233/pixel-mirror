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
vi.mock("~/platform/database", () => ({
  readMockupLibrary: vi.fn(),
  selectMockup: vi.fn(),
  getMockupImage: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue(undefined),
  updateSettings: vi.fn().mockResolvedValue(undefined)
}));

// Mock toastStore
vi.mock("~/stores/toastStore.svelte", () => ({
  toastStore: {
    showError: vi.fn(),
    clear: vi.fn(),
    errorMessage: undefined
  }
}));

// Gestures take client coordinates as plain points
const at = (e: { clientX: number; clientY: number }): Position => ({ x: e.clientX, y: e.clientY });

describe("overlayController", () => {
  let flushSettings: typeof import("~/platform/settings.svelte").flushSettings;
  let overlayController: typeof import("~/features/overlay/controller.svelte").overlayController;
  let getMockupImage: ReturnType<typeof vi.fn>;
  let getSettings: ReturnType<typeof vi.fn>;
  let updateSettings: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    flushSettings = (await import("~/platform/settings.svelte")).flushSettings;

    // Mock URL.createObjectURL and URL.revokeObjectURL while preserving URL constructor
    const OriginalURL = globalThis.URL;
    vi.spyOn(OriginalURL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(OriginalURL, "revokeObjectURL").mockImplementation(() => {});

    // Get fresh mocks
    const dbModule = await import("~/platform/database");
    getMockupImage = dbModule.getMockupImage as ReturnType<typeof vi.fn>;
    getSettings = dbModule.getSettings as ReturnType<typeof vi.fn>;
    updateSettings = dbModule.updateSettings as ReturnType<typeof vi.fn>;

    // Reset mocks
    getMockupImage.mockReset().mockResolvedValue(undefined);
    getSettings.mockReset().mockResolvedValue({});
    updateSettings.mockReset().mockResolvedValue(undefined);
    vi.mocked(dbModule.readMockupLibrary).mockImplementation(async () => {
      const stored = await dbModule.getSettings("mockupOverlay");
      return { items: [], activeId: (stored as MockupOverlaySettings)?.activeMockupId ?? null, stored };
    });
    vi.mocked(dbModule.selectMockup).mockImplementation(async (id) => ({
      added: [],
      activeId: id,
      appearance: id ? { isHidden: false, isLocked: false } : {}
    }));

    // Import fresh store
    const module = await import("~/features/overlay/controller.svelte");
    overlayController = module.overlayController;
  });

  async function initialize(controller = overlayController) {
    const { mockupStore } = await import("~/stores/mockupStore.svelte");
    await mockupStore.init();
    return controller.sync();
  }

  async function selectMockup(id: string | null) {
    const { mockupStore } = await import("~/stores/mockupStore.svelte");
    await mockupStore.select(id);
    void overlayController.sync();
  }

  // Don't let this test's pending saves land in the next test
  afterEach(async () => {
    await flushSettings();
  });

  describe("initial state", () => {
    it("has default values before init", () => {
      expect(overlayController.activeMockupId).toBeNull();
      expect(overlayController.isHidden).toBe(false);
      expect(overlayController.isLocked).toBe(false);
      expect(overlayController.opacity).toBe(0.5);
      expect(overlayController.scale).toBe(1);
      expect(overlayController.mode).toBe("visible");
    });
  });

  describe("init", () => {
    it("loads settings from database", async () => {
      getSettings.mockResolvedValue({
        activeMockupId: "test-id",
        isHidden: true,
        isLocked: true,
        opacity: 0.7,
        scale: 0.5,
        position: { x: 100, y: 200 },
        alignmentX: "center",
        alignmentY: "top"
      });

      await initialize();

      expect(overlayController.activeMockupId).toBe("test-id");
      expect(overlayController.isHidden).toBe(true);
      expect(overlayController.isLocked).toBe(true);
      expect(overlayController.opacity).toBe(0.7);
      expect(overlayController.scale).toBe(0.5);
      expect(overlayController.alignmentX).toBe("center");
      expect(overlayController.alignmentY).toBe("top");
    });

    it("sets mode to locked if isLocked is true", async () => {
      getSettings.mockResolvedValue({ isLocked: true });

      await initialize();

      expect(overlayController.mode).toBe("locked");
    });

    it("only initializes once", async () => {
      await initialize();
      await initialize();

      expect(getSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("state machine transitions", () => {
    beforeEach(async () => {
      await initialize();
    });

    describe("visible state", () => {
      it("starts in visible mode", () => {
        expect(overlayController.mode).toBe("visible");
      });

      it("can toggle lock (visible → locked)", () => {
        overlayController.toggleLock();

        expect(overlayController.mode).toBe("locked");
        expect(overlayController.isLocked).toBe(true);
      });

      it("can enter solid mode (visible → solid)", () => {
        overlayController.enterSolidMode();

        expect(overlayController.mode).toBe("solid");
      });

      it("can start drag (visible → dragging)", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        overlayController.beginDrag(at(mockEvent));

        expect(overlayController.mode).toBe("dragging");
        expect(overlayController.isDragging).toBe(true);
      });
    });

    describe("locked state", () => {
      beforeEach(() => {
        overlayController.toggleLock();
        expect(overlayController.mode).toBe("locked");
      });

      it("can toggle lock back to visible (locked → visible)", () => {
        overlayController.toggleLock();

        expect(overlayController.mode).toBe("visible");
        expect(overlayController.isLocked).toBe(false);
      });

      it("can enter solid mode (locked → solid)", () => {
        overlayController.enterSolidMode();

        expect(overlayController.mode).toBe("solid");
      });

      it("cannot start drag", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        overlayController.beginDrag(at(mockEvent));

        expect(overlayController.mode).toBe("locked");
      });

      it("allows opacity adjustment in locked mode", () => {
        // Locked mode still allows opacity adjustments (per state machine design)
        const initialOpacity = overlayController.opacity;
        overlayController.stepOpacity(-1);

        expect(overlayController.opacity).toBeLessThan(initialOpacity);
      });

      it("ignores scale change", () => {
        overlayController.cycleScale();

        expect(overlayController.scale).toBe(1);
      });

      it("ignores alignment changes", () => {
        overlayController.setAlignment("bottom", "left");

        expect(overlayController.alignmentX).toBe("center");
        expect(overlayController.alignmentY).toBe("top");
      });

      it("ignores movement", () => {
        const initialPosition = { ...overlayController.position };
        overlayController.move(50, 50);

        expect(overlayController.position).toEqual(initialPosition);
      });
    });

    describe("solid state", () => {
      beforeEach(() => {
        overlayController.enterSolidMode();
        expect(overlayController.mode).toBe("solid");
      });

      it("has full effective opacity", () => {
        expect(overlayController.effectiveOpacity).toBe(1);
      });

      it("reports isSolidOrZoomed as true", () => {
        expect(overlayController.isSolidOrZoomed).toBe(true);
      });

      it("can exit to previous mode (solid → visible)", () => {
        overlayController.exitSolidMode();

        expect(overlayController.mode).toBe("visible");
      });

      it("returns to locked if was locked before solid", async () => {
        // Reset and start from locked
        vi.resetModules();
        const module = await import("~/features/overlay/controller.svelte");
        const store = module.overlayController;
        // afterEach flushes this instance\'s pending saves
        flushSettings = (await import("~/platform/settings.svelte")).flushSettings;

        await initialize(store);
        store.toggleLock();
        expect(store.mode).toBe("locked");

        store.enterSolidMode();
        expect(store.mode).toBe("solid");

        store.exitSolidMode();
        expect(store.mode).toBe("locked");
      });

      it("cannot toggle lock", () => {
        overlayController.toggleLock();

        expect(overlayController.mode).toBe("solid");
      });

      it("cannot start drag", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        overlayController.beginDrag(at(mockEvent));

        expect(overlayController.mode).toBe("solid");
      });
    });

    describe("zoomed state", () => {
      beforeEach(() => {
        overlayController.enterSolidMode();

        // Mock document properties needed for zoom calculations
        Object.defineProperty(document.documentElement, "clientWidth", { value: 1920, configurable: true });
        Object.defineProperty(document.documentElement, "clientHeight", { value: 1080, configurable: true });
        Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      });

      it("can enter zoom from solid (solid → zoomed)", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        overlayController.enterZoomMode(at(mockEvent));

        expect(overlayController.mode).toBe("zoomed");
      });

      it("doubles the scale when zoomed", () => {
        const originalScale = overlayController.scale;
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;

        overlayController.enterZoomMode(at(mockEvent));

        expect(overlayController.scale).toBe(originalScale * 2);
      });

      it("reports isSolidOrZoomed as true", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        overlayController.enterZoomMode(at(mockEvent));

        expect(overlayController.isSolidOrZoomed).toBe(true);
      });

      it("can exit zoom to solid (zoomed → solid)", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        overlayController.enterZoomMode(at(mockEvent));

        overlayController.exitZoomMode();

        expect(overlayController.mode).toBe("solid");
      });

      it("restores scale when exiting zoom", () => {
        const originalScale = overlayController.scale;
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;

        overlayController.enterZoomMode(at(mockEvent));
        overlayController.exitZoomMode();

        expect(overlayController.scale).toBe(originalScale);
      });

      it("can exit zoom via exitSolidMode (zoomed → visible/locked)", () => {
        const mockEvent = { clientX: 500, clientY: 300 } as MouseEvent;
        overlayController.enterZoomMode(at(mockEvent));

        overlayController.exitSolidMode();

        expect(overlayController.mode).toBe("visible");
      });
    });

    describe("dragging state", () => {
      it("transitions to dragging on mouse down", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        overlayController.beginDrag(at(mockEvent));

        expect(overlayController.mode).toBe("dragging");
      });

      it("reports isDragging as true", () => {
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;
        overlayController.beginDrag(at(mockEvent));

        expect(overlayController.isDragging).toBe(true);
      });

      it("only allows drag from visible mode", () => {
        overlayController.toggleLock();
        const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;

        overlayController.beginDrag(at(mockEvent));

        expect(overlayController.mode).toBe("locked");
        expect(overlayController.isDragging).toBe(false);
      });
    });
  });

  describe("opacity controls", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("steps opacity up", () => {
      const initial = overlayController.opacity;
      overlayController.stepOpacity(1);

      expect(overlayController.opacity).toBeGreaterThan(initial);
    });

    it("steps opacity down", () => {
      const initial = overlayController.opacity;
      overlayController.stepOpacity(-1);

      expect(overlayController.opacity).toBeLessThan(initial);
    });

    it("clamps opacity to minimum", () => {
      // Decrease many times to hit minimum
      for (let i = 0; i < 20; i++) {
        overlayController.stepOpacity(-1);
      }

      expect(overlayController.opacity).toBe(0.1);
    });

    it("clamps opacity to maximum", () => {
      // Increase many times to hit maximum
      for (let i = 0; i < 20; i++) {
        overlayController.stepOpacity(1);
      }

      expect(overlayController.opacity).toBe(0.9);
    });

    it("resets opacity to default", () => {
      overlayController.stepOpacity(-1);
      overlayController.stepOpacity(-1);

      overlayController.resetOpacity();

      expect(overlayController.opacity).toBe(0.5);
    });

    it("persists opacity changes", async () => {
      overlayController.stepOpacity(-1);

      await flushSettings();
      expect(updateSettings).toHaveBeenLastCalledWith(
        "mockupOverlay",
        expect.objectContaining({ opacity: expect.any(Number) })
      );
    });
  });

  describe("visibility toggle", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("toggles hidden state", () => {
      expect(overlayController.isHidden).toBe(false);

      overlayController.toggleVisibility();
      expect(overlayController.isHidden).toBe(true);

      overlayController.toggleVisibility();
      expect(overlayController.isHidden).toBe(false);
    });

    it("persists visibility changes", async () => {
      overlayController.toggleVisibility();

      await flushSettings();
      expect(updateSettings).toHaveBeenLastCalledWith("mockupOverlay", expect.objectContaining({ isHidden: true }));
    });

    it("exits solid/zoomed mode when toggling visibility", () => {
      overlayController.enterSolidMode();
      expect(overlayController.mode).toBe("solid");

      overlayController.toggleVisibility();

      expect(overlayController.mode).toBe("visible");
    });
  });

  describe("alignment", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("sets both alignments at once", () => {
      overlayController.setAlignment("bottom", "right");

      expect(overlayController.alignmentX).toBe("right");
      expect(overlayController.alignmentY).toBe("bottom");
    });

    it("reports isAligned correctly", () => {
      overlayController.move(1, 1);
      expect(overlayController.isAligned).toBe(false);

      overlayController.setAlignment("top", "center");
      expect(overlayController.isAligned).toBe(true);
    });
  });

  describe("computed properties", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("effectiveOpacity is 1 in solid mode", () => {
      overlayController.enterSolidMode();
      expect(overlayController.effectiveOpacity).toBe(1);
    });

    it("effectiveOpacity equals opacity in visible mode", () => {
      expect(overlayController.effectiveOpacity).toBe(overlayController.opacity);
    });

    it("positionDisplay shows coordinates when not aligned", () => {
      overlayController.move(1, 1);
      expect(overlayController.positionDisplay).toMatch(/x:\d+, y:\d+/);
    });

    it("positionDisplay shows alignment when aligned", () => {
      overlayController.setAlignment("top", "center");
      expect(overlayController.positionDisplay).toBe("top·center");
    });
  });

  describe("movement", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("moves position by delta", () => {
      const initial = { ...overlayController.position };
      overlayController.move(10, 20);

      expect(overlayController.position.x).toBe(initial.x + 10);
      expect(overlayController.position.y).toBe(initial.y + 20);
    });

    it("clears alignment when moving along both axes", () => {
      overlayController.setAlignment("top", "center");
      overlayController.move(1, 1);

      expect(overlayController.alignmentX).toBeNull();
      expect(overlayController.alignmentY).toBeNull();
    });

    it("keeps the horizontal centering when nudged vertically", () => {
      overlayController.setAlignment("top", "center");
      overlayController.move(0, 10);

      expect(overlayController.alignmentX).toBe("center");
      expect(overlayController.alignmentY).toBeNull();
      expect(overlayController.positionDisplay).toMatch(/^center, y:\d+$/);
    });

    it("saves moves made in one task as a single write", async () => {
      const initial = { ...overlayController.position };

      for (let i = 0; i < 10; i++) overlayController.move(5, 5);
      await Promise.resolve();

      expect(updateSettings).toHaveBeenCalledTimes(1);
      expect(updateSettings).toHaveBeenLastCalledWith(
        "mockupOverlay",
        expect.objectContaining({
          position: { x: initial.x + 50, y: initial.y + 50 },
          alignmentX: null,
          alignmentY: null
        })
      );
    });
  });

  describe("scale cycling", () => {
    beforeEach(async () => {
      await initialize();
      // Mock document properties needed for scale calculations
      Object.defineProperty(document.documentElement, "clientWidth", { value: 1920, configurable: true });
      Object.defineProperty(document.documentElement, "clientHeight", { value: 1080, configurable: true });
      Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    });

    it("cycles scale from 1 to 0.5", () => {
      expect(overlayController.scale).toBe(1);

      overlayController.cycleScale();

      expect(overlayController.scale).toBe(0.5);
    });

    it("cycles scale from 0.5 back to 1", async () => {
      // Reset with 0.5 scale
      vi.resetModules();
      const dbModule = await import("~/platform/database");
      const gsModule = dbModule.getSettings as ReturnType<typeof vi.fn>;
      gsModule.mockReset().mockResolvedValue({ scale: 0.5 });

      const module = await import("~/features/overlay/controller.svelte");
      const store = module.overlayController;
      // afterEach flushes this instance\'s pending saves
      flushSettings = (await import("~/platform/settings.svelte")).flushSettings;

      await initialize(store);
      expect(store.scale).toBe(0.5);

      store.cycleScale();
      expect(store.scale).toBe(1);
    });

    it("persists scale and position changes", async () => {
      overlayController.cycleScale();

      await flushSettings();
      expect(updateSettings).toHaveBeenLastCalledWith("mockupOverlay", expect.objectContaining({ scale: 0.5 }));
      await flushSettings();
      expect(updateSettings).toHaveBeenLastCalledWith(
        "mockupOverlay",
        expect.objectContaining({ position: expect.any(Object) })
      );
    });

    it("clears alignment when cycling scale", () => {
      overlayController.setAlignment("top", "center");
      overlayController.cycleScale();

      expect(overlayController.alignmentX).toBeNull();
      expect(overlayController.alignmentY).toBeNull();
    });

    it("does not cycle scale when not in visible mode", () => {
      overlayController.toggleLock();
      expect(overlayController.mode).toBe("locked");

      overlayController.cycleScale();

      expect(overlayController.scale).toBe(1);
    });
  });

  describe("positionDisplay variations", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("shows both alignments when both are set", () => {
      overlayController.setAlignment("bottom", "left");

      expect(overlayController.positionDisplay).toBe("bottom·left");
    });

    it("shows alignment with center", () => {
      overlayController.setAlignment("top", "center");

      expect(overlayController.positionDisplay).toBe("top·center");
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

    const mockup = (id: string) => new Blob([id], { type: "image/png" });
    const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

    beforeEach(() => {
      vi.stubGlobal("Image", FakeImage);
      let urlCount = 0;
      vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:url-${++urlCount}`);
      overlayController.setPageSize({ width: 1024, height: 3000 });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("applies the default top-center alignment once the image size is known", async () => {
      getMockupImage.mockImplementation(async (id: string) => mockup(id));
      await initialize();

      await selectMockup("a");
      await flush();

      expect(overlayController.positionDisplay).toBe("top·center");
      expect(overlayController.position.x).toBe((1024 - 800) / 2);
    });

    it("re-aligns when switching to a mockup of a different width", async () => {
      getMockupImage.mockImplementation(async (id: string) => mockup(id));
      await initialize();
      await selectMockup("a");
      await flush();

      FakeImage.width = 1000;
      await selectMockup("b");
      await flush();
      FakeImage.width = 800;

      expect(overlayController.position.x).toBe((1024 - 1000) / 2);
    });

    it("ignores a slower load that was superseded by a newer selection", async () => {
      let resolveA: (value: ReturnType<typeof mockup>) => void = () => {};
      getMockupImage.mockImplementation((id: string) =>
        id === "a" ? new Promise((resolve) => (resolveA = resolve)) : Promise.resolve(mockup(id))
      );
      await initialize();

      await selectMockup("a");
      await selectMockup("b");
      await flush();
      const urlForB = overlayController.activeMockupUrl;

      resolveA(mockup("a"));
      await flush();

      expect(overlayController.activeMockupId).toBe("b");
      expect(overlayController.activeMockupUrl).toBe(urlForB);
    });

    it("keeps the active image URL usable when re-initialized (remount)", async () => {
      getSettings.mockResolvedValue({ activeMockupId: "a" });
      getMockupImage.mockImplementation(async (id: string) => mockup(id));
      await initialize();
      const url = overlayController.activeMockupUrl;
      overlayController.enterSolidMode();

      await initialize();

      expect(overlayController.activeMockupUrl).toBe(url);
      expect(overlayController.mode).toBe("solid");
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(url);
    });

    it("revokes the current URL on unmount and recreates it on remount", async () => {
      getSettings.mockResolvedValue({ activeMockupId: "a" });
      getMockupImage.mockResolvedValue(mockup("a"));
      await initialize();
      const first = overlayController.activeMockupUrl;
      overlayController.enterSolidMode();
      overlayController.cleanup();
      expect(overlayController.activeMockupUrl).toBeNull();
      expect(overlayController.mode).toBe("visible");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(first);
      await overlayController.sync();
      expect(overlayController.activeMockupUrl).not.toBe(first);
      expect(overlayController.mockupSize.width).toBe(800);
    });

    it("discards image reads that complete after unmount", async () => {
      getSettings.mockResolvedValue({ activeMockupId: "a" });
      let release!: (blob: Blob) => void;
      getMockupImage.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          })
      );
      const loading = initialize();
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      overlayController.cleanup();
      release(mockup("a"));
      await loading;
      expect(overlayController.activeMockupUrl).toBeNull();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it.each(["solid", "zoomed", "dragging"] as const)(
      "retires %s interaction when the selected resource is cleared",
      async (mode) => {
        getMockupImage.mockResolvedValue(mockup("a"));
        await initialize();
        await selectMockup("a");
        await flush();
        if (mode === "dragging") overlayController.beginDrag({ x: 100, y: 100 });
        else {
          overlayController.enterSolidMode();
          if (mode === "zoomed") overlayController.enterZoomMode({ x: 100, y: 100 });
        }
        expect(overlayController.mode).toBe(mode);
        await selectMockup(null);
        await flush();
        expect(overlayController.mode).toBe("visible");
        expect(overlayController.isSolidOrZoomed).toBe(false);
        expect(overlayController.activeMockupUrl).toBeNull();
      }
    );

    it.each(["solid", "zoomed", "dragging"] as const)(
      "retires %s interaction when replacing the image",
      async (mode) => {
        getMockupImage.mockResolvedValue(mockup("a"));
        await initialize();
        await selectMockup("a");
        await flush();
        const oldUrl = overlayController.activeMockupUrl;
        if (mode === "dragging") overlayController.beginDrag({ x: 100, y: 100 });
        else {
          overlayController.enterSolidMode();
          if (mode === "zoomed") overlayController.enterZoomMode({ x: 100, y: 100 });
        }
        await selectMockup("b");
        await flush();
        expect(overlayController.mode).toBe("visible");
        expect(overlayController.activeMockupUrl).not.toBe(oldUrl);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(oldUrl);
      }
    );

    it("retires inspection on image read failure while preserving persistent appearance", async () => {
      getMockupImage.mockResolvedValue(mockup("a"));
      await initialize();
      await selectMockup("a");
      await flush();
      overlayController.setOpacity(0.7);
      overlayController.cycleScale();
      overlayController.enterSolidMode();
      getMockupImage.mockRejectedValueOnce(new Error("temporary read failure"));
      await selectMockup("b");
      await flush();
      expect(overlayController.mode).toBe("visible");
      expect(overlayController.activeMockupUrl).toBeNull();
      expect(overlayController.scale).toBe(0.5);
      expect(overlayController.opacity).toBe(0.7);
    });

    it("retries a failed active-image read", async () => {
      getSettings.mockResolvedValue({ activeMockupId: "a" });
      getMockupImage.mockRejectedValueOnce(new Error("temporary read failure")).mockResolvedValue(mockup("a"));

      await initialize();
      await initialize();

      expect(overlayController.activeMockupUrl).not.toBeNull();
      expect(overlayController.mockupSize.width).toBe(800);
    });

    it("retries a failed selection after initialization", async () => {
      await initialize();
      getMockupImage.mockRejectedValueOnce(new Error("temporary read failure")).mockResolvedValue(mockup("a"));
      await selectMockup("a");
      await flush();
      getSettings.mockResolvedValue({ activeMockupId: "a" });

      await initialize();

      expect(overlayController.mockupSize.width).toBe(800);
    });

    it("revokes a failed image URL and retries decoding on init", async () => {
      let canDecode = false;
      vi.stubGlobal(
        "Image",
        class extends FakeImage {
          set src(_url: string) {
            setTimeout(() => (canDecode ? this.onload?.() : this.onerror?.()), 0);
          }
        }
      );
      getSettings.mockResolvedValue({ activeMockupId: "a" });
      getMockupImage.mockResolvedValue(mockup("a"));

      await initialize();
      expect(overlayController.activeMockupUrl).toBeNull();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:url-1");
      canDecode = true;
      await initialize();

      expect(overlayController.mockupSize.width).toBe(800);
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
      getMockupImage.mockResolvedValue(new Blob(["a"], { type: "image/png" }));
      await initialize();
      await selectMockup("a");
      await flush();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("follows the page width while centered", () => {
      overlayController.setPageSize({ width: 1024, height: 3000 });
      expect(overlayController.position.x).toBe(112);

      overlayController.setPageSize({ width: 1440, height: 3000 });
      expect(overlayController.position.x).toBe(320);
    });

    it("stays at the bottom when the document grows", () => {
      overlayController.setAlignment("bottom", "center");

      overlayController.setPageSize({ width: 1024, height: 3000 });
      expect(overlayController.position.y).toBe(1500);

      overlayController.setPageSize({ width: 1024, height: 5000 });
      expect(overlayController.position.y).toBe(3500);
    });

    it("keeps a freely placed mockup where it is when the page resizes", () => {
      overlayController.setPageSize({ width: 1024, height: 3000 });
      overlayController.move(5, 5);

      overlayController.setPageSize({ width: 1440, height: 3000 });

      expect(overlayController.position).toEqual({ x: 117, y: 5 });
    });
  });

  describe("zoom from a pinched view", () => {
    it("returns to the pinched view when leaving zoom, and to the placement when leaving solid", () => {
      Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      overlayController.enterSolidMode();
      overlayController.beginPinch({ x: 0, y: 0 });
      overlayController.pinchTo(1.5);
      const pinched = { position: { ...overlayController.position }, scale: overlayController.scale };

      overlayController.enterZoomMode({ x: 10, y: 10 });
      expect(overlayController.scale).toBe(3);
      overlayController.exitZoomMode();

      expect(overlayController.scale).toBe(pinched.scale);
      expect(overlayController.position).toEqual(pinched.position);

      overlayController.exitSolidMode();
      expect(overlayController.scale).toBe(1);
      expect(overlayController.mode).toBe("visible");
    });
  });

  describe("leaving solid mode", () => {
    it("restores the pre-solid scale when hiding from mobile solid mode", () => {
      overlayController.cycleScale(); // 1x -> 0.5x
      overlayController.toggleMobileSolidMode();
      overlayController.beginPinch({ x: 0, y: 0 });
      overlayController.pinchTo(3);

      overlayController.toggleVisibility();

      expect(overlayController.scale).toBe(0.5);
      expect(overlayController.mode).toBe("visible");
    });

    it("restores the pre-solid scale when exiting desktop solid mode after a pinch", () => {
      overlayController.enterSolidMode();
      overlayController.beginPinch({ x: 0, y: 0 });
      overlayController.pinchTo(2);

      overlayController.exitSolidMode();

      expect(overlayController.scale).toBe(1);
    });
  });

  describe("getters", () => {
    beforeEach(async () => {
      await initialize();
    });

    it("activeMockupUrl is null initially", () => {
      expect(overlayController.activeMockupUrl).toBeNull();
    });

    it("mockupSize is zero initially", () => {
      expect(overlayController.mockupSize).toEqual({ width: 0, height: 0 });
    });

    it("isZoomPanning is false initially", () => {
      expect(overlayController.isZoomPanning).toBe(false);
    });
  });

  // ============================================
  // Mobile Touch Methods Tests
  // ============================================

  describe("mobile touch methods", () => {
    beforeEach(async () => {
      await initialize();
    });

    describe("setOpacity", () => {
      it("sets opacity directly", () => {
        overlayController.setOpacity(0.75);

        expect(overlayController.opacity).toBe(0.75);
      });

      it("clamps opacity to minimum", () => {
        overlayController.setOpacity(0);

        expect(overlayController.opacity).toBe(0.1);
      });

      it("clamps opacity to maximum", () => {
        overlayController.setOpacity(1);

        expect(overlayController.opacity).toBe(0.9);
      });

      it("persists opacity change", async () => {
        overlayController.setOpacity(0.6);

        await flushSettings();
        expect(updateSettings).toHaveBeenLastCalledWith("mockupOverlay", expect.objectContaining({ opacity: 0.6 }));
      });

      it("does not change opacity when not in visible or locked mode", () => {
        overlayController.enterSolidMode();
        const initial = overlayController.opacity;

        overlayController.setOpacity(0.8);

        expect(overlayController.opacity).toBe(initial);
      });
    });

    describe("drag", () => {
      it("starts from visible mode", () => {
        overlayController.beginDrag({ x: 100, y: 100 });

        expect(overlayController.mode).toBe("dragging");
      });

      it("does not start from locked mode", () => {
        overlayController.toggleLock();

        overlayController.beginDrag({ x: 100, y: 100 });

        expect(overlayController.mode).toBe("locked");
      });

      it("moves with the pointer", () => {
        const initialPosition = { ...overlayController.position };

        overlayController.beginDrag({ x: 100, y: 100 });
        overlayController.dragTo({ x: 150, y: 200 });

        expect(overlayController.position.x).toBe(initialPosition.x + 50);
        expect(overlayController.position.y).toBe(initialPosition.y + 100);
      });

      it("persists the position when the drag ends", async () => {
        overlayController.beginDrag({ x: 100, y: 100 });
        overlayController.dragTo({ x: 130, y: 90 });
        overlayController.endDrag();

        expect(overlayController.mode).toBe("visible");
        await flushSettings();
        expect(updateSettings).toHaveBeenLastCalledWith(
          "mockupOverlay",
          expect.objectContaining({ position: overlayController.position })
        );
      });

      it("clears alignment after a drag along both axes", () => {
        overlayController.setAlignment("top", "center");

        overlayController.beginDrag({ x: 100, y: 100 });
        overlayController.dragTo({ x: 101, y: 130 });
        overlayController.endDrag();

        expect(overlayController.alignmentX).toBeNull();
        expect(overlayController.alignmentY).toBeNull();
      });

      it("keeps the alignment of an axis the drag didn't move along", () => {
        overlayController.setAlignment("top", "center");

        overlayController.beginDrag({ x: 100, y: 100 });
        overlayController.dragTo({ x: 100, y: 130 });
        overlayController.endDrag();

        expect(overlayController.alignmentX).toBe("center");
        expect(overlayController.alignmentY).toBeNull();
      });

      it("keeps alignment after a click without movement", async () => {
        overlayController.setAlignment("top", "center");
        await flushSettings();
        vi.mocked(updateSettings).mockClear();

        overlayController.beginDrag({ x: 100, y: 100 });
        overlayController.dragTo({ x: 100, y: 100 });
        overlayController.endDrag();

        expect(overlayController.mode).toBe("visible");
        expect(overlayController.alignmentX).toBe("center");
        expect(overlayController.alignmentY).toBe("top");
        await flushSettings();
        expect(updateSettings).not.toHaveBeenCalled();
      });

      it("ignores dragTo and endDrag without a drag", async () => {
        const initialPosition = { ...overlayController.position };

        overlayController.dragTo({ x: 500, y: 500 });
        overlayController.endDrag();

        expect(overlayController.position).toEqual(initialPosition);
        await flushSettings();
        expect(updateSettings).not.toHaveBeenCalled();
      });
    });

    describe("toggleMobileSolidMode (double tap)", () => {
      it("enters solid mode from visible", () => {
        overlayController.toggleMobileSolidMode();

        expect(overlayController.mode).toBe("solid");
      });

      it("exits solid mode back to visible", () => {
        overlayController.toggleMobileSolidMode(); // Enter
        overlayController.toggleMobileSolidMode(); // Exit

        expect(overlayController.mode).toBe("visible");
      });

      it("exits zoom straight back to visible (hybrid devices zoom with a mouse or pen)", () => {
        overlayController.toggleMobileSolidMode(); // Enter
        overlayController.enterZoomMode(at({ clientX: 500, clientY: 300 } as MouseEvent));
        expect(overlayController.mode).toBe("zoomed");

        overlayController.toggleMobileSolidMode(); // Exit

        expect(overlayController.mode).toBe("visible");
      });

      it("returns to locked if was locked before solid", () => {
        overlayController.toggleLock(); // Lock
        overlayController.toggleMobileSolidMode(); // Enter solid

        expect(overlayController.mode).toBe("solid");

        overlayController.toggleMobileSolidMode(); // Exit solid

        expect(overlayController.mode).toBe("locked");
      });

      it("restores scale and position when exiting solid mode after a pinch and pan", () => {
        const before = { position: { ...overlayController.position }, scale: overlayController.scale };
        overlayController.toggleMobileSolidMode(); // Enter
        overlayController.beginPinch({ x: 100, y: 100 });
        overlayController.pinchTo(2);
        overlayController.beginPan({ x: 0, y: 0 });
        overlayController.panTo({ x: 40, y: 40 });

        overlayController.toggleMobileSolidMode(); // Exit

        expect(overlayController.scale).toBe(before.scale);
        expect(overlayController.position).toEqual(before.position);
      });
    });

    describe("pinch zoom (solid mode)", () => {
      beforeEach(() => {
        Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      });

      it("scales relative to the scale at the start of the pinch", () => {
        overlayController.enterSolidMode();
        overlayController.beginPinch({ x: 150, y: 150 });

        overlayController.pinchTo(2);
        expect(overlayController.scale).toBe(2);

        overlayController.pinchTo(1.5);
        expect(overlayController.scale).toBe(1.5);
      });

      it("clamps the scale to the pinch range", () => {
        overlayController.enterSolidMode();
        overlayController.beginPinch({ x: 150, y: 150 });

        overlayController.pinchTo(10);
        expect(overlayController.scale).toBe(4);

        overlayController.pinchTo(0.01);
        expect(overlayController.scale).toBe(0.25);
      });

      it("keeps the mockup point under the pinch center in place", () => {
        overlayController.enterSolidMode();
        const start = { ...overlayController.position };
        const center = { x: 150, y: 150 };
        const pointUnderCenter = { x: center.x - start.x, y: center.y - start.y };

        overlayController.beginPinch(center);
        overlayController.pinchTo(2);

        expect(overlayController.position).toEqual({
          x: center.x - pointUnderCenter.x * 2,
          y: center.y - pointUnderCenter.y * 2
        });
      });

      it("uses page coordinates for the center when the page is scrolled", () => {
        Object.defineProperty(window, "scrollY", { value: 500, configurable: true });
        overlayController.enterSolidMode();

        overlayController.beginPinch({ x: 0, y: 100 });
        overlayController.pinchTo(2);

        // The mockup top-left (0, 0) is 600px above the page point (0, 600) under the fingers
        expect(overlayController.position).toEqual({ x: 0, y: -600 });
      });

      it("is ignored outside solid mode", () => {
        overlayController.beginPinch({ x: 150, y: 150 });
        overlayController.pinchTo(2);

        expect(overlayController.scale).toBe(1);
      });
    });

    describe("solid pan (one finger in solid mode)", () => {
      it("follows the finger (same direction)", () => {
        overlayController.enterSolidMode();
        const initialPosition = { ...overlayController.position };

        overlayController.beginPan({ x: 100, y: 100 });
        overlayController.panTo({ x: 150, y: 200 });

        expect(overlayController.position.x).toBe(initialPosition.x + 50);
        expect(overlayController.position.y).toBe(initialPosition.y + 100);
      });

      it("is ignored outside solid mode", () => {
        const initialPosition = { ...overlayController.position };

        overlayController.beginPan({ x: 100, y: 100 });
        overlayController.panTo({ x: 150, y: 200 });

        expect(overlayController.position).toEqual(initialPosition);
      });
    });

    describe("zoom pan (mouse while zoomed)", () => {
      beforeEach(() => {
        Object.defineProperty(document.documentElement, "clientWidth", { value: 1000, configurable: true });
        Object.defineProperty(document.documentElement, "clientHeight", { value: 800, configurable: true });
        Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
        Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      });

      it("moves the mockup opposite to the mouse, like moving the viewport", () => {
        overlayController.enterSolidMode();
        overlayController.enterZoomMode({ x: 100, y: 100 });
        const zoomedPosition = { ...overlayController.position };

        overlayController.zoomPanTo({ x: 130, y: 80 });

        expect(overlayController.isZoomPanning).toBe(true);
        expect(overlayController.position).toEqual({ x: zoomedPosition.x - 30, y: zoomedPosition.y + 20 });
      });

      it("is ignored when not zoomed", () => {
        overlayController.enterSolidMode();
        const initialPosition = { ...overlayController.position };

        overlayController.zoomPanTo({ x: 130, y: 80 });

        expect(overlayController.isZoomPanning).toBe(false);
        expect(overlayController.position).toEqual(initialPosition);
      });
    });
  });
});
