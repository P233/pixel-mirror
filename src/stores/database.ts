/**
 * Database Layer
 *
 * IndexedDB operations for persisting mockups, grids, and settings.
 * Uses idb library for Promise-based API.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { DatabaseError } from "~/utils/errors";
import { settingsEventBus } from "./eventBus";

const DB_NAME = "PixelMirrorDB";
const VERSION = 2;

interface PixelMirrorDBSchema extends DBSchema {
  mockups: {
    key: Mockup["id"];
    value: Omit<Mockup, "originalBuffer">;
  };
  mockup_blobs: {
    key: Mockup["id"];
    value: ArrayBuffer;
  };
  grids: {
    key: LayoutGridConfig["id"];
    value: LayoutGridConfig;
  };
  settings: {
    key: SettingGroup;
    value: AppSettings[SettingGroup];
  };
}

/**
 * Generate a UUID v4 string.
 * crypto.randomUUID() requires a secure context (HTTPS or localhost).
 * Mobile devices accessing the dev server via LAN IP use HTTP, which is
 * not a secure context. Fall back to crypto.getRandomValues() in that case.
 */
function generateId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let dbPromise: Promise<IDBPDatabase<PixelMirrorDBSchema>> | undefined;

async function getDB(): Promise<IDBPDatabase<PixelMirrorDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PixelMirrorDBSchema>(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mockups")) {
          db.createObjectStore("mockups", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("mockup_blobs")) {
          db.createObjectStore("mockup_blobs");
        }
        if (!db.objectStoreNames.contains("grids")) {
          db.createObjectStore("grids", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      }
    }).catch((error) => {
      // Don't cache the failure: the next call retries opening the database
      dbPromise = undefined;
      throw error;
    });
  }
  return dbPromise;
}

// ============================================
// Mockup Operations
// ============================================

export async function getAllMockups(): Promise<Omit<Mockup, "originalBuffer">[]> {
  try {
    const db = await getDB();
    const mockups = await db.getAll("mockups");
    return mockups.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw new DatabaseError("Failed to load mockups", error);
  }
}

export async function getMockup(id: string): Promise<Mockup | undefined> {
  try {
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readonly");
    const [metadata, originalBuffer] = await Promise.all([
      tx.objectStore("mockups").get(id),
      tx.objectStore("mockup_blobs").get(id)
    ]);
    await tx.done;

    if (!metadata || !originalBuffer) return undefined;
    return { ...metadata, originalBuffer };
  } catch (error) {
    throw new DatabaseError("Failed to get mockup", error);
  }
}

export async function addMockups(input: MockupInput | MockupInput[]): Promise<string[]> {
  try {
    const inputs = Array.isArray(input) ? input : [input];
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readwrite");
    const metadataStore = tx.objectStore("mockups");
    const blobStore = tx.objectStore("mockup_blobs");

    const now = Date.now();
    const ids: string[] = [];
    const putPromises = inputs.map((item, index) => {
      const id = generateId();
      ids.push(id);
      const { originalBuffer, ...rest } = item;
      const metadata = { ...rest, id, createdAt: now + index };
      return Promise.all([metadataStore.put(metadata), blobStore.put(originalBuffer, id)]);
    });

    await Promise.all(putPromises);
    await tx.done;
    return ids;
  } catch (error) {
    throw new DatabaseError("Failed to add mockups", error);
  }
}

export async function deleteMockup(id: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readwrite");
    await Promise.all([tx.objectStore("mockups").delete(id), tx.objectStore("mockup_blobs").delete(id)]);
    await tx.done;
  } catch (error) {
    throw new DatabaseError("Failed to delete mockup", error);
  }
}

export async function resetMockups(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readwrite");
    await Promise.all([tx.objectStore("mockups").clear(), tx.objectStore("mockup_blobs").clear()]);
    await tx.done;
  } catch (error) {
    throw new DatabaseError("Failed to reset mockups", error);
  }
}

// ============================================
// Grid Operations
// ============================================

export async function getAllGrids(): Promise<LayoutGridConfig[]> {
  try {
    const db = await getDB();
    const grids = await db.getAll("grids");
    return grids.sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    throw new DatabaseError("Failed to load grids", error);
  }
}

export async function getGrid(id: string): Promise<LayoutGridConfig | undefined> {
  try {
    const db = await getDB();
    return await db.get("grids", id);
  } catch (error) {
    throw new DatabaseError("Failed to get grid", error);
  }
}

export async function addGrid(input: GridInput): Promise<string> {
  try {
    const db = await getDB();
    const grid: LayoutGridConfig = {
      ...input,
      id: generateId(),
      createdAt: Date.now()
    };
    await db.put("grids", grid);
    return grid.id;
  } catch (error) {
    throw new DatabaseError("Failed to add grid", error);
  }
}

export async function deleteGrid(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("grids", id);
  } catch (error) {
    throw new DatabaseError("Failed to delete grid", error);
  }
}

export async function resetGrids(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("grids");
  } catch (error) {
    throw new DatabaseError("Failed to reset grids", error);
  }
}

// ============================================
// Settings Operations
// ============================================

export async function getSettingsByGroup<G extends SettingGroup>(group: G): Promise<Partial<AppSettings[G]>> {
  try {
    const db = await getDB();
    const settings = (await db.get("settings", group)) as AppSettings[G] | undefined;
    return settings || {};
  } catch (error) {
    throw new DatabaseError("Failed to load settings", error);
  }
}

export async function updateSetting<G extends SettingGroup, K extends keyof AppSettings[G]>(
  group: G,
  key: K,
  value: AppSettings[G][K]
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction("settings", "readwrite");
    const store = tx.objectStore("settings");

    const existingSettings = ((await store.get(group)) || {}) as AppSettings[G];
    await store.put({ ...existingSettings, [key]: value }, group);
    await tx.done;

    // Emit event for store synchronization
    const partialSettings = { [key]: value } as unknown as Partial<AppSettings[G]>;
    settingsEventBus.emit(group, partialSettings);
  } catch (error) {
    throw new DatabaseError("Failed to update setting", error);
  }
}

export async function resetGridOverlaySettings(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("settings", "gridOverlay");
  } catch (error) {
    throw new DatabaseError("Failed to reset grid overlay settings", error);
  }
}
