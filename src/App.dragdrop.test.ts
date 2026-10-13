/**
 * App drag-and-drop tests against the real App.svelte
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/components/Dock.svelte", () => ({ default: () => null }));
vi.mock("~/components/GridOverlay.svelte", () => ({ default: () => null }));
vi.mock("~/components/MockupOverlay.svelte", () => ({ default: () => null }));
vi.mock("~/components/Toast.svelte", () => ({ default: () => null }));

vi.mock("~/stores/dockStore.svelte", () => ({
  dockStore: { theme: "light", isManagerMode: false }
}));

vi.mock("~/stores/mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: { isHidden: false, activeMockupUrl: null, toggleMobileSolidMode: vi.fn() }
}));

vi.mock("~/stores/mockupManagerStore.svelte", () => ({
  mockupManagerStore: { uploadAndActivate: vi.fn() }
}));

vi.mock("~/utils/device", () => ({ isTouchDevice: () => false }));

import App from "./App.svelte";
import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";

function dragEvent(type: string, types: string[], files: File[] = []) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types, files, dropEffect: "none" } });
  return event;
}

const imageFile = () => new File(["x"], "mockup.png", { type: "image/png" });

describe("App drag-and-drop", () => {
  beforeEach(() => {
    vi.mocked(mockupManagerStore.uploadAndActivate).mockClear();
    render(App);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("uploads and activates dropped image files", () => {
    const file = imageFile();
    const event = dragEvent("drop", ["Files"], [file]);

    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mockupManagerStore.uploadAndActivate).toHaveBeenCalledWith([file]);
  });

  it("does not cancel text drops onto host inputs", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = dragEvent("drop", ["text/plain"]);

    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(mockupManagerStore.uploadAndActivate).not.toHaveBeenCalled();
  });

  it("ignores file drops the host page already handled", () => {
    const hostUploader = document.createElement("div");
    hostUploader.addEventListener("drop", (e) => e.preventDefault());
    document.body.appendChild(hostUploader);

    hostUploader.dispatchEvent(dragEvent("drop", ["Files"], [imageFile()]));

    expect(mockupManagerStore.uploadAndActivate).not.toHaveBeenCalled();
  });
});
