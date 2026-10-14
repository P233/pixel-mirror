/**
 * Centralized Keyboard Event Manager
 *
 * This store manages all keyboard events in one place, providing:
 * - State-aware event handling (respects app mode/state)
 * - Held keys (Control for wheel opacity, Space for solid mode) released on keyup,
 *   window blur or the tab being hidden; keyup is handled in every dock mode
 * - Prevention of event conflicts between components
 *
 * Event binding follows these rules:
 * - Events are only active when dock is in "toolbar" mode AND mockup is not hidden
 * - Events are disabled when dock enters "mockups" or "grids" manager modes
 * - Events are disabled when mockup overlay is hidden
 */

import { isTypingInField } from "~/platform/typing";
import { dockStore } from "./dockStore.svelte";
import { mockupOverlayStore } from "./mockupOverlayStore.svelte";

// Arrow key deltas for movement
const ARROW_KEY_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
};

function createKeyboardStore() {
  // Track held keys
  let isControlPressed = $state(false);
  let isSpacePressed = $state(false);

  // Track if keyboard manager is initialized
  let initialized = $state(false);

  // Wheel handler reference for cleanup
  let wheelHandler: ((e: WheelEvent) => void) | null = null;

  /**
   * Check if mockup overlay events should be active
   * Events are only active when:
   * - Dock is in toolbar mode
   * - A mockup is loaded and not hidden
   */
  function shouldHandleMockupEvents(): boolean {
    return dockStore.mode === "toolbar" && !mockupOverlayStore.isHidden && !!mockupOverlayStore.activeMockupUrl;
  }

  /**
   * Shortcut keys must not take over keys the host page or the browser needs:
   * keys the page already handled, IME composition, and browser/OS combos (Ctrl/Cmd/Alt + key)
   */
  function isReservedForHost(e: KeyboardEvent): boolean {
    return e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey;
  }

  /**
   * Handle wheel events for opacity adjustment (when Control is pressed)
   * Works in both visible and locked modes
   */
  function handleWheel(e: WheelEvent) {
    if (!shouldHandleMockupEvents()) return;
    const { mode } = mockupOverlayStore;
    if (mode !== "visible" && mode !== "locked") return;

    e.preventDefault();
    // Scrolling down makes the mockup more opaque
    mockupOverlayStore.stepOpacity(e.deltaY > 0 ? 1 : -1);
  }

  /**
   * Attach wheel listener
   */
  function attachWheelListener() {
    if (wheelHandler) return;
    wheelHandler = handleWheel;
    window.addEventListener("wheel", wheelHandler, { passive: false });
  }

  /**
   * Detach wheel listener
   */
  function detachWheelListener() {
    if (!wheelHandler) return;
    window.removeEventListener("wheel", wheelHandler);
    wheelHandler = null;
  }

  /**
   * Release held keys whose keyup may never arrive (window blur, hidden tab, cleanup)
   */
  function resetModifierStates() {
    if (isControlPressed) {
      isControlPressed = false;
      detachWheelListener();
    }

    if (isSpacePressed) {
      isSpacePressed = false;
      mockupOverlayStore.exitSolidMode();
    }
  }

  /**
   * Main keydown handler
   */
  function handleKeyDown(e: KeyboardEvent) {
    // Skip if focus is on input elements that need keyboard input
    if (isTypingInField(e)) return;

    // Track Control regardless of mockup state, for Ctrl+wheel opacity
    if (e.key === "Control") {
      if (!isControlPressed) {
        isControlPressed = true;
        attachWheelListener();
      }
      return;
    }

    // Allow Escape to close manager panels when not focused in an input
    if (dockStore.mode !== "toolbar") {
      if (e.key === "Escape" && !isReservedForHost(e)) {
        dockStore.enterToolbar();
      }
      return;
    }

    // Below events require mockup overlay to be active (toolbar mode)
    // In manager mode, let buttons respond to space key normally
    if (!shouldHandleMockupEvents() || isReservedForHost(e)) return;

    const { mode } = mockupOverlayStore;

    switch (e.key) {
      case " ":
        // Shift+Space scrolls the page up
        if (e.shiftKey) return;
        // Prevent space key default behavior (page scroll, button click)
        e.preventDefault();
        // Space: enter solid mode (only from visible or locked)
        if (!isSpacePressed && (mode === "visible" || mode === "locked")) {
          isSpacePressed = true;
          mockupOverlayStore.enterSolidMode();
        }
        break;

      case "Escape":
        // Escape: toggle lock (only in visible/locked mode); holding the key must not flip it repeatedly
        if (!e.repeat && (mode === "visible" || mode === "locked")) {
          mockupOverlayStore.toggleLock();
        }
        break;

      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight": {
        // Arrow keys: move mockup (only in visible mode)
        if (mode !== "visible") return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] = ARROW_KEY_DELTAS[e.key];
        mockupOverlayStore.move(dx * step, dy * step);
        break;
      }
    }
  }

  /**
   * Main keyup handler
   */
  function handleKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case " ":
        if (isSpacePressed) {
          isSpacePressed = false;
          mockupOverlayStore.exitSolidMode();
        }
        break;

      case "Control":
        if (isControlPressed) {
          isControlPressed = false;
          detachWheelListener();
        }
        break;
    }
  }

  /**
   * Handle visibility change - tab became hidden
   */
  function handleVisibilityChange() {
    if (document.hidden) {
      resetModifierStates();
    }
  }

  return {
    get isControlPressed() {
      return isControlPressed;
    },
    get isSpacePressed() {
      return isSpacePressed;
    },

    /**
     * Initialize the keyboard manager
     * Should be called once when the app mounts
     * Keyboard shortcuts are always enabled, even on touch devices with external keyboards
     */
    init: () => {
      if (initialized) return;
      initialized = true;

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("blur", resetModifierStates);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    },

    /**
     * Cleanup the keyboard manager
     * Should be called when the app unmounts
     */
    cleanup: () => {
      if (!initialized) return;

      initialized = false;

      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetModifierStates);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      // Cleanup any remaining listeners
      detachWheelListener();
      resetModifierStates();
    }
  };
}

export const keyboardStore = createKeyboardStore();
