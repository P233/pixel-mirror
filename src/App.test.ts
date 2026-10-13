/**
 * App tests against the real App.svelte (child components and stores are mocked)
 */

import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOUBLE_TAP_DELAY } from "~/constants";

vi.mock("~/components/Dock.svelte", () => ({ default: () => null }));
vi.mock("~/components/GridOverlay.svelte", () => ({ default: () => null }));
vi.mock("~/components/MockupOverlay.svelte", () => ({ default: () => null }));
vi.mock("~/components/Toast.svelte", () => ({ default: () => null }));

vi.mock("~/stores/dockStore.svelte", () => ({
  dockStore: { theme: "light" as Theme, isManagerMode: false }
}));

vi.mock("~/stores/mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: {
    isHidden: false,
    activeMockupUrl: "blob:mockup" as string | null,
    toggleMobileSolidMode: vi.fn()
  }
}));

vi.mock("~/stores/mockupManagerStore.svelte", () => ({
  mockupManagerStore: { uploadAndActivate: vi.fn() }
}));

vi.mock("~/utils/device", () => ({ isTouchDevice: vi.fn(() => false) }));

const stopApp = vi.fn();
vi.mock("~/bootstrap", () => ({ startApp: vi.fn(() => stopApp) }));

import App from "./App.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";
import { isTouchDevice } from "~/utils/device";
import { startApp } from "~/bootstrap";

const dock = dockStore as { theme: Theme; isManagerMode: boolean };
const overlay = mockupOverlayStore as {
  isHidden: boolean;
  activeMockupUrl: string | null;
  toggleMobileSolidMode: () => void;
};

function dragEvent(type: string, types: string[], files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types, files, dropEffect: "none" } });
  return event;
}

const imageFile = () => new File(["x"], "mockup.png", { type: "image/png" });

/** Render and wait for effects plus svelte/events' deferred touch listeners */
async function renderApp() {
  const result = render(App);
  await tick();
  await Promise.resolve();
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  dock.theme = "light";
  dock.isManagerMode = false;
  overlay.isHidden = false;
  overlay.activeMockupUrl = "blob:mockup";
  vi.mocked(isTouchDevice).mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  document.documentElement.style.touchAction = "";
});

describe("lifecycle", () => {
  it("starts the app on mount and stops it on unmount", async () => {
    const { unmount } = await renderApp();
    expect(startApp).toHaveBeenCalledTimes(1);

    unmount();
    expect(stopApp).toHaveBeenCalledTimes(1);
  });
});

describe("theme", () => {
  it.each<[Theme, boolean]>([
    ["light", false],
    ["dark", true]
  ])("applies the %s theme", async (theme, isDark) => {
    dock.theme = theme;
    const { container } = await renderApp();

    expect(container.querySelector(".theme-root")?.classList.contains("dark")).toBe(isDark);
  });
});

describe("drag-and-drop upload", () => {
  it("shows the drop zone while files are dragged over the page, across child elements", async () => {
    const { container } = await renderApp();
    const dropZone = () => container.querySelector(".drop-zone");

    document.body.dispatchEvent(dragEvent("dragenter", ["Files"]));
    document.body.dispatchEvent(dragEvent("dragenter", ["Files"])); // entering a child
    document.body.dispatchEvent(dragEvent("dragleave", ["Files"])); // leaving the child
    await tick();
    expect(dropZone()).toBeInTheDocument();

    document.body.dispatchEvent(dragEvent("dragleave", ["Files"]));
    await tick();
    expect(dropZone()).toBeNull();
  });

  it("ignores text drags", async () => {
    const { container } = await renderApp();

    document.body.dispatchEvent(dragEvent("dragenter", ["text/plain"]));
    await tick();

    expect(container.querySelector(".drop-zone")).toBeNull();
  });

  it("uploads and activates dropped image files", async () => {
    await renderApp();
    const file = imageFile();
    const event = dragEvent("drop", ["Files"], [file]);

    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mockupManagerStore.uploadAndActivate).toHaveBeenCalledWith([file]);
  });

  it("filters out non-image files", async () => {
    await renderApp();

    document.body.dispatchEvent(dragEvent("drop", ["Files"], [new File(["x"], "notes.txt", { type: "text/plain" })]));

    expect(mockupManagerStore.uploadAndActivate).not.toHaveBeenCalled();
  });

  it("does not cancel text drops onto host inputs", async () => {
    await renderApp();
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = dragEvent("drop", ["text/plain"]);

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(mockupManagerStore.uploadAndActivate).not.toHaveBeenCalled();
  });

  it("ignores file drops the host page already handled", async () => {
    await renderApp();
    const hostUploader = document.createElement("div");
    hostUploader.addEventListener("drop", (e) => e.preventDefault());
    document.body.appendChild(hostUploader);

    hostUploader.dispatchEvent(dragEvent("drop", ["Files"], [imageFile()]));

    expect(mockupManagerStore.uploadAndActivate).not.toHaveBeenCalled();
  });
});

describe("double tap on touch devices", () => {
  const touchEnd = (x = 100, y = 100) => {
    const event = new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      changedTouches: [{ identifier: 0, clientX: x, clientY: y } as Touch]
    });
    document.body.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.mocked(isTouchDevice).mockReturnValue(true);
  });

  it("toggles solid mode and swallows the second tap's click", async () => {
    await renderApp();

    touchEnd();
    const second = touchEnd();

    expect(overlay.toggleMobileSolidMode).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(true);
  });

  it("disables browser zoom gestures while the mockup is shown", async () => {
    await renderApp();

    expect(document.documentElement.style.touchAction).toBe("pan-x pan-y");
  });

  it("does nothing while a manager panel is open", async () => {
    dock.isManagerMode = true;
    await renderApp();

    touchEnd();
    touchEnd();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("does nothing without a visible mockup, and leaves browser zoom alone", async () => {
    overlay.activeMockupUrl = null;
    await renderApp();

    touchEnd();
    touchEnd();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
    expect(document.documentElement.style.touchAction).toBe("");
  });

  it("ignores a tap that comes right after scrolling", async () => {
    await renderApp();

    touchEnd();
    window.dispatchEvent(new Event("scroll"));
    touchEnd();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("ignores taps too far apart in time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await renderApp();

    touchEnd();
    vi.setSystemTime(Date.now() + DOUBLE_TAP_DELAY + 1);
    touchEnd();

    vi.useRealTimers();
    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("is not set up on devices without touch", async () => {
    vi.mocked(isTouchDevice).mockReturnValue(false);
    await renderApp();

    touchEnd();
    touchEnd();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });
});
