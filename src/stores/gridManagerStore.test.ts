/**
 * GridManagerStore Tests
 *
 * Tests for layout grid CRUD operations and settings management.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock database
vi.mock("./database", () => ({
  getAllGrids: vi.fn().mockResolvedValue([]),
  getSettingsByGroup: vi.fn().mockResolvedValue({}),
  addGrid: vi.fn().mockResolvedValue("mock-grid-id"),
  deleteGrid: vi.fn().mockResolvedValue(undefined),
  updateSetting: vi.fn().mockResolvedValue(undefined),
  resetGrids: vi.fn().mockResolvedValue(undefined),
  resetGridOverlaySettings: vi.fn().mockResolvedValue(undefined)
}));

// Mock gridOverlayStore
vi.mock("./gridOverlayStore.svelte", () => ({
  gridOverlayStore: {
    showSpacingGrid: false,
    showLayoutGrid: false,
    activeLayoutGridId: null,
    syncSettings: vi.fn()
  }
}));

// Mock toastStore
vi.mock("./toastStore.svelte", () => ({
  toastStore: {
    showError: vi.fn()
  }
}));

// Mock validation
vi.mock("~/utils/validation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/utils/validation")>()),
  validateLayoutGridConfig: vi.fn().mockReturnValue({ success: true, data: {} })
}));

describe("gridManagerStore", () => {
  let gridManagerStore: typeof import("./gridManagerStore.svelte").gridManagerStore;
  let getAllGrids: ReturnType<typeof vi.fn>;
  let getSettingsByGroup: ReturnType<typeof vi.fn>;
  let addGrid: ReturnType<typeof vi.fn>;
  let deleteGrid: ReturnType<typeof vi.fn>;
  let updateSetting: ReturnType<typeof vi.fn>;
  let resetGrids: ReturnType<typeof vi.fn>;
  let resetGridOverlaySettings: ReturnType<typeof vi.fn>;
  let toastStore: { showError: ReturnType<typeof vi.fn> };
  let gridOverlayStore: {
    showSpacingGrid: boolean;
    showLayoutGrid: boolean;
    activeLayoutGridId: string | null;
    syncSettings: ReturnType<typeof vi.fn>;
  };
  let validateLayoutGridConfig: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Get fresh mocks
    const dbModule = await import("./database");
    const toastModule = await import("./toastStore.svelte");
    const gridOverlayModule = await import("./gridOverlayStore.svelte");
    const validationModule = await import("~/utils/validation");

    getAllGrids = dbModule.getAllGrids as ReturnType<typeof vi.fn>;
    getSettingsByGroup = dbModule.getSettingsByGroup as ReturnType<typeof vi.fn>;
    addGrid = dbModule.addGrid as ReturnType<typeof vi.fn>;
    deleteGrid = dbModule.deleteGrid as ReturnType<typeof vi.fn>;
    updateSetting = dbModule.updateSetting as ReturnType<typeof vi.fn>;
    resetGrids = dbModule.resetGrids as ReturnType<typeof vi.fn>;
    resetGridOverlaySettings = dbModule.resetGridOverlaySettings as ReturnType<typeof vi.fn>;
    toastStore = toastModule.toastStore as unknown as { showError: ReturnType<typeof vi.fn> };
    gridOverlayStore = gridOverlayModule.gridOverlayStore as unknown as typeof gridOverlayStore;
    validateLayoutGridConfig = validationModule.validateLayoutGridConfig as ReturnType<typeof vi.fn>;

    // Reset mocks
    getAllGrids.mockReset().mockResolvedValue([]);
    getSettingsByGroup.mockReset().mockResolvedValue({});
    addGrid.mockReset().mockResolvedValue("mock-grid-id");
    deleteGrid.mockReset().mockResolvedValue(undefined);
    updateSetting.mockReset().mockResolvedValue(undefined);
    resetGrids.mockReset().mockResolvedValue(undefined);
    resetGridOverlaySettings.mockReset().mockResolvedValue(undefined);
    toastStore.showError.mockReset();
    gridOverlayStore.syncSettings.mockReset();
    gridOverlayStore.showSpacingGrid = false;
    gridOverlayStore.showLayoutGrid = false;
    gridOverlayStore.activeLayoutGridId = null;
    validateLayoutGridConfig.mockReset().mockReturnValue({ success: true, data: {} });

    // Import fresh store
    const module = await import("./gridManagerStore.svelte");
    gridManagerStore = module.gridManagerStore;
  });

  describe("initial state", () => {
    it("starts uninitialized", () => {
      expect(gridManagerStore.initialized).toBe(false);
    });

    it("has empty layoutGrids before init", () => {
      expect(gridManagerStore.layoutGrids).toEqual([]);
    });
  });

  describe("init", () => {
    it("creates default grid when no grids exist", async () => {
      getAllGrids.mockResolvedValue([]);

      await gridManagerStore.init();

      expect(gridManagerStore.initialized).toBe(true);
      expect(addGrid).toHaveBeenCalled();
      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "mock-grid-id");
    });

    it("loads existing grids from database", async () => {
      const mockGrids = [
        { id: "grid-1", name: "Grid 1", createdAt: Date.now() },
        { id: "grid-2", name: "Grid 2", createdAt: Date.now() }
      ];
      getAllGrids.mockResolvedValue(mockGrids);
      getSettingsByGroup.mockResolvedValue({ activeLayoutGridId: "grid-1" });

      await gridManagerStore.init();

      expect(gridManagerStore.layoutGrids).toEqual(mockGrids);
      expect(addGrid).not.toHaveBeenCalled();
    });

    it("sets first grid as active if current active grid does not exist", async () => {
      const mockGrids = [{ id: "grid-1", name: "Grid 1", createdAt: Date.now() }];
      getAllGrids.mockResolvedValue(mockGrids);
      getSettingsByGroup.mockResolvedValue({ activeLayoutGridId: "non-existent" });

      await gridManagerStore.init();

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "grid-1");
    });

    it("sets first grid as active if no active grid in settings", async () => {
      const mockGrids = [{ id: "grid-1", name: "Grid 1", createdAt: Date.now() }];
      getAllGrids.mockResolvedValue(mockGrids);
      getSettingsByGroup.mockResolvedValue({});

      await gridManagerStore.init();

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "grid-1");
    });

    it("only initializes once", async () => {
      await gridManagerStore.init();
      await gridManagerStore.init();

      expect(getAllGrids).toHaveBeenCalledTimes(1);
    });

    it("handles database errors gracefully", async () => {
      const error = new Error("Database error");
      getAllGrids.mockRejectedValue(error);

      await gridManagerStore.init();

      expect(gridManagerStore.initialized).toBe(true);
      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to load grids");
    });
  });

  describe("toggleSpacingGrid", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("toggles showSpacingGrid from false to true", () => {
      gridOverlayStore.showSpacingGrid = false;

      gridManagerStore.toggleSpacingGrid();

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "showSpacingGrid", true);
    });

    it("toggles showSpacingGrid from true to false", () => {
      gridOverlayStore.showSpacingGrid = true;

      gridManagerStore.toggleSpacingGrid();

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "showSpacingGrid", false);
    });
  });

  describe("updateSpacingGridHeight", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("updates spacing grid height", () => {
      gridManagerStore.updateSpacingGridHeight("1rem");

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "spacingGridHeight", "1rem");
    });

    it("appends px to a bare number", () => {
      gridManagerStore.updateSpacingGridHeight("12");

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "spacingGridHeight", "12px");
    });

    it("rejects an invalid height without saving it", () => {
      gridManagerStore.updateSpacingGridHeight("banana");

      expect(updateSetting).not.toHaveBeenCalledWith("gridOverlay", "spacingGridHeight", expect.anything());
      expect(toastStore.showError).toHaveBeenCalled();
    });
  });

  describe("updateSpacingGridColor", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("updates spacing grid color", () => {
      gridManagerStore.updateSpacingGridColor("#ff0000");

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "spacingGridColor", "#ff0000");
    });

    it("rejects an invalid color without saving it", () => {
      gridManagerStore.updateSpacingGridColor("banana");

      expect(updateSetting).not.toHaveBeenCalledWith("gridOverlay", "spacingGridColor", expect.anything());
      expect(toastStore.showError).toHaveBeenCalled();
    });
  });

  describe("toggleLayoutGrid", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("toggles showLayoutGrid from false to true", () => {
      gridOverlayStore.showLayoutGrid = false;

      gridManagerStore.toggleLayoutGrid();

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "showLayoutGrid", true);
    });

    it("toggles showLayoutGrid from true to false", () => {
      gridOverlayStore.showLayoutGrid = true;

      gridManagerStore.toggleLayoutGrid();

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "showLayoutGrid", false);
    });
  });

  describe("updateLayoutGridColor", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("updates layout grid color", () => {
      gridManagerStore.updateLayoutGridColor("#00ff00");

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "layoutGridColor", "#00ff00");
    });

    it("rejects an invalid color without saving it", () => {
      gridManagerStore.updateLayoutGridColor("not-a-color");

      expect(updateSetting).not.toHaveBeenCalledWith("gridOverlay", "layoutGridColor", expect.anything());
      expect(toastStore.showError).toHaveBeenCalled();
    });
  });

  describe("setActiveLayoutGrid", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("sets active layout grid", async () => {
      await gridManagerStore.setActiveLayoutGrid("grid-2");

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "grid-2");
    });

    it("handles errors and shows toast", async () => {
      const error = new Error("Update failed");
      updateSetting.mockRejectedValue(error);

      await expect(gridManagerStore.setActiveLayoutGrid("grid-2")).resolves.toBeUndefined();
      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to set active grid");
    });
  });

  describe("add", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
      // Clear mocks after init to avoid counting calls made during init
      addGrid.mockClear();
      updateSetting.mockClear();
      toastStore.showError.mockClear();
    });

    it("adds a new grid with valid config", async () => {
      const gridConfig = { name: "New Grid", columns: 12 };
      validateLayoutGridConfig.mockReturnValue({ success: true, data: gridConfig });
      addGrid.mockResolvedValue("new-grid-id");
      getAllGrids.mockResolvedValue([{ id: "new-grid-id", ...gridConfig, createdAt: Date.now() }]);

      const id = await gridManagerStore.add(gridConfig as never);

      expect(id).toBe("new-grid-id");
      expect(addGrid).toHaveBeenCalledWith(gridConfig);
      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "new-grid-id");
    });

    it("returns undefined for invalid config", async () => {
      validateLayoutGridConfig.mockReturnValue({ success: false, error: "Invalid config" });

      const id = await gridManagerStore.add({} as never);

      expect(id).toBeUndefined();
      expect(toastStore.showError).toHaveBeenCalledWith("Invalid config");
      expect(addGrid).not.toHaveBeenCalled();
    });

    it("handles database errors", async () => {
      validateLayoutGridConfig.mockReturnValue({ success: true, data: {} });
      addGrid.mockRejectedValue(new Error("Add failed"));

      const id = await gridManagerStore.add({} as never);

      expect(id).toBeUndefined();
      expect(toastStore.showError).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      const mockGrids = [
        { id: "grid-1", name: "Grid 1", createdAt: Date.now() },
        { id: "grid-2", name: "Grid 2", createdAt: Date.now() }
      ];
      getAllGrids.mockResolvedValue(mockGrids);
      await gridManagerStore.init();
    });

    it("deletes a grid", async () => {
      await gridManagerStore.delete("grid-2");

      expect(deleteGrid).toHaveBeenCalledWith("grid-2");
      expect(gridManagerStore.layoutGrids.find((g) => g.id === "grid-2")).toBeUndefined();
    });

    it("sets next grid as active when deleting active grid", async () => {
      gridOverlayStore.activeLayoutGridId = "grid-1";

      await gridManagerStore.delete("grid-1");

      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "grid-2");
    });

    it("creates default grid when deleting last grid", async () => {
      // Setup single grid
      vi.resetModules();
      const dbModule = await import("./database");
      const toastModule = await import("./toastStore.svelte");
      const gridOverlayModule = await import("./gridOverlayStore.svelte");

      getAllGrids = dbModule.getAllGrids as ReturnType<typeof vi.fn>;
      addGrid = dbModule.addGrid as ReturnType<typeof vi.fn>;
      deleteGrid = dbModule.deleteGrid as ReturnType<typeof vi.fn>;
      updateSetting = dbModule.updateSetting as ReturnType<typeof vi.fn>;
      toastStore = toastModule.toastStore as unknown as { showError: ReturnType<typeof vi.fn> };
      gridOverlayStore = gridOverlayModule.gridOverlayStore as unknown as typeof gridOverlayStore;

      getAllGrids.mockReset().mockResolvedValue([{ id: "only-grid", name: "Only Grid", createdAt: Date.now() }]);
      addGrid.mockReset().mockResolvedValue("new-default-id");
      deleteGrid.mockReset().mockResolvedValue(undefined);
      updateSetting.mockReset().mockResolvedValue(undefined);

      const module = await import("./gridManagerStore.svelte");
      const store = module.gridManagerStore;

      await store.init();
      gridOverlayStore.activeLayoutGridId = "only-grid";

      // After delete, getAllGrids returns new default grid
      getAllGrids.mockResolvedValue([{ id: "new-default-id", name: "Default", createdAt: Date.now() }]);

      await store.delete("only-grid");

      expect(addGrid).toHaveBeenCalled();
      expect(updateSetting).toHaveBeenCalledWith("gridOverlay", "activeLayoutGridId", "new-default-id");
    });

    it("handles delete errors", async () => {
      deleteGrid.mockRejectedValue(new Error("Delete failed"));

      await gridManagerStore.delete("grid-1");

      expect(toastStore.showError).toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("resets all grids and settings to defaults", async () => {
      await gridManagerStore.reset();

      expect(resetGrids).toHaveBeenCalled();
      expect(resetGridOverlaySettings).toHaveBeenCalled();
      expect(addGrid).toHaveBeenCalled();
      expect(gridOverlayStore.syncSettings).toHaveBeenCalled();
    });

    it("handles reset errors", async () => {
      resetGrids.mockRejectedValue(new Error("Reset failed"));

      await gridManagerStore.reset();

      expect(toastStore.showError).toHaveBeenCalled();
    });
  });

  describe("settings error handling", () => {
    beforeEach(async () => {
      await gridManagerStore.init();
    });

    it("shows toast on updateSpacingGridHeight error", async () => {
      updateSetting.mockRejectedValue(new Error("Update failed"));

      gridManagerStore.updateSpacingGridHeight("12");

      await vi.waitFor(() => {
        expect(toastStore.showError).toHaveBeenCalled();
      });
    });

    it("shows toast on updateSpacingGridColor error", async () => {
      updateSetting.mockRejectedValue(new Error("Update failed"));

      gridManagerStore.updateSpacingGridColor("#ff0000");

      await vi.waitFor(() => {
        expect(toastStore.showError).toHaveBeenCalled();
      });
    });

    it("shows toast on toggleSpacingGrid error", async () => {
      updateSetting.mockRejectedValue(new Error("Update failed"));

      gridManagerStore.toggleSpacingGrid();

      await vi.waitFor(() => {
        expect(toastStore.showError).toHaveBeenCalled();
      });
    });

    it("shows toast on toggleLayoutGrid error", async () => {
      updateSetting.mockRejectedValue(new Error("Update failed"));

      gridManagerStore.toggleLayoutGrid();

      await vi.waitFor(() => {
        expect(toastStore.showError).toHaveBeenCalled();
      });
    });

    it("shows toast on updateLayoutGridColor error", async () => {
      updateSetting.mockRejectedValue(new Error("Update failed"));

      gridManagerStore.updateLayoutGridColor("#00ff00");

      await vi.waitFor(() => {
        expect(toastStore.showError).toHaveBeenCalled();
      });
    });
  });
});
