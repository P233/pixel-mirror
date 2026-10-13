/**
 * Grid Manager Store
 *
 * Handles layout grid CRUD operations and validates grid overlay settings
 * entered in the grid manager before applying them to the grid overlay.
 */

// Constants
import { DEFAULT_GRID_TEMPLATE } from "~/constants";
// Database
import { addGrid, deleteGrid, getAllGrids, resetGrids } from "./database";
// Stores
import { gridOverlayStore } from "./gridOverlayStore.svelte";
import { toastStore } from "./toastStore.svelte";
// Utils
import { validateColor, validateCSSLength, validateLayoutGridConfig, withDefaultUnit } from "~/utils/validation";

function createGridManagerStore() {
  let layoutGrids = $state<LayoutGridConfig[]>([]);

  let initialized = $state(false);
  let initPromise: Promise<void> | null = null;

  /** Add the default grid; used when there are no grids left */
  async function addDefaultGrid() {
    const id = await addGrid(DEFAULT_GRID_TEMPLATE);
    layoutGrids = await getAllGrids();
    return id;
  }

  return {
    get initialized() {
      return initialized;
    },
    get layoutGrids() {
      return layoutGrids;
    },

    init: async () => {
      if (initialized || initPromise) return initPromise;

      initPromise = (async () => {
        try {
          // The active grid id lives in the overlay settings
          await gridOverlayStore.init();

          layoutGrids = await getAllGrids();
          if (layoutGrids.length === 0) {
            await gridOverlayStore.setActiveLayoutGrid(await addDefaultGrid());
          } else if (!layoutGrids.some((g) => g.id === gridOverlayStore.activeLayoutGridId)) {
            await gridOverlayStore.setActiveLayoutGrid(layoutGrids[0].id);
          }
        } catch (e) {
          toastStore.showError(e, "Failed to load grids");
        } finally {
          initialized = true;
          initPromise = null;
        }
      })();

      return initPromise;
    },

    // Settings apply immediately; saving happens in the background (failures show a toast)

    toggleSpacingGrid: () => gridOverlayStore.toggleSpacingGrid(),

    updateSpacingGridHeight: (height: string) => {
      const validation = validateCSSLength(withDefaultUnit(height), "Spacing grid height");
      if (!validation.success) return toastStore.showError(validation.error);
      gridOverlayStore.setSpacingGridHeight(validation.data);
    },

    updateSpacingGridColor: (color: string) => {
      const validation = validateColor(color, "Spacing grid color");
      if (!validation.success) return toastStore.showError(validation.error);
      gridOverlayStore.setSpacingGridColor(validation.data);
    },

    toggleLayoutGrid: () => gridOverlayStore.toggleLayoutGrid(),

    updateLayoutGridColor: (color: string) => {
      const validation = validateColor(color, "Layout grid color");
      if (!validation.success) return toastStore.showError(validation.error);
      gridOverlayStore.setLayoutGridColor(validation.data);
    },

    setActiveLayoutGrid: (id: string) => gridOverlayStore.setActiveLayoutGrid(id),

    // CRUD operations use try/catch to ensure data consistency:
    // local state is only updated after database operation succeeds

    add: async (grid: GridInput) => {
      // Validate grid configuration
      const validation = validateLayoutGridConfig(grid);
      if (!validation.success) {
        toastStore.showError(validation.error);
        return undefined;
      }

      try {
        const id = await addGrid(validation.data);
        layoutGrids = await getAllGrids();
        await gridOverlayStore.setActiveLayoutGrid(id);
        return id;
      } catch (e) {
        toastStore.showError(e, "Failed to add grid");
        return undefined;
      }
    },

    delete: async (id: string) => {
      try {
        await deleteGrid(id);
        layoutGrids = layoutGrids.filter((g) => g.id !== id);

        if (gridOverlayStore.activeLayoutGridId === id) {
          const nextId = layoutGrids[0]?.id ?? (await addDefaultGrid());
          await gridOverlayStore.setActiveLayoutGrid(nextId);
        }
      } catch (e) {
        toastStore.showError(e, "Failed to delete grid");
      }
    },

    reset: async () => {
      try {
        await resetGrids();
        await gridOverlayStore.reset(await addDefaultGrid());
      } catch (e) {
        toastStore.showError(e, "Failed to reset grids");
      }
    }
  };
}

export const gridManagerStore = createGridManagerStore();
