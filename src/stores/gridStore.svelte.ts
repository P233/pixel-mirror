import { DEFAULT_GRID_OVERLAY_SETTINGS } from "~/constants";
import { addGrid, deleteGrid, readGridLibrary, resetGrids, selectGrid, type GridLibrary } from "~/platform/database";
import { createSettings } from "~/platform/settings.svelte";
import { constrainColorOpacity } from "~/utils/color";
import {
  validateColor,
  validateLayoutGridConfig,
  validateSpacingGridHeight,
  withDefaultUnit
} from "~/utils/validation";
import { toastStore } from "./toastStore.svelte";

const isColor = (value: unknown) => typeof value === "string" && validateColor(value, "color").success;

function createGridStore() {
  const settings = createSettings("gridOverlay", DEFAULT_GRID_OVERLAY_SETTINGS, {
    showLayoutGrid: (value) => typeof value === "boolean",
    layoutGridColor: isColor,
    showSpacingGrid: (value) => typeof value === "boolean",
    spacingGridColor: isColor,
    spacingGridHeight: (value) => typeof value === "string" && validateSpacingGridHeight(value).success
  });
  let layoutGrids = $state<LayoutGridConfig[]>([]);
  let activeLayoutGridId = $state("");
  const activeLayoutGrid = $derived(layoutGrids.find((grid) => grid.id === activeLayoutGridId));
  let initialization = $state<"pending" | "ready" | "failed">("pending");
  let isResetting = $state(false);
  let hasLoaded = false;
  let tail = Promise.resolve();
  let loadPromise: Promise<void> | null = null;
  let resetPromise: Promise<boolean | undefined> | null = null;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- lifecycle subscribers are not rendered
  const listeners = new Set<(event: "commit" | "refresh") => void>();

  function enqueue<R>(operation: () => Promise<R>, message: string): Promise<R | undefined> {
    const result = tail.then(operation).catch((error) => {
      toastStore.showError(error, message);
      return undefined;
    });
    tail = result.then(() => {});
    return result;
  }

  function publish(library: GridLibrary, event: "commit" | "refresh") {
    layoutGrids = library.items;
    activeLayoutGridId = library.activeId;
    for (const listener of listeners) listener(event);
  }

  function refresh(): Promise<void> {
    if (loadPromise) return loadPromise;
    loadPromise = enqueue(async () => {
      try {
        await settings.load(
          async () => {
            const library = await readGridLibrary(hasLoaded ? activeLayoutGridId : undefined);
            return { stored: hasLoaded ? settings.current : library.stored, result: library };
          },
          (library) => publish(library, "refresh")
        );
        const changes: Partial<GridAppearanceSettings> = {};
        for (const key of ["layoutGridColor", "spacingGridColor"] as const) {
          const color = constrainColorOpacity(settings.current[key]);
          if (color !== settings.current[key]) changes[key] = color;
        }
        if (Object.keys(changes).length) settings.update(changes);
        hasLoaded = true;
        initialization = "ready";
      } catch (error) {
        initialization = "failed";
        throw error;
      }
    }, "Failed to load grids")
      .then(() => {})
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  }

  function commit(write: () => Promise<GridLibrary>, reset = false) {
    return settings.commit(
      reset ? (Object.keys(DEFAULT_GRID_OVERLAY_SETTINGS) as (keyof GridAppearanceSettings)[]) : [],
      async () => ({ appearance: reset ? DEFAULT_GRID_OVERLAY_SETTINGS : {}, result: await write() }),
      (library) => publish(library, "commit")
    );
  }

  function updateColor(key: "layoutGridColor" | "spacingGridColor", color: string) {
    const validation = validateColor(color, key === "layoutGridColor" ? "Layout grid color" : "Spacing grid color");
    if (!validation.success) return toastStore.showError(validation.error);
    settings.update({ [key]: constrainColorOpacity(validation.data) });
  }

  return {
    get initialized() {
      return initialization !== "pending";
    },
    get layoutGrids() {
      return layoutGrids;
    },
    get activeLayoutGridId() {
      return activeLayoutGridId;
    },
    get activeLayoutGrid() {
      return activeLayoutGrid;
    },
    get showLayoutGrid() {
      return settings.current.showLayoutGrid;
    },
    get layoutGridColor() {
      return settings.current.layoutGridColor;
    },
    get showSpacingGrid() {
      return settings.current.showSpacingGrid;
    },
    get spacingGridColor() {
      return settings.current.spacingGridColor;
    },
    get spacingGridHeight() {
      return settings.current.spacingGridHeight;
    },
    get isResetting() {
      return isResetting;
    },
    init: () => (initialization === "ready" ? Promise.resolve() : refresh()),
    refresh,
    subscribe(listener: (event: "commit" | "refresh") => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    toggleLayoutGrid: () => settings.update({ showLayoutGrid: !settings.current.showLayoutGrid }),
    toggleSpacingGrid: () => settings.update({ showSpacingGrid: !settings.current.showSpacingGrid }),
    updateLayoutGridColor: (color: string) => updateColor("layoutGridColor", color),
    updateSpacingGridColor: (color: string) => updateColor("spacingGridColor", color),
    updateSpacingGridHeight(height: string) {
      const validation = validateSpacingGridHeight(withDefaultUnit(height));
      if (!validation.success) return toastStore.showError(validation.error);
      settings.update({ spacingGridHeight: validation.data });
    },
    setActiveLayoutGrid: (id: string) => enqueue(() => commit(() => selectGrid(id)), "Failed to select grid"),
    add(grid: GridInput) {
      const validation = validateLayoutGridConfig(grid);
      if (!validation.success) {
        toastStore.showError(validation.error);
        return Promise.resolve(undefined);
      }
      return enqueue(async () => (await commit(() => addGrid(validation.data))).activeId, "Failed to add grid");
    },
    delete: (id: string) => enqueue(() => commit(() => deleteGrid(id, activeLayoutGridId)), "Failed to delete grid"),
    reset(): Promise<boolean | undefined> {
      if (resetPromise) return resetPromise;
      isResetting = true;
      resetPromise = enqueue(async () => {
        await commit(resetGrids, true);
        return true;
      }, "Failed to reset grids").finally(() => {
        isResetting = false;
        resetPromise = null;
      });
      return resetPromise;
    }
  };
}

export const gridStore = createGridStore();
