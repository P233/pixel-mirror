/**
 * App startup: loads every store and attaches the listeners on the host page.
 *
 * Called when the <pixel-mirror> element mounts; the returned function runs when it
 * unmounts. Stores keep their state, so mounting again (e.g. after the element was
 * removed and re-added) only re-attaches listeners.
 */

import { dockStore } from "~/stores/dockStore.svelte";
import { gridManagerStore } from "~/stores/gridManagerStore.svelte";
import { keyboardStore } from "~/stores/keyboardStore.svelte";
import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";
import { initInputTypeTracking } from "~/utils/device";

export function startApp(): () => void {
  initInputTypeTracking();
  keyboardStore.init();

  // Each store reports its own loading errors; the grid manager also loads the grid overlay
  void Promise.all([dockStore.init(), mockupOverlayStore.init(), gridManagerStore.init(), mockupManagerStore.init()]);

  return () => keyboardStore.cleanup();
}
