/**
 * Toast tests with the real (reactive) toast store.
 */

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toast from "./Toast.svelte";
import { toastStore } from "~/stores/toastStore.svelte";

describe("Toast with the real store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    toastStore.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("auto-dismisses the next toast after one was dismissed while hovered", async () => {
    const { container } = render(Toast);

    toastStore.showError(new Error("first"));
    await tick();
    await fireEvent.mouseEnter(container.querySelector(".toast")!);
    // Dismissing removes the toast without a mouseleave
    window.dispatchEvent(new MouseEvent("mousedown"));
    await tick();
    expect(toastStore.errorMessage).toBeUndefined();

    toastStore.showError(new Error("second"));
    await tick();
    await vi.advanceTimersByTimeAsync(5000);

    expect(toastStore.errorMessage).toBeUndefined();
  });
});
