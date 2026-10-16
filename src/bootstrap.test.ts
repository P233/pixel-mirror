import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({
  gridListeners: new Set<(event: "commit" | "refresh") => void>(),
  mockupListeners: new Set<(event: "commit" | "refresh") => void>()
}));
vi.mock("~/stores/dockStore.svelte", () => ({ dockStore: { init: vi.fn() } }));
vi.mock("~/stores/gridStore.svelte", () => ({
  gridStore: {
    refresh: vi.fn().mockResolvedValue(undefined),
    subscribe: (listener: (event: "commit" | "refresh") => void) => {
      lifecycle.gridListeners.add(listener);
      return () => lifecycle.gridListeners.delete(listener);
    }
  }
}));
vi.mock("~/stores/mockupStore.svelte", () => ({
  mockupStore: {
    refresh: vi.fn().mockResolvedValue(undefined),
    subscribe: (listener: (event: "commit" | "refresh") => void) => {
      lifecycle.mockupListeners.add(listener);
      return () => lifecycle.mockupListeners.delete(listener);
    }
  }
}));
vi.mock("~/features/overlay/controller.svelte", () => ({
  overlayController: {
    sync: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn()
  }
}));
vi.mock("~/stores/keyboardStore.svelte", () => ({ keyboardStore: { init: vi.fn(), cleanup: vi.fn() } }));
vi.mock("~/utils/device", () => ({ initInputTypeTracking: vi.fn() }));

import { startApp } from "./bootstrap";
import { dockStore } from "~/stores/dockStore.svelte";
import { gridStore } from "~/stores/gridStore.svelte";
import { keyboardStore } from "~/stores/keyboardStore.svelte";
import { mockupStore } from "~/stores/mockupStore.svelte";
import { overlayController } from "~/features/overlay/controller.svelte";

class Channel {
  static instances: Channel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
  constructor() {
    Channel.instances.push(this);
  }
  receive(data: unknown) {
    this.onmessage?.({ data });
  }
}
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("startApp", () => {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    lifecycle.gridListeners.clear();
    lifecycle.mockupListeners.clear();
    Channel.instances = [];
    vi.stubGlobal("BroadcastChannel", Channel);
    vi.mocked(gridStore.refresh).mockResolvedValue(undefined);
    vi.mocked(mockupStore.refresh).mockResolvedValue(undefined);
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.unstubAllGlobals();
  });

  it("refreshes libraries on mount, attaches listeners and releases owned resources", async () => {
    stop = startApp();
    await settle();
    expect(dockStore.init).toHaveBeenCalledTimes(1);
    expect(gridStore.refresh).toHaveBeenCalledTimes(1);
    expect(mockupStore.refresh).toHaveBeenCalledTimes(1);
    expect(overlayController.sync).toHaveBeenCalledTimes(1);
    expect(keyboardStore.init).toHaveBeenCalledTimes(1);
    stop();
    stop = undefined;
    expect(lifecycle.gridListeners.size).toBe(0);
    expect(lifecycle.mockupListeners.size).toBe(0);
    expect(Channel.instances[0].close).toHaveBeenCalledTimes(1);
    expect(overlayController.cleanup).toHaveBeenCalledTimes(1);
    expect(keyboardStore.cleanup).toHaveBeenCalledTimes(1);
  });

  it("broadcasts committed library names, never read invalidations or appearance", async () => {
    stop = startApp();
    await settle();
    lifecycle.gridListeners.forEach((listener) => listener("commit"));
    lifecycle.mockupListeners.forEach((listener) => listener("commit"));
    lifecycle.gridListeners.forEach((listener) => listener("refresh"));
    lifecycle.mockupListeners.forEach((listener) => listener("refresh"));
    expect(Channel.instances[0].postMessage.mock.calls).toEqual([["grids"], ["mockups"]]);
  });

  it("refreshes only the notified library and ignores malformed messages", async () => {
    stop = startApp();
    await settle();
    Channel.instances[0].receive("grids");
    await settle();
    Channel.instances[0].receive({ activeId: "untrusted" });
    await settle();
    expect(gridStore.refresh).toHaveBeenCalledTimes(2);
    expect(mockupStore.refresh).toHaveBeenCalledTimes(1);
    expect(Channel.instances[0].postMessage).not.toHaveBeenCalled();
  });

  it("coalesces invalidations during a refresh into one subsequent refresh", async () => {
    stop = startApp();
    await settle();
    let release!: () => void;
    vi.mocked(gridStore.refresh).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    Channel.instances[0].receive("grids");
    for (let i = 0; i < 10; i++) Channel.instances[0].receive("grids");
    expect(gridStore.refresh).toHaveBeenCalledTimes(2);
    release();
    await settle();
    expect(gridStore.refresh).toHaveBeenCalledTimes(3);
  });

  it("refreshes on focus and remount and stops handling focus when unmounted", async () => {
    stop = startApp();
    await settle();
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(gridStore.refresh).toHaveBeenCalledTimes(2);
    expect(mockupStore.refresh).toHaveBeenCalledTimes(2);
    stop();
    stop = undefined;
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(dockStore.init).toHaveBeenCalledTimes(2);
    stop = startApp();
    await settle();
    expect(gridStore.refresh).toHaveBeenCalledTimes(3);
  });

  it("does not repopulate controller resources when an unmounted refresh completes", async () => {
    let release!: () => void;
    vi.mocked(mockupStore.refresh).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    stop = startApp();
    stop();
    stop = undefined;
    release();
    await settle();
    expect(overlayController.sync).not.toHaveBeenCalled();
  });

  it("retains focus/remount recovery without BroadcastChannel", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    stop = startApp();
    await settle();
    window.dispatchEvent(new Event("focus"));
    await settle();
    expect(mockupStore.refresh).toHaveBeenCalledTimes(2);
  });
});
