/**
 * Centralized Keyboard Event Manager
 *
 * This store manages all keyboard events in one place, providing:
 * - State-aware event handling (respects app mode/state)
 * - Proper cleanup on window blur/visibility change
 * - Modifier key tracking (Control, Shift, etc.)
 * - Prevention of event conflicts between components
 *
 * Event binding follows these rules:
 * - Events are only active when dock is in "toolbar" mode AND mockup is not hidden
 * - Events are disabled when dock enters "mockups" or "grids" manager modes
 * - Events are disabled when mockup overlay is hidden
 */

import { dockStore } from "./dockStore.svelte";
import { mockupOverlayStore } from "./mockupOverlayStore.svelte";

// Tags that need keyboard input (exclude BUTTON - we handle space key ourselves)
const INPUT_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

// Arrow key deltas for movement
const ARROW_KEY_DELTAS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
};

function createKeyboardStore() {
  // Track modifier key states
  let isControlPressed = $state(false);
  let isShiftPressed = $state(false);
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

  function isEditable(target: EventTarget | null | undefined): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return INPUT_TAGS.has(target.tagName) || target.isContentEditable;
  }

  /**
   * Check if the key event is meant for an element that needs keyboard input
   * (input, textarea, select, or contentEditable), including inside open shadow roots
   */
  function isFocusOnInputElement(e: KeyboardEvent): boolean {
    if (isEditable(e.composedPath()[0])) return true;

    let activeElement = document.activeElement;

    // Traverse Shadow DOM to find the actual focused element
    while (activeElement?.shadowRoot?.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    }

    return isEditable(activeElement);
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
    mockupOverlayStore.adjustOpacity(e.deltaY > 0 ? -1 : 1);
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
   * Reset all modifier states and cleanup temporary listeners
   * Called on window blur, visibility change, etc.
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

    isShiftPressed = false;
  }

  /**
   * Main keydown handler
   */
  function handleKeyDown(e: KeyboardEvent) {
    // Skip if focus is on input elements that need keyboard input
    if (isFocusOnInputElement(e)) return;

    // Track Control/Shift regardless of mockup state (for global shortcuts)
    switch (e.key) {
      case "Control":
        if (!isControlPressed) {
          isControlPressed = true;
          attachWheelListener();
        }
        return;

      case "Shift":
        isShiftPressed = true;
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
        // Escape: toggle lock (only in visible/locked mode)
        if (mode === "visible" || mode === "locked") {
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

      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        // Persist position after arrow key movement
        if (shouldHandleMockupEvents() && mockupOverlayStore.mode === "visible") {
          mockupOverlayStore.persistPosition();
        }
        break;

      case "Control":
        if (isControlPressed) {
          isControlPressed = false;
          detachWheelListener();
        }
        break;

      case "Shift":
        isShiftPressed = false;
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
    get isShiftPressed() {
      return isShiftPressed;
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
    },

    /**
     * Manually reset modifier states
     * Useful when app state changes significantly
     */
    resetModifierStates
  };
}

export const keyboardStore = createKeyboardStore();
