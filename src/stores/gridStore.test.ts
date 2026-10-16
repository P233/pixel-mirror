import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GRID_OVERLAY_SETTINGS, DEFAULT_GRID_TEMPLATE } from "~/constants";

vi.mock("./toastStore.svelte", () => ({ toastStore: { showError: vi.fn() } }));

describe("gridStore", () => {
  let gridStore: typeof import("./gridStore.svelte").gridStore;
  let db: typeof import("~/platform/database");
  let flushSettings: typeof import("~/platform/settings.svelte").flushSettings;
  let toast: typeof import("./toastStore.svelte").toastStore;

  beforeEach(async () => {
    vi.resetModules();
    globalThis.indexedDB = new IDBFactory();
    db = await import("~/platform/database");
    gridStore = (await import("./gridStore.svelte")).gridStore;
    flushSettings = (await import("~/platform/settings.svelte")).flushSettings;
    toast = (await import("./toastStore.svelte")).toastStore;
    vi.clearAllMocks();
  });
  afterEach(async () => {
    await flushSettings();
    vi.restoreAllMocks();
  });

  async function seedSettings(value: unknown) {
    await db.getSettings("dock");
    const raw = await openDB("PixelMirrorDB");
    await raw.put("settings", value, "gridOverlay");
    raw.close();
  }

  it("creates one default grid across concurrent initialization and derives its active config", async () => {
    await Promise.all([gridStore.init(), gridStore.init()]);
    await gridStore.init();
    expect(gridStore.layoutGrids).toHaveLength(1);
    expect(gridStore.activeLayoutGrid).toMatchObject(DEFAULT_GRID_TEMPLATE);
    expect(gridStore.activeLayoutGrid).toBe(gridStore.layoutGrids[0]);
    expect(await db.getSettings("gridOverlay")).toMatchObject({ activeLayoutGridId: gridStore.activeLayoutGridId });
  });

  it("loads the stored selection and falls back when that reference is missing", async () => {
    const a = await db.addGrid(DEFAULT_GRID_TEMPLATE);
    const b = await db.addGrid({ ...DEFAULT_GRID_TEMPLATE, columns: 6 });
    await gridStore.init();
    expect(gridStore.activeLayoutGridId).toBe(b.activeId);
    await db.deleteGrid(b.activeId);
    await gridStore.refresh();
    expect(gridStore.activeLayoutGridId).toBe(a.activeId);
    expect(gridStore.activeLayoutGrid?.id).toBe(a.activeId);
  });

  it("keeps committed library and settings unchanged when loading fails, then retries", async () => {
    const saved = await db.addGrid({ ...DEFAULT_GRID_TEMPLATE, columns: 6 });
    vi.spyOn(db, "readGridLibrary").mockRejectedValueOnce(new Error("read failure"));
    await gridStore.init();
    expect(gridStore.initialized).toBe(true);
    expect(gridStore.layoutGrids).toEqual([]);
    expect(await db.getSettings("gridOverlay")).toMatchObject({ activeLayoutGridId: saved.activeId });
    await gridStore.init();
    expect(gridStore.activeLayoutGrid?.columns).toBe(6);
  });

  it("publishes an added grid without a separate library read", async () => {
    await gridStore.init();
    const read = vi.spyOn(db, "readGridLibrary").mockRejectedValue(new Error("forbidden follow-up read"));
    const id = await gridStore.add({ ...DEFAULT_GRID_TEMPLATE, columns: 16 });
    expect(gridStore.activeLayoutGrid?.id).toBe(id);
    expect(gridStore.activeLayoutGrid?.columns).toBe(16);
    expect(gridStore.layoutGrids).toHaveLength(2);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["add", "setActiveLayoutGrid", "delete", "reset"] as const)(
    "keeps the local projection on a failed %s command",
    async (method) => {
      await gridStore.init();
      const before = gridStore.activeLayoutGrid;
      const command = {
        add: "addGrid",
        setActiveLayoutGrid: "selectGrid",
        delete: "deleteGrid",
        reset: "resetGrids"
      } as const;
      vi.spyOn(db, command[method]).mockRejectedValueOnce(new Error("quota"));
      if (method === "add") await gridStore.add(DEFAULT_GRID_TEMPLATE);
      else if (method === "reset") await gridStore.reset();
      else await gridStore[method](gridStore.activeLayoutGridId);
      expect(gridStore.activeLayoutGrid).toBe(before);
      expect(toast.showError).toHaveBeenCalled();
    }
  );

  it("rejects invalid input without writing", async () => {
    await gridStore.init();
    const add = vi.spyOn(db, "addGrid");
    expect(await gridStore.add({ ...DEFAULT_GRID_TEMPLATE, width: "banana" })).toBeUndefined();
    expect(add).not.toHaveBeenCalled();
  });

  it("deletes active and last grids with valid transactional fallbacks", async () => {
    await gridStore.init();
    const first = gridStore.activeLayoutGridId;
    const extra = await gridStore.add({ ...DEFAULT_GRID_TEMPLATE, columns: 4 });
    await gridStore.delete(extra!);
    expect(gridStore.activeLayoutGridId).toBe(first);
    await gridStore.delete(first);
    expect(gridStore.layoutGrids).toHaveLength(1);
    expect(gridStore.activeLayoutGridId).not.toBe(first);
    expect(gridStore.activeLayoutGrid).toMatchObject(DEFAULT_GRID_TEMPLATE);
  });

  it("orders Add then Reset and publishes defaults only after the reset commits", async () => {
    await gridStore.init();
    gridStore.toggleLayoutGrid();
    gridStore.updateSpacingGridHeight("12px");
    const original = db.addGrid;
    let release!: () => void;
    vi.spyOn(db, "addGrid").mockImplementationOnce(async (input) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return original(input);
    });
    const adding = gridStore.add({ ...DEFAULT_GRID_TEMPLATE, columns: 4 });
    const resetting = gridStore.reset();
    expect(gridStore.isResetting).toBe(true);
    expect(gridStore.spacingGridHeight).toBe("12px");
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await Promise.all([adding, resetting]);
    await flushSettings();
    expect(gridStore.isResetting).toBe(false);
    expect(gridStore.layoutGrids).toHaveLength(1);
    expect(gridStore.activeLayoutGrid).toMatchObject(DEFAULT_GRID_TEMPLATE);
    expect(gridStore.spacingGridHeight).toBe("8px");
    expect(await db.getSettings("gridOverlay")).toEqual({
      ...DEFAULT_GRID_OVERLAY_SETTINGS,
      activeLayoutGridId: gridStore.activeLayoutGridId
    });
  });

  it("keeps local appearance and a valid selection when another tab changes resources", async () => {
    await gridStore.init();
    const selected = gridStore.activeLayoutGridId;
    gridStore.updateSpacingGridHeight("12px");
    await flushSettings();
    await db.addGrid({ ...DEFAULT_GRID_TEMPLATE, columns: 4 });
    await db.updateSettings("gridOverlay", { spacingGridHeight: "16px" });
    await gridStore.refresh();
    expect(gridStore.layoutGrids).toHaveLength(2);
    expect(gridStore.activeLayoutGridId).toBe(selected);
    expect(gridStore.spacingGridHeight).toBe("12px");
  });

  it.each([
    [0.01, 0.99],
    [0.05, 0.95]
  ])("loads supported opacity bounds %s/%s", async (a, b) => {
    await seedSettings({ layoutGridColor: `rgba(0, 0, 255, ${a})`, spacingGridColor: `rgba(255, 0, 0, ${b})` });
    await gridStore.init();
    expect(gridStore.layoutGridColor).toBe(`rgba(0, 0, 255, ${a})`);
    expect(gridStore.spacingGridColor).toBe(`rgba(255, 0, 0, ${b})`);
  });

  it("validates stored fields and normalizes supported colors", async () => {
    await seedSettings({
      spacingGridHeight: "10%",
      showLayoutGrid: "yes",
      layoutGridColor: "#00f",
      spacingGridColor: "invalid"
    });
    await gridStore.init();
    expect(gridStore.spacingGridHeight).toBe("8px");
    expect(gridStore.showLayoutGrid).toBe(false);
    expect(gridStore.layoutGridColor).toBe("rgba(0, 0, 255, 0.99)");
    expect(gridStore.spacingGridColor).toBe(DEFAULT_GRID_OVERLAY_SETTINGS.spacingGridColor);
  });

  it.each([
    ["1rem", "1rem"],
    ["12", "12px"],
    [" 8px ", "8px"]
  ])("accepts height %s as %s", (input, expected) => {
    gridStore.updateSpacingGridHeight(input);
    expect(gridStore.spacingGridHeight).toBe(expected);
  });

  it.each(["10%", "1em", "1vw", "1vh", "banana"])("rejects height %s", (height) => {
    gridStore.updateSpacingGridHeight(height);
    expect(gridStore.spacingGridHeight).toBe("8px");
    expect(toast.showError).toHaveBeenCalled();
  });

  it.each(["updateSpacingGridColor", "updateLayoutGridColor"] as const)("validates and clamps %s", (method) => {
    gridStore[method]("hsl(0 100% 50% / 0.1)");
    const field = method === "updateSpacingGridColor" ? "spacingGridColor" : "layoutGridColor";
    expect(gridStore[field]).toBe("rgba(255, 0, 0, 0.1)");
    gridStore[method]("rgba(1, 2, 3, 1)");
    expect(gridStore[field]).toBe("rgba(1, 2, 3, 0.99)");
    gridStore[method]("rgba(1, 2, 3, 0)");
    expect(gridStore[field]).toBe("rgba(1, 2, 3, 0.01)");
    gridStore[method]("banana");
    expect(gridStore[field]).toBe("rgba(1, 2, 3, 0.01)");
  });

  it("toggles both grids and saves appearance without writing selections", async () => {
    await gridStore.init();
    const update = vi.spyOn(db, "updateSettings");
    gridStore.toggleLayoutGrid();
    gridStore.toggleSpacingGrid();
    await flushSettings();
    expect(update).toHaveBeenLastCalledWith("gridOverlay", { showLayoutGrid: true, showSpacingGrid: true });
  });
});
