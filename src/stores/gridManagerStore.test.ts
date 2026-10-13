/**
 * GridManagerStore Tests (real grid overlay store, in-memory database)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRID_OVERLAY_SETTINGS, DEFAULT_GRID_TEMPLATE } from "~/constants";

vi.mock("./database", () => import("./__fixtures__/memoryDatabase"));
vi.mock("./toastStore.svelte", () => ({ toastStore: { showError: vi.fn() } }));

type MemoryDatabase = typeof import("./__fixtures__/memoryDatabase");

describe("gridManagerStore", () => {
  let gridManagerStore: typeof import("./gridManagerStore.svelte").gridManagerStore;
  let gridOverlayStore: typeof import("./gridOverlayStore.svelte").gridOverlayStore;
  let flushSettings: typeof import("~/platform/settings.svelte").flushSettings;
  let db: MemoryDatabase;
  let toastStore: { showError: ReturnType<typeof vi.fn> };

  const grid = (overrides: Partial<GridInput> = {}): GridInput => ({ ...DEFAULT_GRID_TEMPLATE, ...overrides });

  beforeEach(async () => {
    vi.resetModules();
    db = (await import("./database")) as unknown as MemoryDatabase;
    db.resetMemoryDatabase();
    toastStore = (await import("./toastStore.svelte")).toastStore as unknown as typeof toastStore;
    flushSettings = (await import("~/platform/settings.svelte")).flushSettings;
    gridOverlayStore = (await import("./gridOverlayStore.svelte")).gridOverlayStore;
    gridManagerStore = (await import("./gridManagerStore.svelte")).gridManagerStore;
  });

  afterEach(async () => {
    await flushSettings();
  });

  describe("init", () => {
    it("creates and activates the default grid on first run", async () => {
      await gridManagerStore.init();

      expect(gridManagerStore.layoutGrids).toHaveLength(1);
      expect(gridManagerStore.layoutGrids[0]).toMatchObject(DEFAULT_GRID_TEMPLATE);
      expect(gridOverlayStore.activeLayoutGridId).toBe(gridManagerStore.layoutGrids[0].id);
      expect(gridOverlayStore.activeLayoutGrid).toMatchObject(DEFAULT_GRID_TEMPLATE);
    });

    it("keeps a stored active grid that still exists", async () => {
      await db.addGrid(grid());
      const second = await db.addGrid(grid({ columns: 6 }));
      db.storeSettings("gridOverlay", { activeLayoutGridId: second });

      await gridManagerStore.init();

      expect(gridOverlayStore.activeLayoutGridId).toBe(second);
    });

    it("activates the first grid when the stored one was deleted", async () => {
      const first = await db.addGrid(grid());
      db.storeSettings("gridOverlay", { activeLayoutGridId: "deleted" });

      await gridManagerStore.init();

      expect(gridOverlayStore.activeLayoutGridId).toBe(first);
    });

    it("lists grids oldest first", async () => {
      const a = await db.addGrid(grid({ columns: 2 }));
      const b = await db.addGrid(grid({ columns: 3 }));

      await gridManagerStore.init();

      expect(gridManagerStore.layoutGrids.map((g) => g.id)).toEqual([a, b]);
    });

    it("only initializes once, so concurrent inits create one default grid", async () => {
      await Promise.all([gridManagerStore.init(), gridManagerStore.init()]);
      await gridManagerStore.init();

      expect(db.addGrid).toHaveBeenCalledTimes(1);
      expect(gridManagerStore.layoutGrids).toHaveLength(1);
    });

    it("reports load failures and still finishes", async () => {
      db.getAllGrids.mockRejectedValueOnce(new Error("broken"));

      await gridManagerStore.init();

      expect(gridManagerStore.initialized).toBe(true);
      expect(toastStore.showError).toHaveBeenCalledWith(expect.any(Error), "Failed to load grids");
    });
  });

  describe("CRUD", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("adds a valid grid and makes it active", async () => {
      const id = await gridManagerStore.add(grid({ width: "960px", columns: 16 }));

      expect(id).toBeDefined();
      expect(gridManagerStore.layoutGrids).toHaveLength(2);
      expect(gridOverlayStore.activeLayoutGridId).toBe(id);
      expect(gridOverlayStore.activeLayoutGrid?.columns).toBe(16);
    });

    it("rejects an invalid grid without saving it", async () => {
      const id = await gridManagerStore.add(grid({ width: "abc" }));

      expect(id).toBeUndefined();
      expect(gridManagerStore.layoutGrids).toHaveLength(1);
      expect(toastStore.showError).toHaveBeenCalled();
    });

    it("reports a failed add", async () => {
      db.addGrid.mockRejectedValueOnce(new Error("quota"));

      expect(await gridManagerStore.add(grid())).toBeUndefined();
      expect(toastStore.showError).toHaveBeenCalledWith(expect.any(Error), "Failed to add grid");
    });

    it("deletes an inactive grid and keeps the active one", async () => {
      const active = gridOverlayStore.activeLayoutGridId;
      const extra = await gridManagerStore.add(grid({ columns: 4 }));
      await gridManagerStore.setActiveLayoutGrid(active);

      await gridManagerStore.delete(extra!);

      expect(gridManagerStore.layoutGrids.map((g) => g.id)).toEqual([active]);
      expect(gridOverlayStore.activeLayoutGridId).toBe(active);
    });

    it("activates the next grid when the active one is deleted", async () => {
      const first = gridOverlayStore.activeLayoutGridId;
      const second = await gridManagerStore.add(grid({ columns: 4 }));

      await gridManagerStore.delete(second!);

      expect(gridOverlayStore.activeLayoutGridId).toBe(first);
    });

    it("recreates the default grid when the last one is deleted", async () => {
      await gridManagerStore.delete(gridOverlayStore.activeLayoutGridId);

      expect(gridManagerStore.layoutGrids).toHaveLength(1);
      expect(gridManagerStore.layoutGrids[0]).toMatchObject(DEFAULT_GRID_TEMPLATE);
      expect(gridOverlayStore.activeLayoutGridId).toBe(gridManagerStore.layoutGrids[0].id);
    });

    it("reports a failed delete and keeps the grid", async () => {
      db.deleteGrid.mockRejectedValueOnce(new Error("locked"));

      await gridManagerStore.delete(gridOverlayStore.activeLayoutGridId);

      expect(gridManagerStore.layoutGrids).toHaveLength(1);
      expect(toastStore.showError).toHaveBeenCalledWith(expect.any(Error), "Failed to delete grid");
    });

    it("resets grids and overlay settings", async () => {
      await gridManagerStore.add(grid({ columns: 4 }));
      gridManagerStore.toggleLayoutGrid();
      gridManagerStore.updateSpacingGridHeight("20px");

      await gridManagerStore.reset();

      expect(gridManagerStore.layoutGrids).toHaveLength(1);
      expect(gridManagerStore.layoutGrids[0]).toMatchObject(DEFAULT_GRID_TEMPLATE);
      expect(gridOverlayStore.activeLayoutGridId).toBe(gridManagerStore.layoutGrids[0].id);
      expect(gridOverlayStore.showLayoutGrid).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid);
      expect(gridOverlayStore.spacingGridHeight).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.spacingGridHeight);
    });
  });

  describe("overlay settings from the manager", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("toggles the grids", () => {
      gridManagerStore.toggleLayoutGrid();
      gridManagerStore.toggleSpacingGrid();

      expect(gridOverlayStore.showLayoutGrid).toBe(!DEFAULT_GRID_OVERLAY_SETTINGS.showLayoutGrid);
      expect(gridOverlayStore.showSpacingGrid).toBe(!DEFAULT_GRID_OVERLAY_SETTINGS.showSpacingGrid);
    });

    it.each([
      ["1rem", "1rem"],
      ["12", "12px"],
      [" 8px ", "8px"]
    ])("sets the spacing grid height %j as %j", (input, expected) => {
      gridManagerStore.updateSpacingGridHeight(input);

      expect(gridOverlayStore.spacingGridHeight).toBe(expected);
    });

    it("sets valid colors, including any CSS color syntax", () => {
      gridManagerStore.updateSpacingGridColor("hsl(0 100% 50% / 0.1)");
      gridManagerStore.updateLayoutGridColor("rebeccapurple");

      expect(gridOverlayStore.spacingGridColor).toBe("hsl(0 100% 50% / 0.1)");
      expect(gridOverlayStore.layoutGridColor).toBe("rebeccapurple");
    });

    it.each([
      ["updateSpacingGridHeight", "spacingGridHeight", "banana"],
      ["updateSpacingGridColor", "spacingGridColor", "banana"],
      ["updateLayoutGridColor", "layoutGridColor", "not-a-color"]
    ] as const)("%s rejects %j without changing it", (method, field, value) => {
      const before = gridOverlayStore[field];

      gridManagerStore[method](value);

      expect(gridOverlayStore[field]).toBe(before);
      expect(toastStore.showError).toHaveBeenCalled();
    });

    it("persists the changes", async () => {
      gridManagerStore.toggleSpacingGrid();
      gridManagerStore.updateSpacingGridColor("#f00");

      await flushSettings();

      expect(db.storedSettings("gridOverlay")).toMatchObject({
        showSpacingGrid: !DEFAULT_GRID_OVERLAY_SETTINGS.showSpacingGrid,
        spacingGridColor: "#f00"
      });
    });

    it("reports a failed save", async () => {
      db.saveSettings.mockRejectedValueOnce(new Error("quota"));

      gridManagerStore.toggleLayoutGrid();
      await flushSettings();

      expect(toastStore.showError).toHaveBeenCalledWith(expect.any(Error), "Failed to save settings");
    });
  });
});
