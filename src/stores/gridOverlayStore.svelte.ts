/**
 * Grid Overlay Store
 *
 * Grid overlay display settings and the active layout grid.
 */

// Constants
import { DEFAULT_GRID_OVERLAY_SETTINGS } from "~/constants";
// Platform
import { createSettings } from "~/platform/settings.svelte";
// Database
import { getGrid } from "./database";
// Stores
import { toastStore } from "./toastStore.svelte";
// Utils
import { validateColor, validateCSSLength } from "~/utils/validation";

const DEFAULT_SETTINGS: GridOverlaySettings = { activeLayoutGridId: "", ...DEFAULT_GRID_OVERLAY_SETTINGS };

const isColor = (value: unknown) => typeof value === "string" && validateColor(value, "color").success;
const isLength = (value: unknown) => typeof value === "string" && validateCSSLength(value, "length").success;

function createGridOverlayStore() {
  const settings = createSettings("gridOverlay", DEFAULT_SETTINGS, {
    activeLayoutGridId: (value) => typeof value === "string",
    showLayoutGrid: (value) => typeof value === "boolean",
    layoutGridColor: isColor,
    showSpacingGrid: (value) => typeof value === "boolean",
    spacingGridColor: isColor,
    spacingGridHeight: isLength
  });

  let activeLayoutGridConfig = $state<LayoutGridConfig | undefined>(undefined);

  let initialized = $state(false);
  let initPromise: Promise<void> | null = null;

  // Incremented on every load so a slow, superseded load can't overwrite a newer one
  let loadToken = 0;

  async function loadActiveGrid(id: string) {
    const token = ++loadToken;
    if (!id) {
      activeLayoutGridConfig = undefined;
      return;
    }
    try {
      const grid = await getGrid(id);
      if (token !== loadToken) return;
      activeLayoutGridConfig = grid;
      if (!grid) {
        toastStore.showError(new Error("Grid not found."));
      }
    } catch (e) {
      if (token !== loadToken) return;
      activeLayoutGridConfig = undefined;
      toastStore.showError(e, "Failed to load grid");
    }
  }

  return {
    get activeLayoutGridId() {
      return settings.current.activeLayoutGridId;
    },
    get activeLayoutGrid() {
      return activeLayoutGridConfig;
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
    get initialized() {
      return initialized;
    },

    init: async () => {
      if (initialized || initPromise) return initPromise;

      initPromise = (async () => {
        try {
          await settings.load();
          await loadActiveGrid(settings.current.activeLayoutGridId);
        } catch (e) {
          toastStore.showError(e, "Failed to load grid overlay settings");
        } finally {
          initialized = true;
          initPromise = null;
        }
      })();

      return initPromise;
    },

    setActiveLayoutGrid: (id: string) => {
      settings.update({ activeLayoutGridId: id });
      return loadActiveGrid(id);
    },

    toggleLayoutGrid: () => {
      settings.update({ showLayoutGrid: !settings.current.showLayoutGrid });
    },

    toggleSpacingGrid: () => {
      settings.update({ showSpacingGrid: !settings.current.showSpacingGrid });
    },

    setLayoutGridColor: (color: string) => {
      settings.update({ layoutGridColor: color });
    },

    setSpacingGridColor: (color: string) => {
      settings.update({ spacingGridColor: color });
    },

    setSpacingGridHeight: (height: string) => {
      settings.update({ spacingGridHeight: height });
    },

    /** Back to the default settings, showing the given layout grid */
    reset: (activeLayoutGridId: string) => {
      settings.reset();
      settings.update({ activeLayoutGridId });
      return loadActiveGrid(activeLayoutGridId);
    }
  };
}

export const gridOverlayStore = createGridOverlayStore();
