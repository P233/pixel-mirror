// @vitest-environment node
// Node's Blob survives IndexedDB's structured clone; jsdom's doesn't
/**
 * Database layer tests against a real (in-memory) IndexedDB implementation
 */

// Installs IDBRequest, IDBKeyRange etc. as globals; each test swaps in a fresh factory
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DB_NAME = "PixelMirrorDB";

const gridInput = (overrides: Partial<GridInput> = {}): GridInput => ({
  width: "1140px",
  columns: 12,
  gutterWidth: "24px",
  isGutterOnOutside: true,
  position: "center",
  ...overrides
});

const mockupInput = (name: string, content = name): MockupInput => ({
  image: new Blob([content], { type: "image/png" }),
  thumbnail: new Blob([`thumb-${content}`], { type: "image/png" }),
  filename: name,
  mimeType: "image/png",
  width: 800,
  height: 1500,
  fileSize: content.length
});

describe("database", () => {
  let database: typeof import("~/platform/database");

  beforeEach(async () => {
    // A fresh, empty IndexedDB and a fresh module (no cached connection) for every test
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    database = await import("~/platform/database");
  });

  describe("grids", () => {
    it("adds, lists (oldest first), gets and deletes grids", async () => {
      // Two adds within the same millisecond would tie on createdAt and list in random id order
      let clock = 1000;
      const now = vi.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
      const { activeId: a } = await database.addGrid(gridInput({ columns: 2 }));
      const { activeId: b } = await database.addGrid(gridInput({ columns: 3 }));
      now.mockRestore();

      expect((await database.readGridLibrary().then((library) => library.items)).map((g) => g.id)).toEqual([a, b]);
      expect((await database.readGridLibrary()).items.find((grid) => grid.id === b)).toMatchObject({
        id: b,
        columns: 3
      });

      await database.deleteGrid(a);
      expect((await database.readGridLibrary().then((library) => library.items)).map((g) => g.id)).toEqual([b]);

      await database.resetGrids();
      expect((await database.readGridLibrary()).items).toHaveLength(1);
    });
  });

  describe("mockups", () => {
    it("returns images as Blobs and lists metadata newest first", async () => {
      const {
        added: [{ id: first }, { id: second }]
      } = await database.addMockups([mockupInput("a.png"), mockupInput("b.png")]);

      const mockups = await database.readMockupLibrary().then((library) => library.items);
      expect(mockups.map((m) => m.id)).toEqual([second, first]);
      expect(mockups[0]).toMatchObject({ filename: "b.png", width: 800, height: 1500 });
      expect(mockups[0].thumbnail).toBeInstanceOf(Blob);
      expect(await mockups[0].thumbnail.text()).toBe("thumb-b.png");
      expect(mockups[0]).not.toHaveProperty("image");

      const image = await database.getMockupImage(first);
      expect(image).toBeInstanceOf(Blob);
      expect(await image!.text()).toBe("a.png");
    });

    it("stores bytes rather than Blobs, which Safari private windows reject", async () => {
      const {
        added: [{ id }]
      } = await database.addMockups(mockupInput("a.png"));

      const raw = await openDB(DB_NAME);
      const image = await raw.get("mockup_blobs", id);
      const record = await raw.get("mockups", id);
      raw.close();

      expect(image).not.toBeInstanceOf(Blob);
      expect(image).toEqual({ bytes: expect.any(ArrayBuffer), type: "image/png" });
      expect(record.thumbnail).toEqual({ bytes: expect.any(ArrayBuffer), type: "image/png" });
    });

    it("still reads Blobs written by unreleased version 3 builds", async () => {
      await database.readMockupLibrary().then((library) => library.items); // creates the version 3 database
      const raw = await openDB(DB_NAME);
      await raw.put("mockups", {
        id: "m1",
        filename: "a.png",
        mimeType: "image/png",
        createdAt: 1,
        thumbnail: new Blob(["thumb"], { type: "image/png" })
      });
      await raw.put("mockup_blobs", new Blob(["original"], { type: "image/png" }), "m1");
      raw.close();

      const [mockup] = await database.readMockupLibrary().then((library) => library.items);
      expect(await mockup.thumbnail.text()).toBe("thumb");
      expect(await (await database.getMockupImage("m1"))!.text()).toBe("original");
    });

    it("deletes a mockup together with its image", async () => {
      const {
        added: [{ id }]
      } = await database.addMockups(mockupInput("a.png"));

      await database.deleteMockup(id);

      expect(await database.readMockupLibrary().then((library) => library.items)).toEqual([]);
      expect(await database.getMockupImage(id)).toBeUndefined();
    });

    it("clears all mockups", async () => {
      await database.addMockups([mockupInput("a.png"), mockupInput("b.png")]);

      await database.resetMockups();

      expect(await database.readMockupLibrary().then((library) => library.items)).toEqual([]);
    });
  });

  describe("settings", () => {
    it("saves and loads a whole group", async () => {
      expect(await database.getSettings("dock")).toBeUndefined();

      await database.updateSettings("dock", { position: "top", theme: "dark" });

      expect(await database.getSettings("dock")).toEqual({ position: "top", theme: "dark" });
    });

    it("preserves saved fields when only one setting changes", async () => {
      await database.updateSettings("dock", { position: "top", theme: "dark" });

      await database.updateSettings("dock", { theme: "light" });

      expect(await database.getSettings("dock")).toEqual({ position: "top", theme: "light" });
    });

    it("merges concurrent changes in one read-write transaction per update", async () => {
      await Promise.all([
        database.updateSettings("dock", { position: "top" }),
        database.updateSettings("dock", { theme: "dark" })
      ]);

      expect(await database.getSettings("dock")).toEqual({ position: "top", theme: "dark" });
    });

    it.each([null, "corrupt", 42, []])("can update a malformed stored group (%j)", async (stored) => {
      await database.getSettings("dock");
      const raw = await openDB(DB_NAME);
      await raw.put("settings", stored, "dock");
      raw.close();

      await database.updateSettings("dock", { theme: "dark" });

      expect(await database.getSettings("dock")).toEqual({ theme: "dark" });
    });

    it("handles both the request and transaction rejection when an update read is aborted", async () => {
      await database.getSettings("dock");
      const originalGet = IDBObjectStore.prototype.get;
      const abortRead = vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(function (
        this: IDBObjectStore,
        key
      ) {
        const request = originalGet.call(this, key);
        this.transaction.abort();
        return request;
      });

      try {
        await expect(database.updateSettings("dock", { theme: "dark" })).rejects.toMatchObject({
          message: "Failed to save settings",
          cause: { name: "AbortError" }
        });
      } finally {
        abortRead.mockRestore();
      }

      expect(await database.getSettings("dock")).toBeUndefined();
    });
  });

  describe("business transaction invariants", () => {
    async function rawState() {
      const raw = await openDB(DB_NAME);
      const tx = raw.transaction(["grids", "mockups", "mockup_blobs", "settings"]);
      const state = await Promise.all([
        tx.objectStore("grids").getAll(),
        tx.objectStore("mockups").getAllKeys(),
        tx.objectStore("mockup_blobs").getAllKeys(),
        tx.objectStore("settings").getAll()
      ]);
      await tx.done;
      raw.close();
      return state;
    }

    function failSettingsPut() {
      const original = IDBObjectStore.prototype.put;
      return vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
        if (this.name === "settings") throw new DOMException("Injected settings failure", "UnknownError");
        return original.apply(this, args);
      });
    }

    it("creates one default and valid reference across competing initial reads", async () => {
      const [a, b] = await Promise.all([database.readGridLibrary(), database.readGridLibrary()]);
      expect(a.items).toHaveLength(1);
      expect(a.activeId).toBe(b.activeId);
      expect(await database.getSettings("gridOverlay")).toMatchObject({ activeLayoutGridId: a.activeId });
    });

    it.each(["add", "reset", "delete-last"] as const)(
      "rolls back all grid changes on %s settings failure",
      async (operation) => {
        const original = await database.addGrid(gridInput());
        await database.updateSettings("gridOverlay", { spacingGridHeight: "12px", showLayoutGrid: true });
        const before = await rawState();
        const fault = failSettingsPut();
        try {
          const command =
            operation === "add"
              ? database.addGrid(gridInput({ columns: 4 }))
              : operation === "reset"
                ? database.resetGrids()
                : database.deleteGrid(original.activeId);
          await expect(command).rejects.toThrow();
        } finally {
          fault.mockRestore();
        }
        expect(await rawState()).toEqual(before);
        expect((await database.readGridLibrary()).activeId).toBe(original.activeId);
      }
    );

    it("does not leave image records behind when upload activation fails", async () => {
      await database.readMockupLibrary();
      const before = await rawState();
      const fault = failSettingsPut();
      try {
        await expect(database.addMockups(mockupInput("new.png"), true)).rejects.toThrow();
      } finally {
        fault.mockRestore();
      }
      expect(await rawState()).toEqual(before);
    });

    it.each(["delete", "clear"] as const)(
      "rolls back metadata, images and selection on %s failure",
      async (operation) => {
        const { activeId } = await database.addMockups(mockupInput("saved.png"), true);
        const before = await rawState();
        const fault = failSettingsPut();
        try {
          await expect(
            operation === "delete" ? database.deleteMockup(activeId!) : database.resetMockups()
          ).rejects.toThrow();
        } finally {
          fault.mockRestore();
        }
        expect(await rawState()).toEqual(before);
        expect(await database.getMockupImage(activeId!)).toBeInstanceOf(Blob);
      }
    );

    it("waits for transaction completion after successful requests", async () => {
      const before = await database.addGrid(gridInput());
      const original = IDBObjectStore.prototype.put;
      const fault = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
        this: IDBObjectStore,
        ...args
      ) {
        const request = original.apply(this, args);
        if (this.name === "settings") request.addEventListener("success", () => this.transaction.abort());
        return request;
      });
      try {
        await expect(database.resetGrids()).rejects.toThrow();
      } finally {
        fault.mockRestore();
      }
      expect((await database.readGridLibrary()).activeId).toBe(before.activeId);
    });

    it("validates selection inside the same transaction as its write", async () => {
      const grid = await database.addGrid(gridInput());
      await expect(database.selectGrid("missing")).rejects.toThrow("Failed to select grid");
      expect(await database.getSettings("gridOverlay")).toMatchObject({ activeLayoutGridId: grid.activeId });
      await expect(database.selectMockup("missing")).rejects.toThrow("Failed to select mockup");
      expect(await database.getSettings("mockupOverlay")).toBeUndefined();
    });

    it("keeps selected references valid when delete and select compete", async () => {
      const grid = await database.addGrid(gridInput());
      const gridResults = await Promise.allSettled([
        database.deleteGrid(grid.activeId),
        database.selectGrid(grid.activeId)
      ]);
      expect(gridResults.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
      const grids = await database.readGridLibrary();
      expect(grids.items.some((item) => item.id === grids.activeId)).toBe(true);
      const mockup = await database.addMockups(mockupInput("saved.png"), true);
      const mockupResults = await Promise.allSettled([
        database.deleteMockup(mockup.activeId!),
        database.selectMockup(mockup.activeId!)
      ]);
      expect(mockupResults.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
      expect((await database.readMockupLibrary()).activeId).toBeNull();
    });

    it("repairs an empty legacy selection during upload and rejects empty selection commands", async () => {
      await database.readMockupLibrary();
      const raw = await openDB(DB_NAME);
      await raw.put("settings", { activeMockupId: "" }, "mockupOverlay");
      raw.close();
      const added = await database.addMockups(mockupInput("saved.png"));
      expect(added.activeId).toBeNull();
      expect(await database.getSettings("mockupOverlay")).toMatchObject({ activeMockupId: null });
      await expect(database.selectMockup("")).rejects.toThrow("Failed to select mockup");
    });

    it("ordinary appearance patches reject selected IDs at type and runtime boundaries", async () => {
      // @ts-expect-error Resource selections are intentionally excluded from appearance patches.
      await expect(database.updateSettings("gridOverlay", { activeLayoutGridId: "missing" })).rejects.toThrow();
      // @ts-expect-error Resource selections are intentionally excluded from appearance patches.
      await expect(database.updateSettings("mockupOverlay", { activeMockupId: "missing" })).rejects.toThrow();
      expect(await database.getSettings("gridOverlay")).toBeUndefined();
      expect(await database.getSettings("mockupOverlay")).toBeUndefined();
    });

    it("does not read image bytes when selecting an existing mockup", async () => {
      const saved = await database.addMockups(mockupInput("saved.png"));
      const original = IDBObjectStore.prototype.get;
      const reads = vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(function (this: IDBObjectStore, key) {
        if (this.name === "mockup_blobs") throw new Error("Image bytes must remain controller-owned.");
        return original.call(this, key);
      });
      try {
        const result = await database.selectMockup(saved.added[0].id);
        expect(result).toMatchObject({ activeId: saved.added[0].id, appearance: { isHidden: false, isLocked: false } });
      } finally {
        reads.mockRestore();
      }
    });
  });

  describe("ids", () => {
    it("generates UUID v4 ids without crypto.randomUUID (insecure contexts such as LAN IPs)", async () => {
      const randomUUID = crypto.randomUUID;
      Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
      try {
        const { activeId: id } = await database.addGrid(gridInput());
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      } finally {
        Object.defineProperty(crypto, "randomUUID", { value: randomUUID, configurable: true });
      }
    });
  });

  describe("connection", () => {
    it("retries opening after a failure instead of caching it", async () => {
      const open = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
        throw new Error("blocked");
      });

      await expect(database.readGridLibrary().then((library) => library.items)).rejects.toThrow("Failed to load grids");
      expect((await database.readGridLibrary()).items).toHaveLength(1);
      open.mockRestore();
    });

    const openOldTab = () =>
      // Version 2.0 tabs keep their connection open when another tab needs to upgrade
      openDB(DB_NAME, 2, {
        upgrade(db) {
          db.createObjectStore("mockups", { keyPath: "id" });
          db.createObjectStore("mockup_blobs");
          db.createObjectStore("grids", { keyPath: "id" });
          db.createObjectStore("settings");
        }
      });
    const blockedCause = async (call: Promise<unknown>) => ((await call.catch((error: Error) => error)) as Error).cause;

    it("reports an older tab that blocks the upgrade, fails fast meanwhile, and recovers once it closes", async () => {
      const { DatabaseBlockedError } = await import("~/utils/errors");
      const oldTab = await openOldTab();

      expect(await blockedCause(database.readGridLibrary().then((library) => library.items))).toBeInstanceOf(
        DatabaseBlockedError
      );
      // Later calls don't queue up behind the blocked upgrade
      expect(await blockedCause(database.getSettings("dock"))).toBeInstanceOf(DatabaseBlockedError);

      oldTab.close();
      // No reload needed: the upgrade completes and its connection is used from then on
      await vi.waitFor(async () => expect((await database.readGridLibrary()).items).toHaveLength(1));
    });

    it("reports an open stuck behind another tab's pending upgrade", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        const { DatabaseBlockedError } = await import("~/utils/errors");
        const oldTab = await openOldTab();
        // A second tab of this version asks to upgrade first and gets blocked; ours queues behind it
        const otherTab = openDB(DB_NAME, 3, { blocked: () => {} });

        const call = database
          .readGridLibrary()
          .then((library) => library.items)
          .catch((error: Error) => error);
        await vi.advanceTimersByTimeAsync(3000);
        expect(((await call) as Error).cause).toBeInstanceOf(DatabaseBlockedError);

        oldTab.close();
        (await otherTab).close();
      } finally {
        vi.useRealTimers();
      }
    });

    it("steps aside when another tab upgrades the database, then reconnects", async () => {
      await database.addGrid(gridInput());

      // Another tab with a newer schema: the upgrade must not be blocked by our open connection
      const other = await openDB(DB_NAME, 4, { blocked: () => expect.fail("upgrade was blocked") });
      other.close();
    });
  });

  describe("migration from version 2", () => {
    it("rolls back an aborted migration and can retry without unhandled rejections", async () => {
      const v2 = await openDB(DB_NAME, 2, {
        upgrade(db) {
          db.createObjectStore("mockups", { keyPath: "id" });
          db.createObjectStore("mockup_blobs");
          db.createObjectStore("grids", { keyPath: "id" });
          db.createObjectStore("settings");
        }
      });
      const bytes = new Uint8Array([1, 2, 3]).buffer;
      await v2.put("mockups", {
        id: "m1",
        filename: "a.png",
        mimeType: "image/png",
        createdAt: 1,
        thumbnailBuffer: bytes
      });
      await v2.put("mockup_blobs", bytes, "m1");
      v2.close();
      const originalUpdate = IDBCursor.prototype.update;
      const abortUpdate = vi.spyOn(IDBCursor.prototype, "update").mockImplementationOnce(function (
        this: IDBCursor,
        value
      ) {
        const request = originalUpdate.call(this, value);
        (this.source as IDBObjectStore).transaction.abort();
        return request;
      });
      try {
        await expect(database.readMockupLibrary().then((library) => library.items)).rejects.toThrow(
          "Failed to load mockups"
        );
      } finally {
        abortUpdate.mockRestore();
      }
      const raw = await openDB(DB_NAME);
      expect(raw.version).toBe(2);
      expect((await raw.get("mockups", "m1")).thumbnailBuffer).toEqual(bytes);
      raw.close();
      expect((await database.readMockupLibrary().then((library) => library.items))[0].thumbnail).toBeInstanceOf(Blob);
    });

    it("keeps stored images readable as Blobs and keeps everything else", async () => {
      const v2 = await openDB(DB_NAME, 2, {
        upgrade(db) {
          db.createObjectStore("mockups", { keyPath: "id" });
          db.createObjectStore("mockup_blobs");
          db.createObjectStore("grids", { keyPath: "id" });
          db.createObjectStore("settings");
        }
      });
      const bytes = (text: string) => new TextEncoder().encode(text).buffer;
      await v2.put("mockups", {
        id: "m1",
        filename: "home.jpg",
        mimeType: "image/jpeg",
        createdAt: 1,
        thumbnailBuffer: bytes("thumb")
      });
      await v2.put("mockup_blobs", bytes("original"), "m1");
      await v2.put("grids", { ...gridInput(), id: "g1", createdAt: 1 });
      await v2.put("settings", { position: "top", theme: "dark" }, "dock");
      v2.close();

      const [mockup] = await database.readMockupLibrary().then((library) => library.items);
      expect(mockup).toMatchObject({ id: "m1", filename: "home.jpg", mimeType: "image/jpeg" });
      expect(mockup).not.toHaveProperty("thumbnailBuffer");
      expect(mockup.thumbnail).toBeInstanceOf(Blob);
      expect(mockup.thumbnail.type).toBe("image/jpeg");
      expect(await mockup.thumbnail.text()).toBe("thumb");

      const image = await database.getMockupImage("m1");
      expect(image).toBeInstanceOf(Blob);
      expect(image!.type).toBe("image/jpeg");
      expect(await image!.text()).toBe("original");

      expect((await database.readGridLibrary()).items.find((grid) => grid.id === "g1")).toMatchObject({ id: "g1" });
      expect(await database.getSettings("dock")).toEqual({ position: "top", theme: "dark" });
    });

    it("creates all stores for a brand new database", async () => {
      expect(await database.readMockupLibrary().then((library) => library.items)).toEqual([]);
      expect((await database.readGridLibrary()).items).toHaveLength(1);
      expect(await database.getSettings("dock")).toBeUndefined();
    });
  });
});
