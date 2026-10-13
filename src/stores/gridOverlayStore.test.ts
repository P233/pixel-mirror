/**
 * GridOverlayStore Tests (in-memory database)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRID_OVERLAY_SETTINGS } from "~/constants";

vi.mock("./database", () => import("./__fixtures__/memoryDatabase"));
vi.mock("./toastStore.svelte", () => ({ toastStore: { showError: vi.fn() } }));

type MemoryDatabase = typeof import("./__fixtures__/memoryDatabase");

describe("gridOverlayStore", () => {
  let gridOverlayStore: typeof import("./gridOverlayStore.svelte").gridOverlayStore;
  let flushSettings: typeof import("~/platform/settings.svelte").flushSettings;
  let db: MemoryDatabase;
  let toastStore: { showError: ReturnType<typeof vi.fn> };

  const grid = (overrides: Partial<GridInput> = {}): GridInput => ({
    width: "1140px",
    columns: 12,
    gutterWidth: "24px",
    isGutterOnOutside: true,
    position: "center",
    ...overrides
  });

  beforeEach(async () => {
    vi.resetModules();
    db = (await import("./database")) as unknown as MemoryDatabase;
    db.resetMemoryDatabase();
    toastStore = (await import("./toastStore.svelte")).toastStore as unknown as typeof toastStore;
    flushSettings = (await import("~/platform/settings.svelte")).flushSettings;
    gridOverlayStore = (await import("./gridOverlayStore.svelte")).gridOverlayStore;
  });

  afterEach(async () => {
    await flushSettings();
  });

  describe("init", () => {
    it("starts with the defaults and no active grid", async () => {
      await gridOverlayStore.init();

      expect(gridOverlayStore.initialized).toBe(true);
      expect(gridOverlayStore.showLayoutGrid).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid);
      expect(gridOverlayStore.spacingGridHeight).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.spacingGridHeight);
      expect(gridOverlayStore.activeLayoutGridId).toBe("");
      expect(gridOverlayStore.activeLayoutGrid).toBeUndefined();
    });

    it("loads stored settings and the active grid's config", async () => {
      const id = await db.addGrid(grid({ columns: 8 }));
      db.storeSettings("gridOverlay", {
        activeLayoutGridId: id,
        showLayoutGrid: true,
        layoutGridColor: "#00f",
        showSpacingGrid: true,
        spacingGridColor: "hsl(0 100% 50% / 0.1)",
        spacingGridHeight: "4px"
      });

      await gridOverlayStore.init();

      expect(gridOverlayStore.showLayoutGrid).toBe(true);
      expect(gridOverlayStore.layoutGridColor).toBe("#00f");
      expect(gridOverlayStore.spacingGridColor).toBe("hsl(0 100% 50% / 0.1)");
      expect(gridOverlayStore.spacingGridHeight).toBe("4px");
      expect(gridOverlayStore.activeLayoutGrid?.columns).toBe(8);
    });

    it("falls back to defaults for invalid stored values", async () => {
      db.storeSettings("gridOverlay", {
        showLayoutGrid: "yes",
        layoutGridColor: "banana",
        spacingGridHeight: "tall",
        showSpacingGrid: true
      });

      await gridOverlayStore.init();

      expect(gridOverlayStore.showLayoutGrid).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid);
      expect(gridOverlayStore.layoutGridColor).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.layoutGridColor);
      expect(gridOverlayStore.spacingGridHeight).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.spacingGridHeight);
      expect(gridOverlayStore.showSpacingGrid).toBe(true);
    });

    it("reports a missing active grid", async () => {
      db.storeSettings("gridOverlay", { activeLayoutGridId: "gone" });

      await gridOverlayStore.init();

      expect(gridOverlayStore.activeLayoutGrid).toBeUndefined();
      expect(toastStore.showError).toHaveBeenCalled();
    });

    it("only initializes once", async () => {
      await Promise.all([gridOverlayStore.init(), gridOverlayStore.init()]);
      await gridOverlayStore.init();

      expect(db.getSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("settings", () => {
    beforeEach(async () => {
      await gridOverlayStore.init();
    });

    it("applies changes immediately and saves them as one snapshot", async () => {
      gridOverlayStore.toggleLayoutGrid();
      gridOverlayStore.toggleSpacingGrid();
      gridOverlayStore.setLayoutGridColor("#123456");
      gridOverlayStore.setSpacingGridColor("red");
      gridOverlayStore.setSpacingGridHeight("12px");

      expect(gridOverlayStore.showLayoutGrid).toBe(!DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid);
      expect(gridOverlayStore.spacingGridHeight).toBe("12px");

      await flushSettings();
      expect(db.saveSettings).toHaveBeenCalledTimes(1);
      expect(db.storedSettings("gridOverlay")).toEqual({
        activeLayoutGridId: "",
        showLayoutGrid: !DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid,
        layoutGridColor: "#123456",
        showSpacingGrid: !DEFAULT_GRID_OVERLAY_SETTINGS.showSpacingGrid,
        spacingGridColor: "red",
        spacingGridHeight: "12px"
      });
    });

    it("switches the active grid and loads its config", async () => {
      const id = await db.addGrid(grid({ columns: 4 }));

      await gridOverlayStore.setActiveLayoutGrid(id);

      expect(gridOverlayStore.activeLayoutGridId).toBe(id);
      expect(gridOverlayStore.activeLayoutGrid?.columns).toBe(4);
    });

    it("keeps the latest grid when an earlier load finishes last", async () => {
      const slow = await db.addGrid(grid({ columns: 2 }));
      const fast = await db.addGrid(grid({ columns: 6 }));
      let releaseSlow: () => void = () => {};
      db.getGrid.mockImplementationOnce(
        (id: string) =>
          new Promise((resolve) => {
            releaseSlow = () => resolve(id === slow ? { ...grid({ columns: 2 }), id, createdAt: 0 } : undefined);
          })
      );

      const slowLoad = gridOverlayStore.setActiveLayoutGrid(slow);
      await gridOverlayStore.setActiveLayoutGrid(fast);
      releaseSlow();
      await slowLoad;

      expect(gridOverlayStore.activeLayoutGrid?.columns).toBe(6);
    });

    it("resets to the defaults with a new active grid", async () => {
      const id = await db.addGrid(grid());
      gridOverlayStore.toggleLayoutGrid();
      gridOverlayStore.setSpacingGridHeight("20px");

      await gridOverlayStore.reset(id);

      expect(gridOverlayStore.showLayoutGrid).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid);
      expect(gridOverlayStore.spacingGridHeight).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.spacingGridHeight);
      expect(gridOverlayStore.activeLayoutGridId).toBe(id);
    });
  });
});
