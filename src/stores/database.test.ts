/**
 * Database Layer Tests
 *
 * Tests IndexedDB operations for mockups, grids, and settings.
 * Uses fake-indexeddb for testing.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock idb module since IndexedDB is not available in happy-dom
const mockDb = {
  getAll: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  transaction: vi.fn()
};

const mockTransaction = {
  objectStore: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined)
  })),
  done: Promise.resolve()
};

vi.mock("idb", () => ({
  openDB: vi.fn(() => Promise.resolve(mockDb))
}));

// Mock eventBus
vi.mock("./eventBus", () => ({
  settingsEventBus: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
}));

describe("database operations", () => {
  let database: typeof import("./database");
  let settingsEventBus: typeof import("./eventBus").settingsEventBus;

  beforeEach(async () => {
    vi.resetModules();

    // Reset mock implementations
    mockDb.getAll.mockReset().mockResolvedValue([]);
    mockDb.get.mockReset().mockResolvedValue(undefined);
    mockDb.put.mockReset().mockResolvedValue(undefined);
    mockDb.delete.mockReset().mockResolvedValue(undefined);
    mockDb.clear.mockReset().mockResolvedValue(undefined);
    mockDb.transaction.mockReset().mockReturnValue(mockTransaction);

    // Import fresh modules
    database = await import("./database");
    const eventBusModule = await import("./eventBus");
    settingsEventBus = eventBusModule.settingsEventBus;
  });

  describe("mockup operations", () => {
    describe("getAllMockups", () => {
      it("returns empty array when no mockups", async () => {
        mockDb.getAll.mockResolvedValue([]);

        const result = await database.getAllMockups();

        expect(result).toEqual([]);
      });

      it("returns mockups sorted by createdAt descending", async () => {
        const mockups = [
          { id: "1", name: "first", createdAt: 1000 },
          { id: "2", name: "second", createdAt: 2000 },
          { id: "3", name: "third", createdAt: 1500 }
        ];
        mockDb.getAll.mockResolvedValue(mockups);

        const result = await database.getAllMockups();

        expect(result[0].id).toBe("2");
        expect(result[1].id).toBe("3");
        expect(result[2].id).toBe("1");
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.getAll.mockRejectedValue(new Error("DB error"));

        await expect(database.getAllMockups()).rejects.toThrow("Failed to load mockups");
      });
    });

    describe("getMockup", () => {
      it("returns undefined when mockup not found", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        const result = await database.getMockup("non-existent");

        expect(result).toBeUndefined();
      });

      it("returns mockup with originalBuffer when found", async () => {
        const metadata = { id: "test-id", name: "test.png", mimeType: "image/png" };
        const buffer = new ArrayBuffer(8);

        let callCount = 0;
        const mockTxStore = {
          get: vi.fn().mockImplementation(() => {
            callCount++;
            return callCount === 1 ? Promise.resolve(metadata) : Promise.resolve(buffer);
          }),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        const result = await database.getMockup("test-id");

        expect(result).toEqual({ ...metadata, originalBuffer: buffer });
      });

      it("returns undefined when metadata exists but buffer missing", async () => {
        const metadata = { id: "test-id", name: "test.png" };

        let callCount = 0;
        const mockTxStore = {
          get: vi.fn().mockImplementation(() => {
            callCount++;
            return callCount === 1 ? Promise.resolve(metadata) : Promise.resolve(undefined);
          }),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        const result = await database.getMockup("test-id");

        expect(result).toBeUndefined();
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.transaction.mockImplementation(() => {
          throw new Error("Transaction failed");
        });

        await expect(database.getMockup("test-id")).rejects.toThrow("Failed to get mockup");
      });
    });

    describe("addMockups", () => {
      it("adds single mockup", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        const input = {
          filename: "test.png",
          mimeType: "image/png",
          originalBuffer: new ArrayBuffer(8),
          thumbnailBuffer: new ArrayBuffer(4)
        };

        const ids = await database.addMockups(input);
        expect(ids).toHaveLength(1);
        expect(typeof ids[0]).toBe("string");
      });

      it("adds multiple mockups", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        const inputs = [
          {
            filename: "test1.png",
            mimeType: "image/png",
            originalBuffer: new ArrayBuffer(8),
            thumbnailBuffer: new ArrayBuffer(4)
          },
          {
            filename: "test2.png",
            mimeType: "image/png",
            originalBuffer: new ArrayBuffer(8),
            thumbnailBuffer: new ArrayBuffer(4)
          }
        ];

        const ids = await database.addMockups(inputs);
        expect(ids).toHaveLength(2);
        expect(typeof ids[0]).toBe("string");
        expect(typeof ids[1]).toBe("string");
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.transaction.mockImplementation(() => {
          throw new Error("Transaction failed");
        });

        const input = {
          filename: "test.png",
          mimeType: "image/png",
          originalBuffer: new ArrayBuffer(8),
          thumbnailBuffer: new ArrayBuffer(4)
        };

        await expect(database.addMockups(input)).rejects.toThrow("Failed to add mockups");
      });
    });

    describe("deleteMockup", () => {
      it("deletes mockup by id", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        await expect(database.deleteMockup("test-id")).resolves.toBeUndefined();
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.transaction.mockImplementation(() => {
          throw new Error("Transaction failed");
        });

        await expect(database.deleteMockup("test-id")).rejects.toThrow("Failed to delete mockup");
      });
    });

    describe("resetMockups", () => {
      it("clears all mockups", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
          clear: vi.fn().mockResolvedValue(undefined)
        };
        mockTransaction.objectStore.mockReturnValue(mockTxStore);

        await expect(database.resetMockups()).resolves.toBeUndefined();
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.transaction.mockImplementation(() => {
          throw new Error("Transaction failed");
        });

        await expect(database.resetMockups()).rejects.toThrow("Failed to reset mockups");
      });
    });
  });

  describe("grid operations", () => {
    describe("getAllGrids", () => {
      it("returns empty array when no grids", async () => {
        mockDb.getAll.mockResolvedValue([]);

        const result = await database.getAllGrids();

        expect(result).toEqual([]);
      });

      it("returns grids sorted by createdAt ascending", async () => {
        const grids = [
          { id: "1", createdAt: 2000 },
          { id: "2", createdAt: 1000 },
          { id: "3", createdAt: 1500 }
        ];
        mockDb.getAll.mockResolvedValue(grids);

        const result = await database.getAllGrids();

        expect(result[0].id).toBe("2");
        expect(result[1].id).toBe("3");
        expect(result[2].id).toBe("1");
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.getAll.mockRejectedValue(new Error("DB error"));

        await expect(database.getAllGrids()).rejects.toThrow("Failed to load grids");
      });
    });

    describe("getGrid", () => {
      it("returns grid by id", async () => {
        const grid = { id: "test-id", width: "1200px", columns: 12 };
        mockDb.get.mockResolvedValue(grid);

        const result = await database.getGrid("test-id");

        expect(result).toEqual(grid);
      });

      it("returns undefined when grid not found", async () => {
        mockDb.get.mockResolvedValue(undefined);

        const result = await database.getGrid("non-existent");

        expect(result).toBeUndefined();
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.get.mockRejectedValue(new Error("DB error"));

        await expect(database.getGrid("test-id")).rejects.toThrow("Failed to get grid");
      });
    });

    describe("addGrid", () => {
      it("adds grid and returns id", async () => {
        mockDb.put.mockResolvedValue(undefined);

        // Mock crypto.randomUUID
        const mockUUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890" as const;
        vi.spyOn(crypto, "randomUUID").mockReturnValue(mockUUID);

        const input: GridInput = {
          width: "1200px",
          columns: 12,
          gutterWidth: "24px",
          isGutterOnOutside: true,
          position: "center"
        };

        const result = await database.addGrid(input);

        expect(result).toBe(mockUUID);
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.put.mockRejectedValue(new Error("DB error"));

        const input: GridInput = {
          width: "1200px",
          columns: 12,
          gutterWidth: "24px",
          isGutterOnOutside: true,
          position: "center"
        };

        await expect(database.addGrid(input)).rejects.toThrow("Failed to add grid");
      });
    });

    describe("deleteGrid", () => {
      it("deletes grid by id", async () => {
        mockDb.delete.mockResolvedValue(undefined);

        await expect(database.deleteGrid("test-id")).resolves.toBeUndefined();
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.delete.mockRejectedValue(new Error("DB error"));

        await expect(database.deleteGrid("test-id")).rejects.toThrow("Failed to delete grid");
      });
    });

    describe("resetGrids", () => {
      it("clears all grids", async () => {
        mockDb.clear.mockResolvedValue(undefined);

        await expect(database.resetGrids()).resolves.toBeUndefined();
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.clear.mockRejectedValue(new Error("DB error"));

        await expect(database.resetGrids()).rejects.toThrow("Failed to reset grids");
      });
    });
  });

  describe("settings operations", () => {
    describe("getSettingsByGroup", () => {
      it("returns empty object when no settings", async () => {
        mockDb.get.mockResolvedValue(undefined);

        const result = await database.getSettingsByGroup("dock");

        expect(result).toEqual({});
      });

      it("returns settings for group", async () => {
        const settings = { position: "top", theme: "dark" };
        mockDb.get.mockResolvedValue(settings);

        const result = await database.getSettingsByGroup("dock");

        expect(result).toEqual(settings);
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.get.mockRejectedValue(new Error("DB error"));

        await expect(database.getSettingsByGroup("dock")).rejects.toThrow("Failed to load settings");
      });
    });

    describe("updateSetting", () => {
      it("updates single setting", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue({ theme: "light" }),
          put: vi.fn().mockResolvedValue(undefined)
        };
        mockDb.transaction.mockReturnValue({
          objectStore: () => mockTxStore,
          done: Promise.resolve()
        });

        await database.updateSetting("dock", "position", "top");

        expect(mockTxStore.put).toHaveBeenCalled();
      });

      it("emits event on settings update", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue({}),
          put: vi.fn().mockResolvedValue(undefined)
        };
        mockDb.transaction.mockReturnValue({
          objectStore: () => mockTxStore,
          done: Promise.resolve()
        });

        await database.updateSetting("dock", "theme", "dark");

        expect(settingsEventBus.emit).toHaveBeenCalledWith("dock", { theme: "dark" });
      });

      it("merges with existing settings", async () => {
        const existingSettings = { position: "bottom", theme: "light" };
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(existingSettings),
          put: vi.fn().mockResolvedValue(undefined)
        };
        mockDb.transaction.mockReturnValue({
          objectStore: () => mockTxStore,
          done: Promise.resolve()
        });

        await database.updateSetting("dock", "theme", "dark");

        expect(mockTxStore.put).toHaveBeenCalledWith({ position: "bottom", theme: "dark" }, "dock");
      });

      it("creates settings object when none exist", async () => {
        const mockTxStore = {
          get: vi.fn().mockResolvedValue(undefined),
          put: vi.fn().mockResolvedValue(undefined)
        };
        mockDb.transaction.mockReturnValue({
          objectStore: () => mockTxStore,
          done: Promise.resolve()
        });

        await database.updateSetting("dock", "theme", "dark");

        expect(mockTxStore.put).toHaveBeenCalledWith({ theme: "dark" }, "dock");
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.transaction.mockImplementation(() => {
          throw new Error("Transaction failed");
        });

        await expect(database.updateSetting("dock", "theme", "dark")).rejects.toThrow("Failed to update setting");
      });
    });

    describe("resetGridOverlaySettings", () => {
      it("deletes grid overlay settings", async () => {
        mockDb.delete.mockResolvedValue(undefined);

        await expect(database.resetGridOverlaySettings()).resolves.toBeUndefined();
        expect(mockDb.delete).toHaveBeenCalledWith("settings", "gridOverlay");
      });

      it("throws DatabaseError on failure", async () => {
        mockDb.delete.mockRejectedValue(new Error("DB error"));

        await expect(database.resetGridOverlaySettings()).rejects.toThrow("Failed to reset grid overlay settings");
      });
    });
  });

  describe("opening the database", () => {
    it("retries after a failed open instead of caching the failure", async () => {
      const { openDB } = await import("idb");
      vi.mocked(openDB).mockRejectedValueOnce(new Error("blocked"));

      await expect(database.getAllMockups()).rejects.toThrow("Failed to load mockups");
      await expect(database.getAllMockups()).resolves.toEqual([]);
    });
  });
});
