/**
 * DockStore Tests
 *
 * Tests the dock UI state machine with three modes:
 * - toolbar: Main toolbar with quick actions
 * - mockups: Mockup manager panel
 * - grids: Grid manager panel
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module
vi.mock("./database", () => ({
  getSettings: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn().mockResolvedValue(undefined)
}));

// Mock toastStore
vi.mock("./toastStore.svelte", () => ({
  toastStore: {
    showError: vi.fn(),
    clear: vi.fn()
  }
}));

describe("dockStore", () => {
  let flushSettings: typeof import("~/platform/settings.svelte").flushSettings;
  let dockStore: typeof import("./dockStore.svelte").dockStore;
  let getSettings: ReturnType<typeof vi.fn>;
  let saveSettings: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    flushSettings = (await import("~/platform/settings.svelte")).flushSettings;

    // Get fresh mocks
    const dbModule = await import("./database");

    getSettings = dbModule.getSettings as ReturnType<typeof vi.fn>;
    saveSettings = dbModule.saveSettings as ReturnType<typeof vi.fn>;

    // Reset mocks
    getSettings.mockReset().mockResolvedValue({});
    saveSettings.mockReset().mockResolvedValue(undefined);

    // Import fresh store
    const module = await import("./dockStore.svelte");
    dockStore = module.dockStore;
  });

  // Don't let this test's pending saves land in the next test
  afterEach(async () => {
    await flushSettings();
  });

  describe("initial state", () => {
    it("starts uninitialized", () => {
      expect(dockStore.initialized).toBe(false);
    });

    it("has default values before init", () => {
      expect(dockStore.mode).toBe("toolbar");
      expect(dockStore.position).toBe("bottom");
      expect(dockStore.theme).toBe("light");
    });
  });

  describe("init", () => {
    it("loads settings from database", async () => {
      getSettings.mockResolvedValue({
        position: "top",
        theme: "dark"
      });

      await dockStore.init();

      expect(dockStore.initialized).toBe(true);
      expect(dockStore.position).toBe("top");
      expect(dockStore.theme).toBe("dark");
    });

    it("only initializes once", async () => {
      await dockStore.init();
      await dockStore.init();

      expect(getSettings).toHaveBeenCalledTimes(1);
    });

    it("keeps defaults when no settings in database", async () => {
      getSettings.mockResolvedValue({});

      await dockStore.init();

      expect(dockStore.position).toBe("bottom");
      expect(dockStore.theme).toBe("light");
    });
  });

  describe("mode transitions", () => {
    beforeEach(async () => {
      await dockStore.init();
    });

    describe("enterToolbar", () => {
      it("sets mode to toolbar", () => {
        dockStore.enterMockups();
        dockStore.enterToolbar();

        expect(dockStore.mode).toBe("toolbar");
      });
    });

    describe("enterMockups", () => {
      it("sets mode to mockups", () => {
        dockStore.enterMockups();

        expect(dockStore.mode).toBe("mockups");
      });

      it("reports isManagerMode as true", () => {
        dockStore.enterMockups();

        expect(dockStore.isManagerMode).toBe(true);
      });
    });

    describe("enterGrids", () => {
      it("sets mode to grids", () => {
        dockStore.enterGrids();

        expect(dockStore.mode).toBe("grids");
      });

      it("reports isManagerMode as true", () => {
        dockStore.enterGrids();

        expect(dockStore.isManagerMode).toBe(true);
      });
    });
  });

  describe("position toggle", () => {
    beforeEach(async () => {
      await dockStore.init();
    });

    it("toggles from bottom to top", () => {
      expect(dockStore.position).toBe("bottom");

      dockStore.togglePosition();

      expect(dockStore.position).toBe("top");
    });

    it("toggles from top to bottom", async () => {
      getSettings.mockResolvedValue({ position: "top" });
      vi.resetModules();

      const module = await import("./dockStore.svelte");
      const store = module.dockStore;
      // afterEach flushes this instance's pending saves
      flushSettings = (await import("~/platform/settings.svelte")).flushSettings;
      await store.init();

      expect(store.position).toBe("top");

      store.togglePosition();

      expect(store.position).toBe("bottom");
    });

    it("persists position change", async () => {
      dockStore.togglePosition();

      await flushSettings();
      expect(saveSettings).toHaveBeenLastCalledWith("dock", expect.objectContaining({ position: "top" }));
    });
  });

  describe("theme toggle", () => {
    beforeEach(async () => {
      await dockStore.init();
    });

    it("toggles from light to dark", () => {
      expect(dockStore.theme).toBe("light");

      dockStore.toggleTheme();

      expect(dockStore.theme).toBe("dark");
    });

    it("toggles from dark to light", async () => {
      getSettings.mockResolvedValue({ theme: "dark" });
      vi.resetModules();

      const module = await import("./dockStore.svelte");
      const store = module.dockStore;
      // afterEach flushes this instance's pending saves
      flushSettings = (await import("~/platform/settings.svelte")).flushSettings;
      await store.init();

      expect(store.theme).toBe("dark");

      store.toggleTheme();

      expect(store.theme).toBe("light");
    });

    it("persists theme change", async () => {
      dockStore.toggleTheme();

      await flushSettings();
      expect(saveSettings).toHaveBeenLastCalledWith("dock", expect.objectContaining({ theme: "dark" }));
    });

    it("follows system prefers-color-scheme dynamically and still allows manual toggle", async () => {
      let changeListener: ((e: MediaQueryListEvent) => void) | undefined;
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
          changeListener = cb;
        },
        removeEventListener: vi.fn()
      }));

      try {
        getSettings.mockResolvedValue({});
        vi.resetModules();
        const module = await import("./dockStore.svelte");
        const store = module.dockStore;
        flushSettings = (await import("~/platform/settings.svelte")).flushSettings;
        await store.init();

        // Starts with OS dark theme
        expect(store.theme).toBe("dark");

        // User manually overrides to light
        store.toggleTheme();
        expect(store.theme).toBe("light");

        // OS switches to dark -> follows OS
        changeListener?.({ matches: true } as MediaQueryListEvent);
        expect(store.theme).toBe("dark");

        // OS switches to light -> follows OS
        changeListener?.({ matches: false } as MediaQueryListEvent);
        expect(store.theme).toBe("light");

        // User can still manually toggle
        store.toggleTheme();
        expect(store.theme).toBe("dark");
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });

  describe("isManagerMode", () => {
    beforeEach(async () => {
      await dockStore.init();
    });

    it("is false for toolbar mode", () => {
      expect(dockStore.isManagerMode).toBe(false);
    });

    it("is true for mockups mode", () => {
      dockStore.enterMockups();
      expect(dockStore.isManagerMode).toBe(true);
    });

    it("is true for grids mode", () => {
      dockStore.enterGrids();
      expect(dockStore.isManagerMode).toBe(true);
    });
  });
});
