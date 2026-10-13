/**
 * In-memory stand-in for ~/stores/database, for store tests:
 *
 *   vi.mock("./database", () => import("./__fixtures__/memoryDatabase"));
 *   const db = (await import("./database")) as unknown as typeof import("./__fixtures__/memoryDatabase");
 *
 * Every function is a vi.fn spy over a working implementation. Call resetMemoryDatabase()
 * in beforeEach; vi.resetModules() keeps the mocked module, so state is shared until reset.
 */

import { vi } from "vitest";

let grids = new Map<string, LayoutGridConfig>();
let mockups = new Map<string, Mockup>();
let images = new Map<string, Blob>();
let settings = new Map<SettingGroup, unknown>();
let nextId = 1;
let clock = 1000;

export function resetMemoryDatabase() {
  grids = new Map();
  mockups = new Map();
  images = new Map();
  settings = new Map();
  nextId = 1;
  clock = 1000;
  vi.clearAllMocks();
}

/** Stored settings, as a test fixture or to inspect what was saved */
export function storedSettings(group: SettingGroup): unknown {
  return settings.get(group);
}

export function storeSettings(group: SettingGroup, value: unknown) {
  settings.set(group, structuredClone(value));
}

export const getAllGrids = vi.fn(async () => [...grids.values()].sort((a, b) => a.createdAt - b.createdAt));
export const getGrid = vi.fn(async (id: string) => grids.get(id));
export const addGrid = vi.fn(async (input: GridInput) => {
  const id = `grid-${nextId++}`;
  grids.set(id, { ...input, id, createdAt: clock++ });
  return id;
});
export const deleteGrid = vi.fn(async (id: string) => void grids.delete(id));
export const resetGrids = vi.fn(async () => grids.clear());

export const getAllMockups = vi.fn(async () => [...mockups.values()].sort((a, b) => b.createdAt - a.createdAt));
export const getMockupImage = vi.fn(async (id: string) => images.get(id));
export const addMockups = vi.fn(async (input: MockupInput | MockupInput[]) =>
  (Array.isArray(input) ? input : [input]).map(({ image, ...metadata }) => {
    const id = `mockup-${nextId++}`;
    mockups.set(id, { ...metadata, id, createdAt: clock++ });
    images.set(id, image);
    return id;
  })
);
export const deleteMockup = vi.fn(async (id: string) => {
  mockups.delete(id);
  images.delete(id);
});
export const resetMockups = vi.fn(async () => {
  mockups.clear();
  images.clear();
});

export const getSettings = vi.fn(async (group: SettingGroup) => structuredClone(settings.get(group)));
export const saveSettings = vi.fn(async (group: SettingGroup, value: unknown) => storeSettings(group, value));
