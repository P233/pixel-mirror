/**
 * Dock Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dock from "./Dock.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { overlayController } from "~/features/overlay/controller.svelte";

// Mock sub-components
vi.mock("./GridManager.svelte", () => ({ default: () => null }));
vi.mock("./MockupManager.svelte", () => ({ default: () => null }));

// Mock device detection (return false for desktop tests)
vi.mock("~/utils/device", () => ({
  isTouchDevice: vi.fn(() => false),
  isLastInputTouch: vi.fn(() => false)
}));

// Mock stores
vi.mock("~/stores/dockStore.svelte", () => ({
  dockStore: {
    initialized: true,
    mode: "toolbar" as "toolbar" | "mockups" | "grids",
    isManagerMode: false,
    position: "bottom" as "top" | "bottom",
    theme: "dark" as "dark" | "light",
    init: vi.fn(),
    enterToolbar: vi.fn(),
    enterMockups: vi.fn(),
    enterGrids: vi.fn(),
    togglePosition: vi.fn(),
    toggleTheme: vi.fn()
  }
}));

vi.mock("~/features/overlay/controller.svelte", () => ({
  overlayController: {
    activeMockupId: "test-id",
    mode: "visible" as "visible" | "locked" | "dragging" | "solid" | "zoomed",
    isHidden: false,
    isLocked: false,
    isDragging: false,
    isSolidOrZoomed: false,
    opacity: 0.5,
    scale: 1,
    position: { x: 100, y: 200 },
    alignmentX: "center" as "left" | "center" | "right",
    alignmentY: "top" as "top" | "bottom",
    positionDisplay: "100, 200",
    toggleVisibility: vi.fn(),
    toggleLock: vi.fn(),
    resetOpacity: vi.fn(),
    setOpacity: vi.fn(),
    cycleScale: vi.fn(),
    setAlignment: vi.fn()
  }
}));

import { isLastInputTouch, isTouchDevice } from "~/utils/device";

// Get typed references to mocks
const mockDockStore = dockStore as unknown as {
  initialized: boolean;
  mode: "toolbar" | "mockups" | "grids";
  isManagerMode: boolean;
  position: "top" | "bottom";
  theme: "dark" | "light";
  init: ReturnType<typeof vi.fn>;
  enterToolbar: ReturnType<typeof vi.fn>;
  enterMockups: ReturnType<typeof vi.fn>;
  enterGrids: ReturnType<typeof vi.fn>;
  togglePosition: ReturnType<typeof vi.fn>;
  toggleTheme: ReturnType<typeof vi.fn>;
};

const mockMockupStore = overlayController as unknown as {
  activeMockupId: string | null;
  mode: "visible" | "locked" | "dragging" | "solid" | "zoomed";
  isHidden: boolean;
  isLocked: boolean;
  isDragging: boolean;
  isSolidOrZoomed: boolean;
  opacity: number;
  scale: number;
  position: { x: number; y: number };
  alignmentX: "left" | "center" | "right";
  alignmentY: "top" | "bottom";
  positionDisplay: string;
  toggleVisibility: ReturnType<typeof vi.fn>;
  toggleLock: ReturnType<typeof vi.fn>;
  resetOpacity: ReturnType<typeof vi.fn>;
  setOpacity: ReturnType<typeof vi.fn>;
  cycleScale: ReturnType<typeof vi.fn>;
  setAlignment: ReturnType<typeof vi.fn>;
};

const mockIsTouchDevice = isTouchDevice as ReturnType<typeof vi.fn>;
const mockIsLastInputTouch = isLastInputTouch as ReturnType<typeof vi.fn>;

describe("Dock component", () => {
  beforeEach(() => {
    mockDockStore.initialized = true;
    mockDockStore.mode = "toolbar";
    mockDockStore.isManagerMode = false;
    mockDockStore.position = "bottom";
    mockDockStore.theme = "dark";
    mockDockStore.init.mockClear();
    mockDockStore.enterToolbar.mockClear();
    mockDockStore.enterMockups.mockClear();
    mockDockStore.enterGrids.mockClear();
    mockDockStore.togglePosition.mockClear();
    mockDockStore.toggleTheme.mockClear();

    mockMockupStore.activeMockupId = "test-id";
    mockMockupStore.mode = "visible";
    mockMockupStore.isHidden = false;
    mockMockupStore.isLocked = false;
    mockMockupStore.isDragging = false;
    mockMockupStore.isSolidOrZoomed = false;
    mockMockupStore.opacity = 0.5;
    mockMockupStore.scale = 1;
    mockMockupStore.position = { x: 100, y: 200 };
    mockMockupStore.alignmentX = "center";
    mockMockupStore.alignmentY = "top";
    mockMockupStore.positionDisplay = "100, 200";
    mockMockupStore.toggleVisibility.mockClear();
    mockMockupStore.toggleLock.mockClear();
    mockMockupStore.resetOpacity.mockClear();
    mockMockupStore.setOpacity.mockClear();
    mockMockupStore.cycleScale.mockClear();
    mockMockupStore.setAlignment.mockClear();
    mockIsTouchDevice.mockReturnValue(false);
    mockIsLastInputTouch.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe("visibility and inspect HUD", () => {
    it("renders .dock when initialized", () => {
      mockDockStore.initialized = true;
      const { container } = render(Dock);

      expect(container.querySelector(".dock")).toBeInTheDocument();
    });

    it("has hidden attribute when not initialized", () => {
      mockDockStore.initialized = false;
      const { container } = render(Dock);

      const dock = container.querySelector(".dock") as HTMLElement;
      expect(dock.hidden).toBe(true);
    });

    it("hides main dock and shows floating inspect HUD when isSolidOrZoomed", () => {
      mockMockupStore.isSolidOrZoomed = true;
      mockMockupStore.mode = "zoomed";
      const { container } = render(Dock);

      const dock = container.querySelector(".dock") as HTMLElement;
      expect(dock.hidden).toBe(true);

      const inspectHud = container.querySelector("[data-testid='inspect-hud']");
      expect(inspectHud).toBeInTheDocument();
      expect(inspectHud?.textContent).toContain("200% Zoom");
      // Releasing Space (or double-tapping on touch) exits, so the HUD only reports the mode
      expect(inspectHud?.querySelector("button")).toBeNull();
    });
  });

  describe("CSS classes", () => {
    it("applies .at-top when position is top", () => {
      mockDockStore.position = "top";
      const { container } = render(Dock);

      expect(container.querySelector(".dock.at-top")).toBeInTheDocument();
    });

    it("does not apply .at-top when position is bottom", () => {
      mockDockStore.position = "bottom";
      const { container } = render(Dock);

      expect(container.querySelector(".dock.at-top")).toBeNull();
    });

    it("applies .is-dragging when mockup is dragging", () => {
      mockMockupStore.isDragging = true;
      const { container } = render(Dock);

      expect(container.querySelector(".dock.is-dragging")).toBeInTheDocument();
    });
  });

  describe("persistent floating pill toolbar", () => {
    it("always renders .toolbar in the pill", () => {
      mockDockStore.mode = "toolbar";
      const { container } = render(Dock);

      expect(container.querySelector(".toolbar")).toBeInTheDocument();
    });

    it("keeps .toolbar rendered even when a studio panel is open", () => {
      mockDockStore.mode = "mockups";
      const { container } = render(Dock);

      expect(container.querySelector(".toolbar")).toBeInTheDocument();
      expect(container.querySelector(".manager-wrapper")).toBeInTheDocument();
    });

    it("renders all toolbar buttons", () => {
      const { container } = render(Dock);

      const buttons = container.querySelectorAll(".toolbar .icon-button");
      expect(buttons.length).toBe(9);
    });
  });

  describe("button disabled states", () => {
    it("visibility button is disabled when no activeMockupId", () => {
      mockMockupStore.activeMockupId = null;
      const { container } = render(Dock);

      const visibilityBtn = container.querySelector("[data-testid='btn-visibility']") as HTMLButtonElement;
      expect(visibilityBtn.disabled).toBe(true);
    });

    it("lock button is disabled when mockup is hidden", () => {
      mockMockupStore.isHidden = true;
      const { container } = render(Dock);

      const lockBtn = container.querySelector("[data-testid='btn-lock']") as HTMLButtonElement;
      expect(lockBtn.disabled).toBe(true);
    });

    it("opacity button is disabled when mockup is hidden", () => {
      mockMockupStore.isHidden = true;
      const { container } = render(Dock);

      const opacityBtn = container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;
      expect(opacityBtn.disabled).toBe(true);
    });

    it("scale button is disabled when mockup is locked", () => {
      mockMockupStore.isLocked = true;
      const { container } = render(Dock);

      const scaleBtn = container.querySelector("[data-testid='btn-scale']") as HTMLButtonElement;
      expect(scaleBtn.disabled).toBe(true);
    });
  });

  describe("display values", () => {
    it("names the opacity button with its percentage", () => {
      mockMockupStore.opacity = 0.75;
      const { container } = render(Dock);

      expect(container.querySelector("[data-testid='btn-opacity']")).toHaveAttribute("aria-label", "Opacity 75%");
    });

    it("shows scale as 1×", () => {
      mockMockupStore.scale = 1;
      const { container } = render(Dock);

      expect(container.querySelector(".scale-button__value")?.textContent).toBe("1×");
      expect(container.querySelector("[data-testid='btn-scale']")).toHaveAttribute("aria-label", "Scale 1x");
    });

    it("shows scale as ½×", () => {
      mockMockupStore.scale = 0.5;
      const { container } = render(Dock);

      expect(container.querySelector(".scale-button__value")?.textContent).toBe("½×");
      expect(container.querySelector("[data-testid='btn-scale']")).toHaveAttribute("aria-label", "Scale 0.5x");
    });

    it("shows position display in coordinates element", () => {
      mockMockupStore.positionDisplay = "150, 250";
      mockMockupStore.activeMockupId = "test";
      mockMockupStore.isHidden = false;
      const { container } = render(Dock);

      const coordinates = container.querySelector(".dock__coordinates");
      expect(coordinates?.textContent).toBe("150, 250");
    });
  });

  describe("button clicks", () => {
    it("calls toggleVisibility on visibility button click", () => {
      const { container } = render(Dock);

      const visibilityBtn = container.querySelector("[data-testid='btn-visibility']") as HTMLButtonElement;
      visibilityBtn.click();

      expect(mockMockupStore.toggleVisibility).toHaveBeenCalledTimes(1);
    });

    it("calls toggleLock on lock button click", () => {
      const { container } = render(Dock);

      const lockBtn = container.querySelector("[data-testid='btn-lock']") as HTMLButtonElement;
      lockBtn.click();

      expect(mockMockupStore.toggleLock).toHaveBeenCalledTimes(1);
    });

    it("resets opacity on opacity button click without disabling other buttons", () => {
      const { container } = render(Dock);

      const opacityBtn = container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;
      opacityBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));

      expect(mockMockupStore.resetOpacity).toHaveBeenCalledTimes(1);
      expect((container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement).disabled).toBe(false);
      expect((container.querySelector("[data-testid='btn-mockup-manager']") as HTMLButtonElement).disabled).toBe(false);
      expect((container.querySelector("[data-testid='btn-grid-manager']") as HTMLButtonElement).disabled).toBe(false);
    });

    it("calls cycleScale on scale button click", () => {
      const { container } = render(Dock);

      const scaleBtn = container.querySelector("[data-testid='btn-scale']") as HTMLButtonElement;
      scaleBtn.click();

      expect(mockMockupStore.cycleScale).toHaveBeenCalledTimes(1);
    });

    it("calls enterMockups on mockup manager button click and enterToolbar when already open", () => {
      const { container } = render(Dock);

      const mockupManagerBtn = container.querySelector("[data-testid='btn-mockup-manager']") as HTMLButtonElement;
      mockupManagerBtn.click();

      expect(mockDockStore.enterMockups).toHaveBeenCalledTimes(1);
    });

    it("calls enterGrids on grid manager button click", () => {
      const { container } = render(Dock);

      const gridManagerBtn = container.querySelector("[data-testid='btn-grid-manager']") as HTMLButtonElement;
      gridManagerBtn.click();

      expect(mockDockStore.enterGrids).toHaveBeenCalledTimes(1);
    });

    it("calls toggleTheme on theme button click", () => {
      const { container } = render(Dock);

      const themeBtn = container.querySelector("[data-testid='btn-theme']") as HTMLButtonElement;
      themeBtn.click();

      expect(mockDockStore.toggleTheme).toHaveBeenCalledTimes(1);
    });

    it("calls togglePosition on position button click", () => {
      const { container } = render(Dock);

      const positionBtn = container.querySelector("[data-testid='btn-position']") as HTMLButtonElement;
      positionBtn.click();

      expect(mockDockStore.togglePosition).toHaveBeenCalledTimes(1);
    });
  });

  describe("manager studio panels and mutual exclusion", () => {
    it("renders .manager-wrapper immediately when mode is mockups and disables other window triggers", () => {
      mockDockStore.mode = "mockups";
      const { container } = render(Dock);

      expect(container.querySelector(".manager-wrapper.dock__panel--mockups")).toBeInTheDocument();
      expect((container.querySelector("[data-testid='btn-grid-manager']") as HTMLButtonElement).disabled).toBe(true);
      expect((container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement).disabled).toBe(true);
      expect((container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement).disabled).toBe(true);
    });

    it("renders .manager-wrapper immediately when mode is grids and disables other window triggers", () => {
      mockDockStore.mode = "grids";
      const { container } = render(Dock);

      expect(container.querySelector(".manager-wrapper.dock__panel--grids")).toBeInTheDocument();
      expect((container.querySelector("[data-testid='btn-mockup-manager']") as HTMLButtonElement).disabled).toBe(true);
      expect((container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement).disabled).toBe(true);
      expect((container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement).disabled).toBe(true);
    });

    it("does not render .manager-wrapper in toolbar mode", () => {
      mockDockStore.mode = "toolbar";
      const { container } = render(Dock);

      expect(container.querySelector(".manager-wrapper")).toBeNull();
    });
  });

  describe("opacity popover", () => {
    it.each(["opacity", "alignment"])("keeps the focused %s popover open when the pointer leaves", async (kind) => {
      const { container } = render(Dock);
      const trigger = container.querySelector<HTMLButtonElement>(`[data-testid='btn-${kind}']`)!;
      trigger.click();
      await import("svelte").then(({ tick }) => tick());
      const focused = document.activeElement;
      expect(focused?.closest(".dock__popover")).not.toBeNull();

      trigger.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: document.body }));
      await import("svelte").then(({ tick }) => tick());

      expect(focused).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      const otherKind = kind === "opacity" ? "alignment" : "opacity";
      container.querySelector(`[data-testid='btn-${otherKind}']`)!.dispatchEvent(new MouseEvent("mouseenter"));
      await import("svelte").then(({ tick }) => tick());

      expect(focused).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });

    it.each(["opacity", "alignment"])(
      "keeps the %s popover open if it gains focus during hover dismissal",
      async (kind) => {
        const { container } = render(Dock);
        const trigger = container.querySelector<HTMLButtonElement>(`[data-testid='btn-${kind}']`)!;
        trigger.dispatchEvent(new MouseEvent("mouseenter"));
        await import("svelte").then(({ tick }) => tick());
        trigger.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: container.querySelector(".toolbar") }));

        container.querySelector<HTMLElement>(".dock__popover input, .dock__popover button")!.focus();
        const focused = document.activeElement;
        await new Promise((resolve) => setTimeout(resolve, 160));

        expect(focused).toHaveFocus();
        expect(trigger).toHaveAttribute("aria-expanded", "true");
      }
    );

    it("opens and focuses the opacity slider on keyboard activation, then restores focus on Escape", async () => {
      const { container } = render(Dock);
      const trigger = container.querySelector<HTMLButtonElement>("[data-testid='btn-opacity']")!;
      trigger.focus();

      trigger.click();
      await import("svelte").then(({ tick }) => tick());

      const slider = container.querySelector<HTMLInputElement>("[data-testid='slider-opacity']")!;
      expect(slider).toHaveFocus();
      expect(slider).toHaveAccessibleName("Mockup opacity");
      expect(slider).toHaveAttribute("min", "10");
      expect(slider).toHaveAttribute("max", "90");
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(mockMockupStore.resetOpacity).not.toHaveBeenCalled();

      slider.value = "75";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      expect(mockMockupStore.setOpacity).toHaveBeenCalledWith(0.75);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await import("svelte").then(({ tick }) => tick());
      expect(trigger).toHaveFocus();
      expect(container.querySelector("[data-testid='popover-opacity']")).toBeNull();
    });

    it("opens opacity popover on mouseenter, keeps it open while moving across toolbar to popover, and updates opacity", async () => {
      const { container } = render(Dock);

      const opacityBtn = container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;
      const toolbar = container.querySelector(".toolbar") as HTMLElement;
      opacityBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const popover = container.querySelector("[data-testid='popover-opacity']") as HTMLElement;
      expect(popover).toBeInTheDocument();

      // Simulate pointer leaving button across toolbar padding before entering the popover
      opacityBtn.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, relatedTarget: toolbar }));
      popover.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 160));
      expect(container.querySelector("[data-testid='popover-opacity']")).toBeInTheDocument();

      const slider = container.querySelector("[data-testid='slider-opacity']") as HTMLInputElement;
      slider.value = "75";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      expect(mockMockupStore.setOpacity).toHaveBeenCalledWith(0.75);

      const resetBtn = container.querySelector("[data-testid='btn-opacity-reset']") as HTMLButtonElement;
      resetBtn.click();
      expect(mockMockupStore.resetOpacity).toHaveBeenCalledTimes(1);
    });

    it("leaves Escape to a focused host input while a hover popover is open", async () => {
      const { container } = render(Dock);
      const hostInput = document.createElement("input");
      document.body.appendChild(hostInput);

      container
        .querySelector("[data-testid='btn-opacity']")!
        .dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      hostInput.focus();
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      hostInput.dispatchEvent(escape);
      await new Promise((r) => setTimeout(r, 0));

      expect(escape.defaultPrevented).toBe(false);
      expect(container.querySelector("[data-testid='popover-opacity']")).toBeInTheDocument();
      hostInput.remove();
    });

    it("closes a hover popover on Escape while a host button has focus, instead of toggling the lock", async () => {
      const { container } = render(Dock);
      const hostButton = document.createElement("button");
      document.body.appendChild(hostButton);

      container
        .querySelector("[data-testid='btn-opacity']")!
        .dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      hostButton.focus();
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      hostButton.dispatchEvent(escape);
      await new Promise((r) => setTimeout(r, 0));

      expect(escape.defaultPrevented).toBe(true);
      expect(container.querySelector("[data-testid='popover-opacity']")).toBeNull();
      hostButton.remove();
    });

    it("sets aria-expanded and closes opacity popover on Escape", async () => {
      const { container } = render(Dock);

      const opacityBtn = container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;
      expect(opacityBtn.getAttribute("aria-expanded")).toBe("false");

      opacityBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
      expect(opacityBtn.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector("[data-testid='popover-opacity']")).toBeInTheDocument();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector("[data-testid='popover-opacity']")).toBeNull();
      expect(opacityBtn.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("alignment popover", () => {
    const pointerClick = () => new MouseEvent("click", { bubbles: true, detail: 1 });
    const keyboardClick = () => new MouseEvent("click", { bubbles: true, detail: 0 });

    it("shows alignment popover on alignment button mouseenter", async () => {
      mockMockupStore.isDragging = false;
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      expect(container.querySelector(".dock__popover--placement")).toBeInTheDocument();
    });

    it("restores the default top-center alignment on click, keeping the hovered matrix open", async () => {
      const { container } = render(Dock);
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      alignBtn.dispatchEvent(pointerClick());
      await new Promise((r) => setTimeout(r, 0));

      expect(mockMockupStore.setAlignment).toHaveBeenCalledWith("top", "center");
      expect(container.querySelector(".dock__popover--placement")).toBeInTheDocument();
      // Keyboard activation opens the matrix instead, so the name doesn't promise the click behavior
      expect(alignBtn).toHaveAttribute("aria-label", "Alignment");
    });

    it("marks the current alignment in the button icon", () => {
      mockMockupStore.alignmentX = "right";
      mockMockupStore.alignmentY = "bottom";
      const { container } = render(Dock);
      const mark = container.querySelector("[data-testid='btn-alignment'] circle.mark");

      expect(mark).toHaveAttribute("cx", "20");
      expect(mark).toHaveAttribute("cy", "16");
    });

    it("opens the matrix on the first tap (touch has no hover) and restores top center on the next", async () => {
      mockIsLastInputTouch.mockReturnValue(true);
      const { container } = render(Dock);
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeNull();

      alignBtn.dispatchEvent(pointerClick());
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeInTheDocument();
      expect(mockMockupStore.setAlignment).not.toHaveBeenCalled();

      alignBtn.dispatchEvent(pointerClick());
      await new Promise((r) => setTimeout(r, 0));
      expect(mockMockupStore.setAlignment).toHaveBeenCalledWith("top", "center");
      expect(container.querySelector(".dock__popover--placement")).toBeInTheDocument();
    });

    it("closes on a pointerdown outside the dock", async () => {
      const { container } = render(Dock);
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      container
        .querySelector<HTMLButtonElement>("[data-testid='matrix-top-left']")!
        .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeInTheDocument();

      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeNull();
    });

    it("moves focus into the matrix on keyboard activation and back to the trigger on Escape", async () => {
      const { container } = render(Dock);
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      alignBtn.focus();
      alignBtn.dispatchEvent(keyboardClick());
      await new Promise((r) => setTimeout(r, 0));
      expect(document.activeElement).toBe(container.querySelector("[data-testid='matrix-top-center']"));

      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      document.activeElement!.dispatchEvent(escape);
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeNull();
      expect(escape.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(alignBtn);
    });

    it("does not show alignment popover when dragging", () => {
      mockMockupStore.isDragging = true;
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      expect(container.querySelector(".dock__popover--placement")).toBeNull();
    });

    it("hides alignment popover on mouseleave", async () => {
      mockMockupStore.isDragging = false;
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeInTheDocument();

      alignBtn.dispatchEvent(
        new MouseEvent("mouseleave", {
          bubbles: true,
          relatedTarget: document.body
        })
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover--placement")).toBeNull();
    });

    it("renders only the 2x3 alignment matrix in the placement popover", async () => {
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const popover = container.querySelector(".dock__popover--placement") as HTMLElement;
      expect(popover).not.toBeNull();
      expect(popover.children).toHaveLength(1);
      expect(popover.querySelector(".alignment-matrix")).toBeInTheDocument();
      expect(popover.querySelector(".chip-row")).toBeNull();

      const bottomRightDot = container.querySelector("[data-testid='matrix-bottom-right']") as HTMLButtonElement;
      bottomRightDot.click();
      expect(mockMockupStore.setAlignment).toHaveBeenCalledWith("bottom", "right");
    });

    it("aligns popover horizontally with its trigger icon button", async () => {
      const { container } = render(Dock);
      const dockEl = container.querySelector(".dock") as HTMLDivElement;
      const opacityBtn = container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      vi.spyOn(dockEl, "getBoundingClientRect").mockReturnValue({
        left: 100,
        width: 360,
        top: 500,
        height: 46,
        right: 460,
        bottom: 546,
        x: 100,
        y: 500,
        toJSON: () => ({})
      });
      vi.spyOn(opacityBtn, "getBoundingClientRect").mockReturnValue({
        left: 190,
        width: 36,
        top: 505,
        height: 36,
        right: 226,
        bottom: 541,
        x: 190,
        y: 505,
        toJSON: () => ({})
      });
      vi.spyOn(alignBtn, "getBoundingClientRect").mockReturnValue({
        left: 234,
        width: 36,
        top: 505,
        height: 36,
        right: 270,
        bottom: 541,
        x: 234,
        y: 505,
        toJSON: () => ({})
      });

      opacityBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const opacityPopover = container.querySelector("[data-testid='popover-opacity']") as HTMLElement;
      expect(opacityPopover.style.getPropertyValue("--popover-anchor")).toBe("108px");

      opacityBtn.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, relatedTarget: document.body }));
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const alignPopover = container.querySelector(".dock__popover--placement") as HTMLElement;
      expect(alignPopover.style.left).toBe("152px");
    });
  });

  describe("position display", () => {
    it("shows dock__coordinates when controls enabled and toolbar mode", () => {
      mockDockStore.mode = "toolbar";
      mockMockupStore.activeMockupId = "test";
      mockMockupStore.isHidden = false;
      const { container } = render(Dock);

      expect(container.querySelector(".dock__coordinates")).toBeInTheDocument();
    });

    it("hides dock__coordinates when controls disabled", () => {
      mockDockStore.mode = "toolbar";
      mockMockupStore.activeMockupId = null;
      const { container } = render(Dock);

      expect(container.querySelector(".dock__coordinates")).toBeNull();
    });

    it("hides dock__coordinates when not in toolbar mode", () => {
      mockDockStore.mode = "mockups";
      mockMockupStore.activeMockupId = "test";
      const { container } = render(Dock);

      expect(container.querySelector(".dock__coordinates")).toBeNull();
    });
  });

  describe("position button", () => {
    it("offers moving the toolbar to the other edge", () => {
      mockDockStore.position = "top";
      const { container, unmount } = render(Dock);
      expect(container.querySelector("[data-testid='btn-position']")).toHaveAttribute(
        "title",
        "Move toolbar to the bottom"
      );
      unmount();

      mockDockStore.position = "bottom";
      const { container: bottom } = render(Dock);
      expect(bottom.querySelector("[data-testid='btn-position']")).toHaveAttribute("title", "Move toolbar to the top");
    });
  });
});

// ============================================
// Touch Device Tests
// ============================================

describe("Dock component (touch device)", () => {
  beforeEach(() => {
    mockIsTouchDevice.mockReturnValue(true);
    mockIsLastInputTouch.mockReturnValue(false);

    mockDockStore.initialized = true;
    mockDockStore.mode = "toolbar";
    mockMockupStore.activeMockupId = "test-id";
    mockMockupStore.isHidden = false;
    mockMockupStore.isLocked = false;
    mockMockupStore.opacity = 0.5;
    mockMockupStore.setOpacity.mockClear();
    mockMockupStore.resetOpacity.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  const pointer = (type: string, pointerType: string, clientX = 0) =>
    new PointerEvent(type, { pointerId: 1, pointerType, clientX, bubbles: true, cancelable: true });

  describe("opacity touch sliding", () => {
    const opacityButton = () =>
      render(Dock).container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;

    it("adjusts opacity while sliding a finger (100px = 50% change)", () => {
      const button = opacityButton();

      button.dispatchEvent(pointer("pointerdown", "touch", 100));
      button.dispatchEvent(pointer("pointermove", "touch", 200));

      expect(mockMockupStore.setOpacity).toHaveBeenLastCalledWith(1);
    });

    it("decreases opacity when sliding left", () => {
      const button = opacityButton();

      button.dispatchEvent(pointer("pointerdown", "touch", 100));
      button.dispatchEvent(pointer("pointermove", "touch", 60));

      expect(mockMockupStore.setOpacity).toHaveBeenLastCalledWith(0.3);
    });

    it.each(["pointerup", "pointercancel"])("stops sliding on %s", (endType) => {
      const button = opacityButton();
      button.dispatchEvent(pointer("pointerdown", "touch", 100));
      button.dispatchEvent(pointer(endType, "touch", 150));
      mockMockupStore.setOpacity.mockClear();

      button.dispatchEvent(pointer("pointermove", "touch", 200));

      expect(mockMockupStore.setOpacity).not.toHaveBeenCalled();
    });

    it("does not slide with a mouse, which clicks to reset opacity instead", () => {
      const button = opacityButton();

      button.dispatchEvent(pointer("pointerdown", "mouse", 100));
      button.dispatchEvent(pointer("pointermove", "mouse", 200));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));

      expect(mockMockupStore.setOpacity).not.toHaveBeenCalled();
      expect(mockMockupStore.resetOpacity).toHaveBeenCalledTimes(1);
    });

    it("does not reset opacity after a touch tap or slide", () => {
      const button = opacityButton();

      button.dispatchEvent(pointer("pointerdown", "touch", 100));
      button.dispatchEvent(pointer("pointerup", "touch", 100));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));

      expect(mockMockupStore.resetOpacity).not.toHaveBeenCalled();
    });
  });
});
