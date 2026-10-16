import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/platform/database", () => import("~/stores/__fixtures__/memoryDatabase"));
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
    db = (await import("~/platform/database")) as unknown as MemoryDatabase;
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

  it("saves changes made together as one field patch as soon as the task ends", async () => {
    const dock = createDock();

    dock.update({ theme: "dark" });
    dock.update({ position: "top" });
    expect(dock.current).toEqual({ position: "top", theme: "dark" });
    expect(db.updateSettings).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(db.updateSettings).toHaveBeenCalledTimes(1);
    expect(db.updateSettings).toHaveBeenLastCalledWith("dock", { position: "top", theme: "dark" });
  });

  it("saves each later change right away, so a reload can't lose it", async () => {
    const dock = createDock();

    dock.update({ theme: "dark" });
    await Promise.resolve();
    dock.update({ position: "top" });
    await settingsModule.flushSettings();

    expect(db.updateSettings).toHaveBeenCalledTimes(2);
    expect(db.storedSettings("dock")).toEqual({ position: "top", theme: "dark" });
  });

  it("saves plain data, not reactive proxies (IndexedDB can't clone proxies)", async () => {
    const dock = createDock();
    dock.update({ theme: "dark" });

    await settingsModule.flushSettings();

    const [, saved] = db.updateSettings.mock.calls[0];
    expect(structuredClone(saved)).toEqual({ theme: "dark" });
  });

  it("flushes pending saves of every group at once", async () => {
    const dock = createDock();
    const overlay = settingsModule.createSettings(
      "gridOverlay",
      { showLayoutGrid: false } as GridAppearanceSettings,
      {
        showLayoutGrid: () => true
      } as never
    );
    dock.update({ theme: "dark" });
    overlay.update({ showLayoutGrid: true });

    await settingsModule.flushSettings();

    expect(db.storedSettings("dock")).toMatchObject({ theme: "dark" });
    expect(db.storedSettings("gridOverlay")).toMatchObject({ showLayoutGrid: true });
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
    db.updateSettings.mockRejectedValueOnce(new Error("quota"));
    const dock = createDock();

    dock.update({ theme: "dark" });
    await settingsModule.flushSettings();

    expect(toastStore.showError).toHaveBeenCalledWith(expect.any(Error), "Failed to save settings");
    expect(dock.current.theme).toBe("dark");
  });

  it("retries unsaved fields on the next edit after a save failure", async () => {
    db.storeSettings("dock", DEFAULTS);
    const dock = createDock();
    await dock.load();
    db.updateSettings.mockRejectedValueOnce(new Error("quota"));

    dock.update({ theme: "dark" });
    await settingsModule.flushSettings();
    expect(db.storedSettings("dock")).toEqual(DEFAULTS);

    dock.update({ position: "top" });
    await settingsModule.flushSettings();
    expect(db.storedSettings("dock")).toEqual({ position: "top", theme: "dark" });
  });

  it("serializes writes and keeps the latest edit when the preceding write fails", async () => {
    let failFirstSave: (reason: Error) => void = () => {};
    db.updateSettings.mockImplementationOnce(() => new Promise((_resolve, reject) => (failFirstSave = reject)));
    const dock = createDock();
    dock.update({ theme: "dark" });
    const firstSave = settingsModule.flushSettings();

    dock.update({ theme: "light" });
    await Promise.resolve();
    expect(db.updateSettings).toHaveBeenCalledTimes(1);
    failFirstSave(new Error("temporary write failure"));
    await firstSave;

    dock.update({ position: "top" });
    await settingsModule.flushSettings();
    expect(db.storedSettings("dock")).toEqual({ position: "top", theme: "light" });
  });

  it("flushes an active save after its queued marker was consumed", async () => {
    let release!: () => void;
    db.updateSettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    const dock = createDock();
    dock.update({ theme: "dark" });
    await Promise.resolve();
    let isFlushed = false;
    const flushing = settingsModule.flushSettings().then(() => {
      isFlushed = true;
    });
    await Promise.resolve();
    expect(isFlushed).toBe(false);
    release();
    await flushing;
    expect(isFlushed).toBe(true);
  });

  it("waits for an active appearance write before a resource commit and flush includes both", async () => {
    let releaseSave!: () => void;
    db.updateSettings.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseSave = resolve;
        })
    );
    const dock = createDock();
    dock.update({ theme: "dark" });
    await Promise.resolve();
    let releaseCommit!: () => void;
    const write = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        releaseCommit = resolve;
      });
      return { appearance: DEFAULTS, result: "committed" };
    });
    const publish = vi.fn();
    const committing = dock.commit(["theme", "position"], write, publish);
    expect(write).not.toHaveBeenCalled();
    releaseSave();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    let isFlushed = false;
    const flushing = settingsModule.flushSettings().then(() => {
      isFlushed = true;
    });
    await Promise.resolve();
    expect(isFlushed).toBe(false);
    expect(publish).not.toHaveBeenCalled();
    releaseCommit();
    await Promise.all([committing, flushing]);
    expect(publish).toHaveBeenCalledWith("committed");
    expect(dock.current).toEqual(DEFAULTS);
  });

  it("retires failed covered edits on commit but preserves edits made during the commit", async () => {
    const dock = createDock();
    db.updateSettings.mockRejectedValueOnce(new Error("quota"));
    dock.update({ theme: "dark" });
    await settingsModule.flushSettings();
    let release!: () => void;
    const committing = dock.commit(
      ["theme", "position"],
      async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { appearance: DEFAULTS, result: undefined };
      },
      () => {}
    );
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    dock.update({ position: "top" });
    release();
    await committing;
    await settingsModule.flushSettings();
    dock.update({ position: "bottom" });
    await settingsModule.flushSettings();
    expect(dock.current.theme).toBe("light");
    expect(db.storedSettings("dock")).not.toMatchObject({ theme: "dark" });
  });

  it("does not publish or discard failed appearance edits when a resource commit fails", async () => {
    const dock = createDock();
    db.updateSettings.mockRejectedValueOnce(new Error("quota"));
    dock.update({ theme: "dark" });
    await settingsModule.flushSettings();
    const publish = vi.fn();
    await expect(
      dock.commit(
        ["theme"],
        async () => {
          throw new Error("commit failure");
        },
        publish
      )
    ).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
    expect(dock.current.theme).toBe("dark");
    dock.update({ position: "top" });
    await settingsModule.flushSettings();
    expect(db.storedSettings("dock")).toEqual({ position: "top", theme: "dark" });
  });

  it("preserves unread settings when the initial load fails", async () => {
    db.storeSettings("dock", { position: "top", theme: "dark" });
    db.getSettings.mockRejectedValueOnce(new Error("temporary read failure"));
    const dock = createDock();
    await expect(dock.load()).rejects.toThrow("temporary read failure");

    dock.update({ theme: "light" });
    await settingsModule.flushSettings();

    expect(db.storedSettings("dock")).toEqual({ position: "top", theme: "light" });
    await dock.load();
    expect(dock.current).toEqual({ position: "top", theme: "light" });
  });

  it("keeps edits made while stored settings are loading", async () => {
    let finishLoad: (stored: unknown) => void = () => {};
    db.getSettings.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)));
    const dock = createDock();
    const loading = dock.load();

    dock.update({ theme: "light" });
    await settingsModule.flushSettings();
    finishLoad({ position: "top", theme: "dark" });
    await loading;

    expect(dock.current).toEqual({ position: "top", theme: "light" });
  });

  it("keeps in-flight edits when a retry reads old settings after the write fails", async () => {
    db.storeSettings("dock", { position: "top", theme: "light" });
    const dock = createDock();
    let failSave: (error: Error) => void = () => {};
    db.updateSettings.mockImplementationOnce(() => new Promise((_resolve, reject) => (failSave = reject)));
    dock.update({ theme: "dark" });
    const saving = settingsModule.flushSettings();

    let finishLoad: (stored: unknown) => void = () => {};
    db.getSettings.mockImplementationOnce(() => new Promise((resolve) => (finishLoad = resolve)));
    const loading = dock.load();
    failSave(new Error("temporary write failure"));
    await saving;
    finishLoad({ position: "top", theme: "light" });
    await loading;

    expect(dock.current).toEqual({ position: "top", theme: "dark" });
    dock.update({ position: "bottom" });
    await settingsModule.flushSettings();
    expect(db.storedSettings("dock")).toEqual(dock.current);
  });

  it("releases in-flight fields after a successful write", async () => {
    const dock = createDock();
    dock.update({ theme: "dark" });
    await settingsModule.flushSettings();
    db.storeSettings("dock", { position: "top", theme: "light" });

    await dock.load();

    expect(dock.current).toEqual({ position: "top", theme: "light" });
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
