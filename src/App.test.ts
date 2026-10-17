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

vi.mock("~/features/overlay/controller.svelte", () => ({
  overlayController: {
    isHidden: false,
    activeMockupUrl: "blob:mockup" as string | null,
    toggleMobileSolidMode: vi.fn()
  }
}));

vi.mock("~/stores/mockupStore.svelte", () => ({
  mockupStore: { uploadAndActivate: vi.fn() }
}));

vi.mock("~/utils/device", () => ({ isTouchDevice: vi.fn(() => false) }));

const stopApp = vi.fn();
vi.mock("~/bootstrap", () => ({ startApp: vi.fn(() => stopApp) }));

import App from "./App.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { mockupStore } from "~/stores/mockupStore.svelte";
import { overlayController } from "~/features/overlay/controller.svelte";
import { isTouchDevice } from "~/utils/device";
import { startApp } from "~/bootstrap";

const dock = dockStore as { theme: Theme; isManagerMode: boolean };
const overlay = overlayController as {
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
    expect(mockupStore.uploadAndActivate).toHaveBeenCalledWith([file]);
  });

  it("filters out non-image files", async () => {
    await renderApp();

    document.body.dispatchEvent(dragEvent("drop", ["Files"], [new File(["x"], "notes.txt", { type: "text/plain" })]));

    expect(mockupStore.uploadAndActivate).not.toHaveBeenCalled();
  });

  it("does not cancel text drops onto host inputs", async () => {
    await renderApp();
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = dragEvent("drop", ["text/plain"]);

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(mockupStore.uploadAndActivate).not.toHaveBeenCalled();
  });

  it("leaves file drags over a host file input to the input", async () => {
    const { container } = await renderApp();
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    document.body.appendChild(fileInput);
    const dragOver = dragEvent("dragover", ["Files"]);
    const drop = dragEvent("drop", ["Files"], [imageFile()]);

    fileInput.dispatchEvent(dragEvent("dragenter", ["Files"]));
    fileInput.dispatchEvent(dragOver);
    await tick();
    expect(container.querySelector(".drop-zone")).toBeNull();
    fileInput.dispatchEvent(drop);

    expect(dragOver.defaultPrevented).toBe(false);
    expect(drop.defaultPrevented).toBe(false);
    expect(mockupStore.uploadAndActivate).not.toHaveBeenCalled();
    fileInput.remove();
  });

  it("ignores file drops the host page already handled", async () => {
    await renderApp();
    const hostUploader = document.createElement("div");
    hostUploader.addEventListener("drop", (e) => e.preventDefault());
    document.body.appendChild(hostUploader);

    hostUploader.dispatchEvent(dragEvent("drop", ["Files"], [imageFile()]));

    expect(mockupStore.uploadAndActivate).not.toHaveBeenCalled();
  });
});

describe("double tap on touch devices", () => {
  const touchEvent = (
    type: string,
    points: Position[],
    changed: Position[] = points,
    target: EventTarget = document.body
  ) => {
    const touches = (values: Position[]) =>
      values.map(({ x, y }, identifier) => ({ identifier, clientX: x, clientY: y }) as Touch);
    const event = new TouchEvent(type, {
      bubbles: true,
      composed: true,
      cancelable: true,
      touches: touches(points),
      changedTouches: touches(changed)
    });
    target.dispatchEvent(event);
    return event;
  };

  const tap = (x = 100, y = 100, target: EventTarget = document.body) => {
    touchEvent("touchstart", [{ x, y }], undefined, target);
    return touchEvent("touchend", [], [{ x, y }], target);
  };

  beforeEach(() => {
    vi.mocked(isTouchDevice).mockReturnValue(true);
  });

  it("toggles solid mode and swallows the second tap's click", async () => {
    await renderApp();

    tap();
    const second = tap();

    expect(overlay.toggleMobileSolidMode).toHaveBeenCalledTimes(1);
    expect(second.defaultPrevented).toBe(true);
  });

  it.each(["button", "input", "select", "textarea", "a"])(
    "leaves repeated taps on a %s inside the tool's shadow root to the control",
    async (tag) => {
      await renderApp();
      const host = document.createElement("pixel-mirror");
      const root = host.attachShadow({ mode: "open" });
      const control = document.createElement(tag);
      if (tag === "a") control.setAttribute("href", "#");
      root.appendChild(control);
      document.body.appendChild(host);

      tap(100, 100, control);
      const second = tap(100, 100, control);

      expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
      expect(second.defaultPrevented).toBe(false);
    }
  );

  it("cancels page tap history when a nested button icon is touched", async () => {
    await renderApp();
    const button = document.createElement("button");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    button.appendChild(icon);
    document.body.appendChild(button);

    tap();
    tap(100, 100, icon);
    tap();
    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();

    tap();
    expect(overlay.toggleMobileSolidMode).toHaveBeenCalledTimes(1);
  });

  it("disables browser zoom gestures while the mockup is shown", async () => {
    await renderApp();

    expect(document.documentElement.style.touchAction).toBe("pan-x pan-y");
  });

  it("restores the host's inline touch-action and its priority on unmount", async () => {
    document.documentElement.style.setProperty("touch-action", "manipulation", "important");
    const { unmount } = await renderApp();
    expect(document.documentElement.style.touchAction).toBe("pan-x pan-y");

    unmount();

    expect(document.documentElement.style.touchAction).toBe("manipulation");
    expect(document.documentElement.style.getPropertyPriority("touch-action")).toBe("important");
  });

  it("preserves a touch-action change made by the host while the tool is active", async () => {
    const { unmount } = await renderApp();
    document.documentElement.style.touchAction = "none";

    unmount();

    expect(document.documentElement.style.touchAction).toBe("none");
  });

  it("does not count a drag ending beside a tap as a double tap", async () => {
    await renderApp();
    tap();
    touchEvent("touchstart", [{ x: 180, y: 180 }]);
    touchEvent("touchmove", [{ x: 100, y: 100 }]);
    touchEvent("touchend", [], [{ x: 100, y: 100 }]);

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
    tap();
    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
    tap();
    expect(overlay.toggleMobileSolidMode).toHaveBeenCalledTimes(1);
  });

  it("does not count a multi-touch gesture as a tap", async () => {
    await renderApp();
    tap();
    touchEvent("touchstart", [{ x: 100, y: 100 }]);
    touchEvent("touchstart", [
      { x: 100, y: 100 },
      { x: 200, y: 200 }
    ]);
    touchEvent("touchend", [{ x: 100, y: 100 }], [{ x: 200, y: 200 }]);
    touchEvent("touchend", [], [{ x: 100, y: 100 }]);

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("cancels tap history when the browser cancels a touch", async () => {
    await renderApp();
    tap();
    touchEvent("touchstart", [{ x: 100, y: 100 }]);
    touchEvent("touchcancel", [], [{ x: 100, y: 100 }]);
    tap();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("does nothing while a manager panel is open", async () => {
    dock.isManagerMode = true;
    await renderApp();

    tap();
    tap();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("does nothing without a visible mockup, and leaves browser zoom alone", async () => {
    overlay.activeMockupUrl = null;
    await renderApp();

    tap();
    tap();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
    expect(document.documentElement.style.touchAction).toBe("");
  });

  it("ignores a tap that comes right after scrolling", async () => {
    await renderApp();

    tap();
    window.dispatchEvent(new Event("scroll"));
    tap();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("ignores taps too far apart in time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await renderApp();

    tap();
    vi.setSystemTime(Date.now() + DOUBLE_TAP_DELAY + 1);
    tap();

    vi.useRealTimers();
    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });

  it("is not set up on devices without touch", async () => {
    vi.mocked(isTouchDevice).mockReturnValue(false);
    await renderApp();

    tap();
    tap();

    expect(overlay.toggleMobileSolidMode).not.toHaveBeenCalled();
  });
});
