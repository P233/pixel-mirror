import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/stores/database", () => import("~/stores/__fixtures__/memoryDatabase"));
vi.mock("~/stores/toastStore.svelte", () => ({ toastStore: { showError: vi.fn() } }));

type MemoryDatabase = typeof import("~/stores/__fixtures__/memoryDatabase");

describe("createSettings", () => {
  let settingsModule: typeof import("./settings.svelte");
  let db: MemoryDatabase;
  let toastStore: { showError: ReturnType<typeof vi.fn> };

  const DEFAULTS: DockSettings = { position: "bottom", theme: "light" };
  const createDock = () =>
    settingsModule.createSettings("dock", DEFAULTS, {
      position: (value) => value === "top" || value === "bottom",
      theme: (value) => value === "light" || value === "dark"
    });

  beforeEach(async () => {
    vi.resetModules();
    db = (await import("~/stores/database")) as unknown as MemoryDatabase;
    db.resetMemoryDatabase();
    toastStore = (await import("~/stores/toastStore.svelte")).toastStore as unknown as typeof toastStore;
    settingsModule = await import("./settings.svelte");
  });

  afterEach(async () => {
    await settingsModule.flushSettings();
  });

  it("starts with the defaults", () => {
    expect(createDock().current).toEqual(DEFAULTS);
  });

  it("loads stored values, keeping defaults for missing and invalid fields", async () => {
    db.storeSettings("dock", { position: "top", theme: "purple", legacyField: 1 });
    const dock = createDock();

    await dock.load();

    expect(dock.current).toEqual({ position: "top", theme: "light" });
  });

  it.each([null, "corrupt", 42])("ignores a stored value that isn't an object (%j)", async (stored) => {
    db.storeSettings("dock", stored);
    const dock = createDock();

    await dock.load();

    expect(dock.current).toEqual(DEFAULTS);
  });

  it("saves changes made together as one snapshot as soon as the task ends", async () => {
    const dock = createDock();

    dock.update({ theme: "dark" });
    dock.update({ position: "top" });
    expect(dock.current).toEqual({ position: "top", theme: "dark" });
    expect(db.saveSettings).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(db.saveSettings).toHaveBeenCalledTimes(1);
    expect(db.saveSettings).toHaveBeenLastCalledWith("dock", { position: "top", theme: "dark" });
  });

  it("saves each later change right away, so a reload can't lose it", async () => {
    const dock = createDock();

    dock.update({ theme: "dark" });
    await Promise.resolve();
    dock.update({ position: "top" });
    await Promise.resolve();

    expect(db.saveSettings).toHaveBeenCalledTimes(2);
    expect(db.storedSettings("dock")).toEqual({ position: "top", theme: "dark" });
  });

  it("saves plain data, not reactive proxies (IndexedDB can't clone proxies)", async () => {
    const dock = createDock();
    dock.update({ theme: "dark" });

    await settingsModule.flushSettings();

    const [, saved] = db.saveSettings.mock.calls[0];
    expect(structuredClone(saved)).toEqual({ position: "bottom", theme: "dark" });
  });

  it("flushes pending saves of every group at once", async () => {
    const dock = createDock();
    const overlay = settingsModule.createSettings(
      "gridOverlay",
      { activeLayoutGridId: "" } as GridOverlaySettings,
      {
        activeLayoutGridId: () => true
      } as never
    );
    dock.update({ theme: "dark" });
    overlay.update({ activeLayoutGridId: "g1" });

    await settingsModule.flushSettings();

    expect(db.storedSettings("dock")).toMatchObject({ theme: "dark" });
    expect(db.storedSettings("gridOverlay")).toMatchObject({ activeLayoutGridId: "g1" });
  });

  it("resets to the defaults and saves them", async () => {
    const dock = createDock();
    dock.update({ theme: "dark", position: "top" });

    dock.reset();
    await settingsModule.flushSettings();

    expect(dock.current).toEqual(DEFAULTS);
    expect(db.storedSettings("dock")).toEqual(DEFAULTS);
  });

  it("reports a failed save", async () => {
    db.saveSettings.mockRejectedValueOnce(new Error("quota"));
    const dock = createDock();

    dock.update({ theme: "dark" });
    await settingsModule.flushSettings();

    expect(toastStore.showError).toHaveBeenCalledWith(expect.any(Error), "Failed to save settings");
    expect(dock.current.theme).toBe("dark");
  });
});

describe("pickValid", () => {
  it("keeps only fields that pass their check", async () => {
    const { pickValid } = await import("./settings.svelte");

    expect(
      pickValid<{ a: number; b: string; c: boolean }>(
        { a: 1, b: 2, c: undefined, d: "extra" },
        { a: (v) => typeof v === "number", b: (v) => typeof v === "string", c: (v) => typeof v === "boolean" }
      )
    ).toEqual({ a: 1 });
  });
});
