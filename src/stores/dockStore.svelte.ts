/**
 * Dock Store
 *
 * Manages the dock UI state machine with three modes:
 * - toolbar:  Main toolbar with quick actions
 * - mockups:  Mockup manager panel
 * - grids:    Grid manager panel
 *
 * keyboardStore reads the mode and ignores overlay shortcuts outside toolbar mode.
 */

// Platform
import { createSettings } from "~/platform/settings.svelte";
// Stores
import { toastStore } from "./toastStore.svelte";

function getSystemMediaQuery(): MediaQueryList | null {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)");
  }
  return null;
}

const DEFAULT_DOCK_SETTINGS: DockSettings = { position: "bottom", theme: null };

function createDockStore() {
  const settings = createSettings("dock", DEFAULT_DOCK_SETTINGS, {
    position: (value) => value === "top" || value === "bottom",
    theme: (value) => value === null || value === "light" || value === "dark"
  });

  const mediaQuery = getSystemMediaQuery();
  let systemTheme = $state<Theme>(mediaQuery?.matches ? "dark" : "light");

  if (mediaQuery && typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", (e: MediaQueryListEvent) => {
      systemTheme = e.matches ? "dark" : "light";
      if (settings.current.theme !== null) {
        settings.update({ theme: null });
      }
    });
  }

  let mode = $state<DockMode>("toolbar");

  let initialization = $state<"pending" | "ready" | "failed">("pending");
  let initPromise: Promise<void> | null = null;

  const effectiveTheme = $derived<Theme>(settings.current.theme ?? systemTheme);

  return {
    get initialized() {
      return initialization !== "pending";
    },
    get mode() {
      return mode;
    },
    get position() {
      return settings.current.position;
    },
    get theme(): Theme {
      return effectiveTheme;
    },
    get isManagerMode() {
      return mode === "mockups" || mode === "grids";
    },

    init: async () => {
      if (initialization === "ready" || initPromise) return initPromise;

      initPromise = (async () => {
        try {
          await settings.load();
          initialization = "ready";
        } catch (e) {
          initialization = "failed";
          toastStore.showError(e, "Failed to load dock settings");
        } finally {
          initPromise = null;
        }
      })();

      return initPromise;
    },

    enterToolbar: () => {
      mode = "toolbar";
    },

    enterMockups: () => {
      mode = "mockups";
    },

    enterGrids: () => {
      mode = "grids";
    },

    togglePosition: () => {
      settings.update({ position: settings.current.position === "bottom" ? "top" : "bottom" });
    },

    toggleTheme: () => {
      settings.update({ theme: effectiveTheme === "light" ? "dark" : "light" });
    }
  };
}

export const dockStore = createDockStore();
