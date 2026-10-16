import { on } from "svelte/events";
import { overlayController } from "~/features/overlay/controller.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { gridStore } from "~/stores/gridStore.svelte";
import { keyboardStore } from "~/stores/keyboardStore.svelte";
import { mockupStore } from "~/stores/mockupStore.svelte";
import { initInputTypeTracking } from "~/utils/device";

type Library = "grids" | "mockups";

/** One invalidation channel and refresh loop per mount; libraries retain their local projections. */
export function startApp(): () => void {
  initInputTypeTracking();
  keyboardStore.init();
  let isStopped = false;
  let isRefreshing = false;
  const pending = new Set<Library>();
  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("pixel-mirror-libraries");
  } catch {
    // Focus/remount still refresh resources when the host disallows channels.
  }

  async function requestRefresh(libraries: Library[]) {
    for (const library of libraries) pending.add(library);
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      while (!isStopped && pending.size) {
        const refreshGrids = pending.delete("grids");
        const refreshMockups = pending.delete("mockups");
        await Promise.all([
          refreshGrids ? gridStore.refresh() : undefined,
          refreshMockups ? mockupStore.refresh() : undefined
        ]);
        if (!isStopped && refreshMockups) await overlayController.sync();
      }
    } finally {
      isRefreshing = false;
    }
  }

  function announce(library: Library, event: "commit" | "refresh") {
    if (event !== "commit") return;
    try {
      channel?.postMessage(library);
    } catch {
      // A committed command stays successful if cross-tab notification is unavailable.
    }
  }

  const stops = [
    gridStore.subscribe((event) => announce("grids", event)),
    mockupStore.subscribe((event) => {
      announce("mockups", event);
      if (event === "commit") void overlayController.sync();
    }),
    on(window, "focus", () => {
      void dockStore.init();
      void requestRefresh(["grids", "mockups"]);
    })
  ];
  if (channel) {
    channel.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (data === "grids" || data === "mockups") void requestRefresh([data]);
    };
  }
  void dockStore.init();
  void requestRefresh(["grids", "mockups"]);

  return () => {
    isStopped = true;
    pending.clear();
    stops.forEach((stop) => stop());
    channel?.close();
    overlayController.cleanup();
    keyboardStore.cleanup();
  };
}
