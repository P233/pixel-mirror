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
import { DEFAULT_GRID_OVERLAY_SETTINGS, DEFAULT_GRID_TEMPLATE } from "~/constants";
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
    value: Partial<AppSettings[SettingGroup]>;
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
      upgrade(db, oldVersion, _newVersion, tx) {
        // Migrating many large images can take a while; that is progress, not a stuck queue
        clearTimeout(queueTimer);
        const migrate = async () => {
          if (oldVersion < 2) {
            // Version 1 databases may lack some stores; create whatever is missing
            if (!db.objectStoreNames.contains("mockups")) db.createObjectStore("mockups", { keyPath: "id" });
            if (!db.objectStoreNames.contains("mockup_blobs")) db.createObjectStore("mockup_blobs");
            if (!db.objectStoreNames.contains("grids")) db.createObjectStore("grids", { keyPath: "id" });
            if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings");
          }
          if (oldVersion < 3) await migrateImagesToStoredBinary(tx);
        };
        void settleTransaction([migrate()], tx.done).catch((error) => {
          try {
            tx.abort();
          } catch {
            // A failed request may already have aborted the transaction.
          }
          reject(error);
        });
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

type WriteTransaction = IDBPTransaction<PixelMirrorDBSchema, StoreNames<PixelMirrorDBSchema>[], "readwrite">;

/** Only IDB requests may be awaited inside the operation; prepare image bytes before calling. */
async function write<R>(
  stores: StoreNames<PixelMirrorDBSchema>[],
  message: string,
  operation: (tx: WriteTransaction) => Promise<R>
): Promise<R> {
  let tx: WriteTransaction | undefined;
  try {
    tx = (await getDB()).transaction(stores, "readwrite");
    const [result] = await Promise.all([operation(tx), tx.done]);
    return result;
  } catch (error) {
    if (tx) {
      try {
        tx.abort();
      } catch {
        // Failed requests may already have aborted the transaction.
      }
      await tx.done.catch(() => {});
    }
    throw new DatabaseError(message, error);
  }
}

function settingsRecord(stored: unknown): Record<string, unknown> {
  return typeof stored === "object" && stored !== null && !Array.isArray(stored)
    ? (stored as Record<string, unknown>)
    : {};
}

async function patchSettings(tx: WriteTransaction, group: SettingGroup, patch: Record<string, unknown>) {
  const previous = settingsRecord(await tx.objectStore("settings").get(group));
  const next = { ...previous, ...patch };
  await tx.objectStore("settings").put(next, group);
  return next;
}

export interface GridLibrary {
  items: LayoutGridConfig[];
  activeId: string;
  stored: unknown;
}

async function gridLibrary(tx: WriteTransaction, preferredId?: string): Promise<GridLibrary> {
  const store = tx.objectStore("grids");
  const items = (await store.getAll()).sort((a, b) => a.createdAt - b.createdAt);
  if (!items.length) {
    const grid = { ...DEFAULT_GRID_TEMPLATE, id: generateId(), createdAt: Date.now() };
    await store.put(grid);
    items.push(grid);
  }
  let stored = settingsRecord(await tx.objectStore("settings").get("gridOverlay"));
  if (!items.some((grid) => grid.id === stored.activeLayoutGridId)) {
    stored = await patchSettings(tx, "gridOverlay", { activeLayoutGridId: items[0].id });
  }
  const activeId = items.some((grid) => grid.id === preferredId) ? preferredId! : (stored.activeLayoutGridId as string);
  return { items, activeId, stored };
}

export function readGridLibrary(preferredId?: string): Promise<GridLibrary> {
  return write(["grids", "settings"], "Failed to load grids", (tx) => gridLibrary(tx, preferredId));
}

export function addGrid(input: GridInput): Promise<GridLibrary> {
  return write(["grids", "settings"], "Failed to add grid", async (tx) => {
    const grid = { ...input, id: generateId(), createdAt: Date.now() };
    await tx.objectStore("grids").put(grid);
    await patchSettings(tx, "gridOverlay", { activeLayoutGridId: grid.id });
    return gridLibrary(tx, grid.id);
  });
}

export function selectGrid(id: string): Promise<GridLibrary> {
  return write(["grids", "settings"], "Failed to select grid", async (tx) => {
    if (!(await tx.objectStore("grids").get(id))) throw new Error("Grid not found.");
    await patchSettings(tx, "gridOverlay", { activeLayoutGridId: id });
    return gridLibrary(tx, id);
  });
}

export function deleteGrid(id: string, preferredId?: string): Promise<GridLibrary> {
  return write(["grids", "settings"], "Failed to delete grid", async (tx) => {
    await tx.objectStore("grids").delete(id);
    return gridLibrary(tx, preferredId);
  });
}

export function resetGrids(): Promise<GridLibrary> {
  return write(["grids", "settings"], "Failed to reset grids", async (tx) => {
    await tx.objectStore("grids").clear();
    await tx.objectStore("settings").put(DEFAULT_GRID_OVERLAY_SETTINGS, "gridOverlay");
    return gridLibrary(tx);
  });
}

export interface MockupLibrary {
  items: Mockup[];
  activeId: string | null;
  stored: unknown;
}

export function readMockupLibrary(preferredId?: string | null): Promise<MockupLibrary> {
  return write(["mockups", "settings"], "Failed to load mockups", async (tx) => {
    const items = (await tx.objectStore("mockups").getAll()).map(toMockup).sort((a, b) => b.createdAt - a.createdAt);
    let stored = settingsRecord(await tx.objectStore("settings").get("mockupOverlay"));
    if (stored.activeMockupId !== null && !items.some((item) => item.id === stored.activeMockupId)) {
      stored = await patchSettings(tx, "mockupOverlay", { activeMockupId: null });
    }
    const activeId =
      preferredId === undefined
        ? (stored.activeMockupId as string | null)
        : items.some((item) => item.id === preferredId)
          ? preferredId
          : null;
    return { items, activeId, stored };
  });
}

/** The full-size image is read only by the overlay controller. */
export async function getMockupImage(id: string): Promise<Blob | undefined> {
  try {
    const stored = await (await getDB()).get("mockup_blobs", id);
    return stored && toBlob(stored);
  } catch (error) {
    throw new DatabaseError("Failed to get mockup", error);
  }
}

export interface MockupChange {
  added: Mockup[];
  activeId: string | null;
  appearance: Partial<MockupAppearanceSettings>;
}

const ACTIVATION_APPEARANCE = { isHidden: false, isLocked: false } as const;

export async function addMockups(
  input: MockupInput | MockupInput[],
  activate = false,
  preferredId?: string | null
): Promise<MockupChange> {
  let records;
  try {
    records = await Promise.all(
      (Array.isArray(input) ? input : [input]).map(async ({ image, thumbnail, ...metadata }) => ({
        metadata,
        image: await toStoredBinary(image),
        thumbnail: await toStoredBinary(thumbnail)
      }))
    );
  } catch (error) {
    throw new DatabaseError("Failed to read mockup files", error);
  }
  return write(["mockups", "mockup_blobs", "settings"], "Failed to add mockups", async (tx) => {
    const now = Date.now();
    const added: Mockup[] = [];
    for (const { metadata, image, thumbnail } of records) {
      const record = { ...metadata, thumbnail, id: generateId(), createdAt: now + added.length };
      await tx.objectStore("mockups").put(record);
      await tx.objectStore("mockup_blobs").put(image, record.id);
      added.push(toMockup(record));
    }
    if (activate && added.length) {
      await patchSettings(tx, "mockupOverlay", { activeMockupId: added[0].id, ...ACTIVATION_APPEARANCE });
      return { added, activeId: added[0].id, appearance: ACTIVATION_APPEARANCE };
    }
    return { added, activeId: await validMockupSelection(tx, preferredId), appearance: {} };
  });
}

async function validMockupSelection(tx: WriteTransaction, preferredId?: string | null): Promise<string | null> {
  const stored = settingsRecord(await tx.objectStore("settings").get("mockupOverlay"));
  let savedId = typeof stored.activeMockupId === "string" ? stored.activeMockupId : null;
  if (savedId !== null && !(await tx.objectStore("mockups").getKey(savedId))) savedId = null;
  if (savedId !== stored.activeMockupId) await patchSettings(tx, "mockupOverlay", { activeMockupId: savedId });
  if (preferredId === null) return null;
  if (preferredId !== undefined) return (await tx.objectStore("mockups").getKey(preferredId)) ? preferredId : null;
  return savedId;
}

export function selectMockup(id: string | null): Promise<MockupChange> {
  return write(["mockups", "settings"], "Failed to select mockup", async (tx) => {
    if (id !== null && !(await tx.objectStore("mockups").getKey(id))) throw new Error("Mockup not found.");
    const appearance = id !== null ? ACTIVATION_APPEARANCE : {};
    await patchSettings(tx, "mockupOverlay", { activeMockupId: id, ...appearance });
    return { added: [], activeId: id, appearance };
  });
}

export function deleteMockup(id: string, preferredId?: string | null): Promise<MockupChange> {
  return write(["mockups", "mockup_blobs", "settings"], "Failed to delete mockup", async (tx) => {
    await tx.objectStore("mockups").delete(id);
    await tx.objectStore("mockup_blobs").delete(id);
    return {
      added: [],
      activeId: await validMockupSelection(tx, preferredId === id ? null : preferredId),
      appearance: {}
    };
  });
}

export function resetMockups(): Promise<MockupChange> {
  return write(["mockups", "mockup_blobs", "settings"], "Failed to clear mockups", async (tx) => {
    await tx.objectStore("mockups").clear();
    await tx.objectStore("mockup_blobs").clear();
    await patchSettings(tx, "mockupOverlay", { activeMockupId: null });
    return { added: [], activeId: null, appearance: {} };
  });
}

/** Stored appearance is validated by its feature owner. */
export async function getSettings(group: SettingGroup): Promise<unknown> {
  try {
    return await (await getDB()).get("settings", group);
  } catch (error) {
    throw new DatabaseError("Failed to load settings", error);
  }
}

export function updateSettings<G extends SettingGroup>(
  group: G,
  changes: Partial<AppearanceSettings[G]>
): Promise<void> {
  return write(["settings"], "Failed to save settings", async (tx) => {
    if ("activeLayoutGridId" in changes || "activeMockupId" in changes) {
      throw new Error("Selections must be changed through library commands.");
    }
    await patchSettings(tx, group, changes);
  });
}
