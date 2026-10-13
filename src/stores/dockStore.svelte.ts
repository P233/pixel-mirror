/**
 * Dock Store
 *
 * Manages the dock UI state machine with three modes:
 * - toolbar:  Main toolbar with quick actions
 * - mockups:  Mockup manager panel
 * - grids:    Grid manager panel
 *
 * When entering manager modes (mockups/grids), keyboard events for mockup
 * overlay are automatically disabled via the keyboardStore integration.
 */

// Platform
import { createSettings } from "~/platform/settings.svelte";
// Stores
import { keyboardStore } from "./keyboardStore.svelte";
import { toastStore } from "./toastStore.svelte";

export const DOCK_TRANSITION_DURATION = 250;

const DOCK_SIZES: Record<DockMode, Size> = {
  toolbar: { width: 380, height: 44 },
  mockups: { width: 820, height: 480 },
  grids: { width: 640, height: 580 }
};

const DEFAULT_DOCK_SETTINGS: DockSettings = { position: "bottom", theme: "light" };

function createDockStore() {
  const settings = createSettings("dock", DEFAULT_DOCK_SETTINGS, {
    position: (value) => value === "top" || value === "bottom",
    theme: (value) => value === "light" || value === "dark"
  });

  let mode = $state<DockMode>("toolbar");
  let managerVisible = $state(false);
  let toolbarVisible = $state(true);

  let initialized = $state(false);
  let initPromise: Promise<void> | null = null;

  return {
    get initialized() {
      return initialized;
    },
    get mode() {
      return mode;
    },
    get position() {
      return settings.current.position;
    },
    get theme() {
      return settings.current.theme;
    },
    get managerVisible() {
      return managerVisible;
    },
    set managerVisible(v) {
      managerVisible = v;
    },
    get toolbarVisible() {
      return toolbarVisible;
    },
    set toolbarVisible(v) {
      toolbarVisible = v;
    },
    get size() {
      return DOCK_SIZES[mode];
    },
    get isManagerMode() {
      return mode === "mockups" || mode === "grids";
    },

    init: async () => {
      if (initialized || initPromise) return initPromise;

      initPromise = (async () => {
        try {
          await settings.load();
        } catch (e) {
          toastStore.showError(e, "Failed to load dock settings");
        } finally {
          initialized = true;
          initPromise = null;
        }
      })();

      return initPromise;
    },

    enterToolbar: () => {
      managerVisible = false;
      mode = "toolbar";
      toolbarVisible = true;
      keyboardStore.resetModifierStates();
    },

    enterMockups: () => {
      keyboardStore.resetModifierStates();
      toolbarVisible = false;
      mode = "mockups";
      managerVisible = false;
    },

    enterGrids: () => {
      keyboardStore.resetModifierStates();
      toolbarVisible = false;
      mode = "grids";
      managerVisible = false;
    },

    togglePosition: () => {
      settings.update({ position: settings.current.position === "bottom" ? "top" : "bottom" });
    },

    toggleTheme: () => {
      settings.update({ theme: settings.current.theme === "light" ? "dark" : "light" });
    }
  };
}

export const dockStore = createDockStore();
