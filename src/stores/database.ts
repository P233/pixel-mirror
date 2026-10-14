/**
 * Database Layer
 *
 * IndexedDB operations for persisting mockups, grids, and settings.
 * Uses idb library for Promise-based API.
 *
 * Schema versions:
 * - 1–2: mockups (metadata + thumbnail ArrayBuffer), mockup_blobs (original ArrayBuffer), grids, settings
 * - 3:   images are stored as `{ bytes, type }` (StoredBinary); the thumbnail is part of the mockup metadata
 *
 * Images are stored as bytes rather than Blobs: WebKit rejects Blobs in IndexedDB in private windows.
 */

import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from "idb";
import { DatabaseBlockedError, DatabaseError } from "~/utils/errors";

const DB_NAME = "PixelMirrorDB";
const VERSION = 3;

/** Image data as stored; Blobs were written by unreleased version 3 builds and are still read */
type StoredBinary = { bytes: ArrayBuffer; type: string } | Blob;

/** Mockup metadata as stored since version 3 */
interface MockupRecord extends Omit<Mockup, "thumbnail"> {
  thumbnail: StoredBinary;
}

interface PixelMirrorDBSchema extends DBSchema {
  mockups: {
    key: Mockup["id"];
    value: MockupRecord;
  };
  mockup_blobs: {
    key: Mockup["id"];
    value: StoredBinary;
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

type UpgradeTransaction = IDBPTransaction<PixelMirrorDBSchema, StoreNames<PixelMirrorDBSchema>[], "versionchange">;

/** Mockup metadata as stored up to version 2 */
interface MockupRecordV2 extends Omit<Mockup, "thumbnail"> {
  thumbnailBuffer: ArrayBuffer;
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

async function toStoredBinary(blob: Blob): Promise<StoredBinary> {
  return { bytes: await blob.arrayBuffer(), type: blob.type };
}

function toBlob(stored: StoredBinary): Blob {
  return stored instanceof Blob ? stored : new Blob([stored.bytes], { type: stored.type });
}

function toMockup({ thumbnail, ...record }: MockupRecord): Mockup {
  return { ...record, thumbnail: toBlob(thumbnail) };
}

/** Version 2 kept the MIME type only in the metadata; version 3 stores it with each image */
async function migrateImagesToStoredBinary(tx: UpgradeTransaction) {
  const mimeTypes = new Map<string, string>();

  let metadataCursor = await tx.objectStore("mockups").openCursor();
  while (metadataCursor) {
    const { thumbnailBuffer, ...record } = metadataCursor.value as unknown as MockupRecordV2;
    mimeTypes.set(record.id, record.mimeType);
    if (thumbnailBuffer) {
      await metadataCursor.update({ ...record, thumbnail: { bytes: thumbnailBuffer, type: record.mimeType } });
    }
    metadataCursor = await metadataCursor.continue();
  }

  let imageCursor = await tx.objectStore("mockup_blobs").openCursor();
  while (imageCursor) {
    const value: unknown = imageCursor.value;
    if (value instanceof ArrayBuffer) {
      await imageCursor.update({ bytes: value, type: mimeTypes.get(imageCursor.key) ?? "" });
    }
    imageCursor = await imageCursor.continue();
  }
}

/**
 * Wait for a transaction's requests and its completion together. A failed request aborts the
 * transaction, so `done` rejects as well; awaited separately, that rejection would surface on
 * the host page as an unhandled rejection.
 */
async function settleTransaction(requests: Promise<unknown>[], done: Promise<void>): Promise<void> {
  await Promise.all([...requests, done]);
}

let dbPromise: Promise<IDBPDatabase<PixelMirrorDBSchema>> | undefined;

/** How long an open may wait behind another tab's pending upgrade before it is reported (ms) */
const OPEN_QUEUE_TIMEOUT = 3000;

/**
 * Set while a tab of a version before 2.1 holds the database: unlike this version it doesn't close
 * its connection for an upgrade, so opens wait until that tab closes. Calls fail fast meanwhile.
 */
let isUpgradeBlocked = false;

function openDatabase(): Promise<IDBPDatabase<PixelMirrorDBSchema>> {
  return new Promise((resolve, reject) => {
    let isReported = false;
    // Tell the user what to do rather than wait with nothing loaded; the open itself carries on
    const reportBlocked = () => {
      clearTimeout(queueTimer);
      if (isReported) return;
      isReported = true;
      isUpgradeBlocked = true;
      reject(new DatabaseBlockedError());
    };
    // Only the open at the front of the queue gets `blocked`; others (e.g. a second tab of this
    // version) just wait. One that hasn't started upgrading or opened by now is stuck there.
    const queueTimer = setTimeout(reportBlocked, OPEN_QUEUE_TIMEOUT);

    openDB<PixelMirrorDBSchema>(DB_NAME, VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
        // Migrating many large images can take a while; that is progress, not a stuck queue
        clearTimeout(queueTimer);
        if (oldVersion < 2) {
          // Version 1 databases may lack some stores; create whatever is missing
          if (!db.objectStoreNames.contains("mockups")) db.createObjectStore("mockups", { keyPath: "id" });
          if (!db.objectStoreNames.contains("mockup_blobs")) db.createObjectStore("mockup_blobs");
          if (!db.objectStoreNames.contains("grids")) db.createObjectStore("grids", { keyPath: "id" });
          if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
        }
        if (oldVersion < 3) {
          await migrateImagesToStoredBinary(tx);
        }
      },
      // Another tab (e.g. with a newer version of the tool) wants to upgrade: let it,
      // and reopen on the next call
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase).close();
        dbPromise = undefined;
      },
      // The browser closed the connection (e.g. storage cleared)
      terminated() {
        dbPromise = undefined;
      },
      blocked: reportBlocked
    }).then(
      (db) => {
        clearTimeout(queueTimer);
        if (!isReported) return resolve(db);
        // The older tab closed and the open went through: later calls use this connection
        isUpgradeBlocked = false;
        dbPromise = Promise.resolve(db);
      },
      (error) => {
        clearTimeout(queueTimer);
        if (isReported) isUpgradeBlocked = false;
        else reject(error);
      }
    );
  });
}

async function getDB(): Promise<IDBPDatabase<PixelMirrorDBSchema>> {
  if (isUpgradeBlocked) throw new DatabaseBlockedError();
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
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

export async function getAllMockups(): Promise<Mockup[]> {
  try {
    const db = await getDB();
    const records = await db.getAll("mockups");
    return records.map(toMockup).sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw new DatabaseError("Failed to load mockups", error);
  }
}

/** The full-size image of a mockup */
export async function getMockupImage(id: string): Promise<Blob | undefined> {
  try {
    const db = await getDB();
    const stored = await db.get("mockup_blobs", id);
    return stored && toBlob(stored);
  } catch (error) {
    throw new DatabaseError("Failed to get mockup", error);
  }
}

export async function addMockups(input: MockupInput | MockupInput[]): Promise<string[]> {
  try {
    const inputs = Array.isArray(input) ? input : [input];
    // Read the files before opening the transaction: awaiting anything else would let it auto-commit
    const records = await Promise.all(
      inputs.map(async ({ image, thumbnail, ...metadata }) => ({
        metadata,
        image: await toStoredBinary(image),
        thumbnail: await toStoredBinary(thumbnail)
      }))
    );
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readwrite");
    const metadataStore = tx.objectStore("mockups");
    const imageStore = tx.objectStore("mockup_blobs");

    const now = Date.now();
    const ids: string[] = [];
    const requests = records.flatMap(({ metadata, image, thumbnail }, index) => {
      const id = generateId();
      ids.push(id);
      return [metadataStore.put({ ...metadata, thumbnail, id, createdAt: now + index }), imageStore.put(image, id)];
    });

    await settleTransaction(requests, tx.done);
    return ids;
  } catch (error) {
    throw new DatabaseError("Failed to add mockups", error);
  }
}

export async function deleteMockup(id: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readwrite");
    await settleTransaction([tx.objectStore("mockups").delete(id), tx.objectStore("mockup_blobs").delete(id)], tx.done);
  } catch (error) {
    throw new DatabaseError("Failed to delete mockup", error);
  }
}

export async function resetMockups(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(["mockups", "mockup_blobs"], "readwrite");
    await settleTransaction([tx.objectStore("mockups").clear(), tx.objectStore("mockup_blobs").clear()], tx.done);
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

/** The stored settings of a group, unvalidated (they may come from an older version) */
export async function getSettings(group: SettingGroup): Promise<unknown> {
  try {
    const db = await getDB();
    return await db.get("settings", group);
  } catch (error) {
    throw new DatabaseError("Failed to load settings", error);
  }
}

/** Replace the stored settings of a group */
export async function saveSettings<G extends SettingGroup>(group: G, settings: AppSettings[G]): Promise<void> {
  try {
    const db = await getDB();
    await db.put("settings", settings, group);
  } catch (error) {
    throw new DatabaseError("Failed to save settings", error);
  }
}
