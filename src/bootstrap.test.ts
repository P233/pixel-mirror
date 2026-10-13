import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/stores/dockStore.svelte", () => ({ dockStore: { init: vi.fn() } }));
vi.mock("~/stores/gridManagerStore.svelte", () => ({ gridManagerStore: { init: vi.fn() } }));
vi.mock("~/stores/mockupManagerStore.svelte", () => ({ mockupManagerStore: { init: vi.fn() } }));
vi.mock("~/stores/mockupOverlayStore.svelte", () => ({ mockupOverlayStore: { init: vi.fn() } }));
vi.mock("~/stores/keyboardStore.svelte", () => ({ keyboardStore: { init: vi.fn(), cleanup: vi.fn() } }));
vi.mock("~/utils/device", () => ({ initInputTypeTracking: vi.fn() }));

import { startApp } from "./bootstrap";
import { dockStore } from "~/stores/dockStore.svelte";
import { gridManagerStore } from "~/stores/gridManagerStore.svelte";
import { keyboardStore } from "~/stores/keyboardStore.svelte";
import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";
import { initInputTypeTracking } from "~/utils/device";

describe("startApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every store and attaches the global listeners", () => {
    startApp();

    for (const store of [dockStore, mockupOverlayStore, gridManagerStore, mockupManagerStore]) {
      expect(store.init).toHaveBeenCalledTimes(1);
    }
    expect(keyboardStore.init).toHaveBeenCalledTimes(1);
    expect(initInputTypeTracking).toHaveBeenCalledTimes(1);
  });

  it("detaches the listeners when stopped, and can start again (remount)", () => {
    const stop = startApp();

    stop();
    expect(keyboardStore.cleanup).toHaveBeenCalledTimes(1);

    startApp();
    expect(keyboardStore.init).toHaveBeenCalledTimes(2);
  });
});
