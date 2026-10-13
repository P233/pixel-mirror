/**
 * Persisted settings groups
 *
 * Each group is one reactive object. Changes apply locally right away and are written
 * to IndexedDB as a whole-group snapshot at the end of the task that made them, so
 * changes made together (e.g. alignment and position) become one write.
 *
 * Writes are deliberately not delayed: a write that only starts while the page unloads
 * (a reload, or a dev server's full reload) is aborted by the browser, so any delay is
 * a window in which changes get lost.
 *
 * Stored values are validated on load, so data from older versions can't break the app.
 */

import { getSettings, saveSettings } from "~/stores/database";
import { toastStore } from "~/stores/toastStore.svelte";

/** Per-field checks; stored fields that fail (or are missing) fall back to the defaults */
export type SettingsSchema<T> = { [K in keyof T]: (value: unknown) => boolean };

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping only, never rendered
const pendingSaves = new Set<() => Promise<void>>();

/** Write all queued changes now and wait for the writes (mainly for tests) */
export async function flushSettings(): Promise<void> {
  await Promise.all([...pendingSaves].map((save) => save()));
}

/** The stored fields that pass their check */
export function pickValid<T>(stored: unknown, schema: SettingsSchema<T>): Partial<T> {
  if (typeof stored !== "object" || stored === null) return {};

  const valid: Partial<T> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const value = (stored as Record<PropertyKey, unknown>)[key];
    if (value !== undefined && schema[key](value)) valid[key] = value as T[keyof T];
  }
  return valid;
}

export function createSettings<G extends SettingGroup>(
  group: G,
  defaults: AppSettings[G],
  schema: SettingsSchema<AppSettings[G]>
) {
  // Updated field by field, so readers of one setting don't re-run when another changes
  const current = $state<AppSettings[G]>({ ...defaults });
  let hasUnsavedChanges = false;

  async function save() {
    if (!hasUnsavedChanges) return;
    hasUnsavedChanges = false;
    pendingSaves.delete(save);
    try {
      await saveSettings(group, $state.snapshot(current) as AppSettings[G]);
    } catch (e) {
      toastStore.showError(e, "Failed to save settings");
    }
  }

  function scheduleSave() {
    // Already queued for the end of this task
    if (hasUnsavedChanges) return;
    hasUnsavedChanges = true;
    pendingSaves.add(save);
    queueMicrotask(() => void save());
  }

  return {
    get current(): Readonly<AppSettings[G]> {
      return current;
    },

    /** Replace the in-memory settings with the stored ones (invalid fields fall back to defaults) */
    async load() {
      Object.assign(current, defaults, pickValid(await getSettings(group), schema));
    },

    update(changes: Partial<AppSettings[G]>) {
      Object.assign(current, changes);
      scheduleSave();
    },

    reset() {
      Object.assign(current, defaults);
      scheduleSave();
    }
  };
}
