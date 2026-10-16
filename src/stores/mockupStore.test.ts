import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "~/utils/errors";

vi.mock("./toastStore.svelte", () => ({ toastStore: { showError: vi.fn() } }));
vi.mock("~/utils/generate-mockup-buffers", () => ({ generateMockupBuffers: vi.fn() }));

const input = (filename: string): MockupInput => ({
  filename,
  mimeType: "image/png",
  image: new Blob(["image"], { type: "image/png" }),
  thumbnail: new Blob(["thumbnail"], { type: "image/png" })
});
const files = () => [new File(["image"], "a.png", { type: "image/png" })];

describe("mockupStore", () => {
  let store: typeof import("./mockupStore.svelte").mockupStore;
  let db: typeof import("~/platform/database");
  let decode: ReturnType<typeof vi.fn<typeof import("~/utils/generate-mockup-buffers").generateMockupBuffers>>;
  let flush: typeof import("~/platform/settings.svelte").flushSettings;
  let toast: typeof import("./toastStore.svelte").toastStore;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("Blob", NodeBlob);
    globalThis.indexedDB = new IDBFactory();
    db = await import("~/platform/database");
    store = (await import("./mockupStore.svelte")).mockupStore;
    decode = vi.mocked((await import("~/utils/generate-mockup-buffers")).generateMockupBuffers);
    decode.mockReset().mockResolvedValue({ data: [input("a.png")], errors: [] });
    flush = (await import("~/platform/settings.svelte")).flushSettings;
    toast = (await import("./toastStore.svelte")).toastStore;
    vi.clearAllMocks();
  });
  afterEach(async () => {
    await flush();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts empty and initializes one consistent resource/appearance snapshot", async () => {
    expect(store.initialized).toBe(false);
    const saved = await db.addMockups(input("saved.png"), true);
    await db.updateSettings("mockupOverlay", { opacity: 0.7 });
    await Promise.all([store.init(), store.init()]);
    expect(store.activeMockupId).toBe(saved.activeId);
    expect(store.activeMockup?.filename).toBe("saved.png");
    expect(store.appearance.opacity).toBe(0.7);
  });

  it("retries a failed initial read without rewriting stored selection", async () => {
    const saved = await db.addMockups(input("saved.png"), true);
    vi.spyOn(db, "readMockupLibrary").mockRejectedValueOnce(new Error("read failure"));
    await store.init();
    expect(store.initialized).toBe(true);
    expect(await db.getSettings("mockupOverlay")).toMatchObject({ activeMockupId: saved.activeId });
    await store.init();
    expect(store.activeMockupId).toBe(saved.activeId);
  });

  it("uploads to the library without activating", async () => {
    await store.init();
    await store.upload(files());
    expect(store.mockups).toHaveLength(1);
    expect(store.activeMockupId).toBeNull();
    expect(store.mockups[0]).not.toHaveProperty("image");
  });

  it("activates the first valid upload and atomically shows/unlocks it", async () => {
    await store.init();
    store.updateAppearance({ isHidden: true, isLocked: true });
    decode.mockResolvedValue({ data: [input("first.png"), input("second.png")], errors: [] });
    await store.uploadAndActivate(files());
    expect(store.activeMockup?.filename).toBe("first.png");
    expect(store.appearance).toMatchObject({ isHidden: false, isLocked: false });
    expect(await db.getSettings("mockupOverlay")).toMatchObject({
      activeMockupId: store.activeMockupId,
      isHidden: false,
      isLocked: false
    });
  });

  it("accepts valid files and reports all invalid files together", async () => {
    decode.mockResolvedValue({
      data: [input("valid.png")],
      errors: [new ValidationError("a.txt: unsupported"), new ValidationError("b.bmp: unsupported")]
    });
    await store.uploadAndActivate(files());
    expect(store.activeMockup?.filename).toBe("valid.png");
    const error = vi.mocked(toast.showError).mock.calls[0][0] as Error;
    expect(error.message).toContain("2 files could not be added");
    expect(error.message).toContain("a.txt");
    expect(error.message).toContain("b.bmp");
  });

  it("does not decode or write an empty batch, or write an all-invalid batch", async () => {
    await store.upload([]);
    await store.uploadAndActivate([]);
    expect(decode).not.toHaveBeenCalled();
    decode.mockResolvedValue({ data: [], errors: [new ValidationError("invalid")] });
    const add = vi.spyOn(db, "addMockups");
    await store.uploadAndActivate(files());
    expect(add).not.toHaveBeenCalled();
    expect(store.activeMockupId).toBeNull();
  });

  it("publishes a successful upload without a separate library read", async () => {
    await store.init();
    const read = vi.spyOn(db, "readMockupLibrary").mockRejectedValue(new Error("forbidden follow-up read"));
    await store.uploadAndActivate(files());
    expect(store.mockups).toHaveLength(1);
    expect(store.activeMockupId).toBe(store.mockups[0].id);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(["upload", "uploadAndActivate"] as const)(
    "keeps state when %s fails and continues the queue",
    async (method) => {
      await store.init();
      vi.spyOn(db, "addMockups").mockRejectedValueOnce(new Error("quota"));
      await store[method](files());
      expect(store.mockups).toEqual([]);
      expect(store.activeMockupId).toBeNull();
      await store[method](files());
      expect(store.mockups).toHaveLength(1);
    }
  );

  it("reserves upload ordering before decoding so a subsequent Clear wins", async () => {
    await store.init();
    let release!: (result: Awaited<ReturnType<typeof decode>>) => void;
    decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const uploading = store.uploadAndActivate(files());
    const clearing = store.clear();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release({ data: [input("slow.png")], errors: [] });
    await Promise.all([uploading, clearing]);
    expect(store.mockups).toEqual([]);
    expect(store.activeMockupId).toBeNull();
    expect((await db.readMockupLibrary()).items).toEqual([]);
    expect(await db.getSettings("mockupOverlay")).toMatchObject({ activeMockupId: null });
  });

  it("allows Grid commands to proceed while Mockup decoding is pending", async () => {
    const { gridStore } = await import("./gridStore.svelte");
    const { DEFAULT_GRID_TEMPLATE } = await import("~/constants");
    await Promise.all([store.init(), gridStore.init()]);
    let release!: (result: Awaited<ReturnType<typeof decode>>) => void;
    decode.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const uploading = store.upload(files());
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    const grid = await gridStore.add(DEFAULT_GRID_TEMPLATE);
    expect(gridStore.activeLayoutGridId).toBe(grid);
    expect(store.mockups).toEqual([]);
    release({ data: [input("slow.png")], errors: [] });
    await uploading;
  });

  it("publishes selection, metadata and activation appearance together", async () => {
    await store.init();
    store.updateAppearance({ isHidden: true, isLocked: true });
    const snapshots: unknown[] = [];
    const stop = store.subscribe((event) => {
      if (event === "commit")
        snapshots.push({
          exists: store.mockups.some((item) => item.id === store.activeMockupId),
          hidden: store.appearance.isHidden,
          locked: store.appearance.isLocked
        });
    });
    await store.uploadAndActivate(files());
    stop();
    expect(snapshots).toEqual([{ exists: true, hidden: false, locked: false }]);
  });

  it("selects, shows and unlocks only after commit; failed selection preserves state", async () => {
    await store.uploadAndActivate(files());
    const id = store.activeMockupId!;
    await store.select(null);
    store.updateAppearance({ isHidden: true, isLocked: true });
    vi.spyOn(db, "selectMockup").mockRejectedValueOnce(new Error("quota"));
    await store.select(id);
    expect(store.activeMockupId).toBeNull();
    expect(store.appearance.isHidden).toBe(true);
    await store.select(id);
    expect(store.activeMockupId).toBe(id);
    expect(store.appearance).toMatchObject({ isHidden: false, isLocked: false });
  });

  it("deletes inactive resources, then clears selection on deletion of the active mockup", async () => {
    await store.uploadAndActivate(files());
    const active = store.activeMockupId!;
    await store.upload(files());
    await store.delete(store.mockups.find((mockup) => mockup.id !== active)!.id);
    expect(store.activeMockupId).toBe(active);
    await store.delete(active);
    expect(store.mockups).toEqual([]);
    expect(store.activeMockupId).toBeNull();
    expect(await db.getMockupImage(active)).toBeUndefined();
  });

  it.each(["delete", "clear"] as const)("preserves the projection on a failed %s", async (method) => {
    await store.uploadAndActivate(files());
    const id = store.activeMockupId;
    vi.spyOn(db, method === "delete" ? "deleteMockup" : "resetMockups").mockRejectedValueOnce(new Error("quota"));
    if (method === "delete") await store.delete(id!);
    else await store.clear();
    expect(store.mockups).toHaveLength(1);
    expect(store.activeMockupId).toBe(id);
  });

  it("refreshes foreign changes without replacing a valid local selection or appearance", async () => {
    await store.init();
    await store.uploadAndActivate(files());
    const id = store.activeMockupId;
    store.updateAppearance({ opacity: 0.7 });
    await flush();
    await db.addMockups(input("remote.png"), true);
    await db.updateSettings("mockupOverlay", { opacity: 0.2 });
    await store.refresh();
    expect(store.mockups).toHaveLength(2);
    expect(store.activeMockupId).toBe(id);
    expect(store.appearance.opacity).toBe(0.7);
    await db.deleteMockup(id!);
    await store.refresh();
    expect(store.activeMockupId).toBeNull();
  });
});
