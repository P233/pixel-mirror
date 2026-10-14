import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { observePageSize } from "./viewport";

describe("observePageSize", () => {
  let contentHeight: number;
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    contentHeight = 3000;
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => contentHeight);
  });

  afterEach(() => {
    stop?.();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const lastHeight = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.lastCall?.[0].height;

  it("measures right away", () => {
    const onChange = vi.fn();
    stop = observePageSize(onChange);

    expect(lastHeight(onChange)).toBe(3000);
  });

  // html/body with a fixed height (e.g. 100%) don't resize when the content overflowing them changes
  it("re-measures after DOM changes that don't resize html or body", async () => {
    const onChange = vi.fn();
    stop = observePageSize(onChange);

    contentHeight = 300;
    document.body.append(document.createElement("div"));
    await vi.runAllTimersAsync();

    expect(lastHeight(onChange)).toBe(300);
  });

  it("re-measures after host resources load or transitions end", async () => {
    const onChange = vi.fn();
    stop = observePageSize(onChange);
    const image = document.createElement("img");
    document.body.append(image);
    await vi.runAllTimersAsync();

    contentHeight = 4000;
    image.dispatchEvent(new Event("load"));
    await vi.runAllTimersAsync();
    expect(lastHeight(onChange)).toBe(4000);

    contentHeight = 500;
    document.body.dispatchEvent(new Event("transitionend", { bubbles: true }));
    await vi.runAllTimersAsync();
    expect(lastHeight(onChange)).toBe(500);
  });

  it("coalesces a burst of changes into one measurement", async () => {
    const onChange = vi.fn();
    stop = observePageSize(onChange);
    onChange.mockClear();

    for (let i = 0; i < 20; i++) document.body.append(document.createElement("span"));
    await vi.runAllTimersAsync();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("stops observing", async () => {
    const onChange = vi.fn();
    stop = observePageSize(onChange);
    stop();
    stop = undefined;
    onChange.mockClear();

    document.body.append(document.createElement("div"));
    window.dispatchEvent(new Event("resize"));
    await vi.runAllTimersAsync();

    expect(onChange).not.toHaveBeenCalled();
  });
});
