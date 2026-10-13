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
  let database: typeof import("./database");

  beforeEach(async () => {
    // A fresh, empty IndexedDB and a fresh module (no cached connection) for every test
    globalThis.indexedDB = new IDBFactory();
    vi.resetModules();
    database = await import("./database");
  });

  describe("grids", () => {
    it("adds, lists (oldest first), gets and deletes grids", async () => {
      const a = await database.addGrid(gridInput({ columns: 2 }));
      const b = await database.addGrid(gridInput({ columns: 3 }));

      expect((await database.getAllGrids()).map((g) => g.id)).toEqual([a, b]);
      expect(await database.getGrid(b)).toMatchObject({ id: b, columns: 3 });

      await database.deleteGrid(a);
      expect((await database.getAllGrids()).map((g) => g.id)).toEqual([b]);

      await database.resetGrids();
      expect(await database.getAllGrids()).toEqual([]);
    });
  });

  describe("mockups", () => {
    it("stores images as Blobs and lists metadata newest first", async () => {
      const [first, second] = await database.addMockups([mockupInput("a.png"), mockupInput("b.png")]);

      const mockups = await database.getAllMockups();
      expect(mockups.map((m) => m.id)).toEqual([second, first]);
      expect(mockups[0]).toMatchObject({ filename: "b.png", width: 800, height: 1500 });
      expect(mockups[0].thumbnail).toBeInstanceOf(Blob);
      expect(await mockups[0].thumbnail.text()).toBe("thumb-b.png");
      expect(mockups[0]).not.toHaveProperty("image");

      const image = await database.getMockupImage(first);
      expect(image).toBeInstanceOf(Blob);
      expect(await image!.text()).toBe("a.png");
    });

    it("deletes a mockup together with its image", async () => {
      const [id] = await database.addMockups(mockupInput("a.png"));

      await database.deleteMockup(id);

      expect(await database.getAllMockups()).toEqual([]);
      expect(await database.getMockupImage(id)).toBeUndefined();
    });

    it("clears all mockups", async () => {
      await database.addMockups([mockupInput("a.png"), mockupInput("b.png")]);

      await database.resetMockups();

      expect(await database.getAllMockups()).toEqual([]);
    });
  });

  describe("settings", () => {
    it("saves and loads a whole group", async () => {
      expect(await database.getSettings("dock")).toBeUndefined();

      await database.saveSettings("dock", { position: "top", theme: "dark" });

      expect(await database.getSettings("dock")).toEqual({ position: "top", theme: "dark" });
    });
  });

  describe("ids", () => {
    it("generates UUID v4 ids without crypto.randomUUID (insecure contexts such as LAN IPs)", async () => {
      const randomUUID = crypto.randomUUID;
      Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
      try {
        const id = await database.addGrid(gridInput());
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

      await expect(database.getAllGrids()).rejects.toThrow("Failed to load grids");
      await expect(database.getAllGrids()).resolves.toEqual([]);
      open.mockRestore();
    });

    it("steps aside when another tab upgrades the database, then reconnects", async () => {
      await database.addGrid(gridInput());

      // Another tab with a newer schema: the upgrade must not be blocked by our open connection
      const other = await openDB(DB_NAME, 4, { blocked: () => expect.fail("upgrade was blocked") });
      other.close();
    });
  });

  describe("migration from version 2", () => {
    it("converts stored ArrayBuffers to Blobs and keeps everything else", async () => {
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

      const [mockup] = await database.getAllMockups();
      expect(mockup).toMatchObject({ id: "m1", filename: "home.jpg", mimeType: "image/jpeg" });
      expect(mockup).not.toHaveProperty("thumbnailBuffer");
      expect(mockup.thumbnail).toBeInstanceOf(Blob);
      expect(mockup.thumbnail.type).toBe("image/jpeg");
      expect(await mockup.thumbnail.text()).toBe("thumb");

      const image = await database.getMockupImage("m1");
      expect(image).toBeInstanceOf(Blob);
      expect(image!.type).toBe("image/jpeg");
      expect(await image!.text()).toBe("original");

      expect(await database.getGrid("g1")).toMatchObject({ id: "g1" });
      expect(await database.getSettings("dock")).toEqual({ position: "top", theme: "dark" });
    });

    it("creates all stores for a brand new database", async () => {
      expect(await database.getAllMockups()).toEqual([]);
      expect(await database.getAllGrids()).toEqual([]);
      expect(await database.getSettings("dock")).toBeUndefined();
    });
  });
});
