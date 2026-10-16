/** Settings-only stand-in for appearance writer and Dock tests. */

import { vi } from "vitest";

let settings = new Map<SettingGroup, unknown>();

export function resetMemoryDatabase() {
  settings = new Map();
  vi.clearAllMocks();
}

/** Stored settings, as a test fixture or to inspect what was saved */
export function storedSettings(group: SettingGroup): unknown {
  return settings.get(group);
}

export function storeSettings(group: SettingGroup, value: unknown) {
  settings.set(group, structuredClone(value));
}

export const getSettings = vi.fn(async (group: SettingGroup) => structuredClone(settings.get(group)));
export const updateSettings = vi.fn(
  async <G extends SettingGroup>(group: G, changes: Partial<AppearanceSettings[G]>) => {
    const stored = settings.get(group);
    const previous = typeof stored === "object" && stored !== null && !Array.isArray(stored) ? stored : {};
    storeSettings(group, { ...previous, ...changes });
  }
);
