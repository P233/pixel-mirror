import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dock from "./Dock.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { overlayController } from "~/features/overlay/controller.svelte";

vi.mock("./GridManager.svelte", () => ({ default: () => null }));
vi.mock("./MockupManager.svelte", () => ({ default: () => null }));
vi.mock("~/utils/device", () => ({ isLastInputTouch: () => true }));
vi.mock("~/platform/database", () => ({
  getSettings: vi.fn().mockResolvedValue(undefined),
  updateSettings: vi.fn().mockResolvedValue(undefined)
}));
vi.mock("~/features/overlay/controller.svelte", () => ({
  overlayController: {
    activeMockupId: "test-id",
    isHidden: false,
    isLocked: false,
    isDragging: false,
    isSolidOrZoomed: false,
    opacity: 0.5,
    scale: 1,
    alignmentX: "center",
    alignmentY: "top",
    positionDisplay: "0, 0",
    toggleVisibility: vi.fn(),
    toggleLock: vi.fn(),
    resetOpacity: vi.fn(),
    setOpacity: vi.fn(),
    cycleScale: vi.fn()
  }
}));

const pointer = (type: string, clientX: number) =>
  new PointerEvent(type, { pointerId: 1, pointerType: "touch", clientX, bubbles: true });

describe("Dock gesture lifecycle with the real dock store", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await dockStore.init();
    dockStore.enterToolbar();
  });

  afterEach(() => cleanup());

  it.each(["mockups", "grids"] as const)("retires the active slide when %s opens", async (mode) => {
    const { container } = render(Dock);
    const button = container.querySelector<HTMLButtonElement>("[data-testid='btn-opacity']")!;
    button.setPointerCapture = vi.fn();
    button.hasPointerCapture = vi.fn(() => true);
    button.releasePointerCapture = vi.fn();

    button.dispatchEvent(pointer("pointerdown", 100));
    button.dispatchEvent(pointer("pointermove", 120));
    expect(overlayController.setOpacity).toHaveBeenLastCalledWith(0.6);

    if (mode === "mockups") dockStore.enterMockups();
    else dockStore.enterGrids();
    await tick();
    expect(button).toBeDisabled();
    expect(button.releasePointerCapture).toHaveBeenCalledWith(1);
    vi.mocked(overlayController.setOpacity).mockClear();

    button.dispatchEvent(pointer("pointermove", 140));
    expect(overlayController.setOpacity).not.toHaveBeenCalled();

    dockStore.enterToolbar();
    await tick();
    button.dispatchEvent(pointer("pointermove", 160));
    button.dispatchEvent(pointer("pointerup", 160));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await tick();
    expect(overlayController.setOpacity).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-expanded", "false");

    button.dispatchEvent(pointer("pointerdown", 100));
    button.dispatchEvent(pointer("pointerup", 100));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    await tick();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});
