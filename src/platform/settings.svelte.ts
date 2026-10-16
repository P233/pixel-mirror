import { getSettings, updateSettings } from "./database";
import { toastStore } from "~/stores/toastStore.svelte";

export type SettingsSchema<T> = { [K in keyof T]: (value: unknown) => boolean };

type Save = () => Promise<unknown>;
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- write bookkeeping is not rendered
const pendingSaves = new Set<Save>();
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- write bookkeeping is not rendered
const activeWrites = new Map<Save, { promise: Promise<unknown>; keys: PropertyKey[] }>();

/** Includes active writes and resource commits, even when no ordinary save is queued. */
export async function flushSettings(): Promise<void> {
  while (pendingSaves.size || activeWrites.size) {
    await Promise.allSettled([
      ...[...pendingSaves].map((save) => save()),
      ...[...activeWrites.values()].map(({ promise }) => promise)
    ]);
  }
}

export function pickValid<T>(stored: unknown, schema: SettingsSchema<T>): Partial<T> {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const valid: Partial<T> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const value = (stored as Record<PropertyKey, unknown>)[key];
    if (value !== undefined && schema[key](value)) valid[key] = value as T[keyof T];
  }
  return valid;
}

export function createSettings<G extends SettingGroup>(
  group: G,
  defaults: AppearanceSettings[G],
  schema: SettingsSchema<AppearanceSettings[G]>
) {
  type Settings = AppearanceSettings[G];
  const current = $state<Settings>({ ...defaults });
  let pendingChanges: Partial<Settings> | null = null;
  let changesDuringRead: Partial<Settings> | null = null;

  function finish(promise: Promise<unknown>) {
    if (activeWrites.get(save)?.promise !== promise) return;
    activeWrites.delete(save);
    if (pendingSaves.has(save)) queueMicrotask(() => void save());
  }

  function save(): Promise<unknown> {
    const active = activeWrites.get(save);
    if (active) return active.promise;
    if (!pendingSaves.delete(save) || pendingChanges === null) return Promise.resolve();
    const changes = $state.snapshot(pendingChanges) as Partial<Settings>;
    const keys = Object.keys(changes) as (keyof Settings)[];
    pendingChanges = null;
    const promise = updateSettings(group, changes)
      .catch((error) => {
        for (const key of keys) changes[key] = current[key];
        pendingChanges = { ...changes, ...pendingChanges };
        toastStore.showError(error, "Failed to save settings");
      })
      .finally(() => finish(promise));
    activeWrites.set(save, { promise, keys });
    return promise;
  }

  function update(changes: Partial<Settings>) {
    Object.assign(current, changes);
    if (changesDuringRead !== null) Object.assign(changesDuringRead, changes);
    pendingChanges = { ...pendingChanges, ...changes };
    pendingSaves.add(save);
    queueMicrotask(() => void save());
  }

  return {
    get current(): Readonly<Settings> {
      return current;
    },

    async load<R = undefined>(
      read: () => Promise<{ stored: unknown; result: R }> = async () => ({
        stored: await getSettings(group),
        result: undefined as R
      }),
      publish: (result: R) => void = () => {}
    ) {
      changesDuringRead = { ...pendingChanges };
      for (const key of (activeWrites.get(save)?.keys ?? []) as (keyof Settings)[]) {
        changesDuringRead[key] = current[key];
      }
      try {
        const { stored, result } = await read();
        Object.assign(current, { ...defaults, ...pickValid(stored, schema), ...changesDuringRead });
        publish(result);
      } finally {
        changesDuringRead = null;
      }
    },

    /** Resource queues serialize commits and loads; appearance edits remain immediate throughout. */
    async commit<R>(
      coveredFields: (keyof Settings)[],
      write: () => Promise<{ appearance: Partial<Settings>; result: R }>,
      publish: (result: R) => void
    ): Promise<R> {
      const previous = activeWrites.get(save)?.promise;
      changesDuringRead = {};
      const promise = (async () => {
        await previous;
        const { appearance, result } = await write();
        for (const key of coveredFields) if (pendingChanges) delete pendingChanges[key];
        pendingChanges = { ...pendingChanges, ...changesDuringRead };
        if (!Object.keys(pendingChanges).length) {
          pendingChanges = null;
          pendingSaves.delete(save);
        }
        Object.assign(current, { ...appearance, ...changesDuringRead });
        publish(result);
        return result;
      })().finally(() => {
        changesDuringRead = null;
        finish(promise);
      });
      activeWrites.set(save, { promise, keys: coveredFields });
      return promise;
    },

    update,
    reset: () => update({ ...defaults })
  };
}
