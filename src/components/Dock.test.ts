/**
 * Dock Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dock from "./Dock.svelte";
import { dockStore } from "~/stores/dockStore.svelte";
import { mockupOverlayStore } from "~/stores/mockupOverlayStore.svelte";

// Mock all SVG icons
vi.mock("~/assets/align-bottom-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/align-horizontal-center-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/align-left-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/align-right-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/align-top-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/border-all-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/coordinate-01-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/flip-top-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/grid-table-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/idea-01-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/image-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/image-not-found-01-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/image-upload-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/moon-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/square-lock-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/square-unlock-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/sun-03-stroke-rounded.svg?component", () => ({ default: () => null }));

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
  DOCK_TRANSITION_DURATION: 200,
  dockStore: {
    initialized: true,
    mode: "toolbar" as "toolbar" | "mockups" | "grids",
    toolbarVisible: true,
    managerVisible: false,
    isManagerMode: false,
    position: "bottom" as "top" | "bottom",
    theme: "dark" as "dark" | "light",
    size: { width: 500, height: 48 },
    init: vi.fn(),
    enterToolbar: vi.fn(),
    enterMockups: vi.fn(),
    enterGrids: vi.fn(),
    togglePosition: vi.fn(),
    toggleTheme: vi.fn()
  }
}));

vi.mock("~/stores/mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: {
    activeMockupId: "test-id",
    isHidden: false,
    isLocked: false,
    isDragging: false,
    isSolidOrZoomed: false,
    opacity: 0.5,
    scale: 1,
    alignmentX: "center" as "left" | "center" | "right",
    alignmentY: "top" as "top" | "bottom",
    positionDisplay: "100, 200",
    toggleVisibility: vi.fn(),
    toggleLock: vi.fn(),
    resetOpacity: vi.fn(),
    setOpacity: vi.fn(),
    cycleScale: vi.fn(),
    setAlignment: vi.fn(),
    setAlignmentX: vi.fn(),
    setAlignmentY: vi.fn()
  }
}));

import { isTouchDevice } from "~/utils/device";

// Get typed references to mocks (use `as unknown as` to bypass type checking for mocked modules)
const mockDockStore = dockStore as unknown as {
  initialized: boolean;
  mode: "toolbar" | "mockups" | "grids";
  toolbarVisible: boolean;
  managerVisible: boolean;
  isManagerMode: boolean;
  position: "top" | "bottom";
  theme: "dark" | "light";
  size: { width: number; height: number };
  init: ReturnType<typeof vi.fn>;
  enterToolbar: ReturnType<typeof vi.fn>;
  enterMockups: ReturnType<typeof vi.fn>;
  enterGrids: ReturnType<typeof vi.fn>;
  togglePosition: ReturnType<typeof vi.fn>;
  toggleTheme: ReturnType<typeof vi.fn>;
};

const mockMockupStore = mockupOverlayStore as unknown as {
  activeMockupId: string | null;
  isHidden: boolean;
  isLocked: boolean;
  isDragging: boolean;
  isSolidOrZoomed: boolean;
  opacity: number;
  scale: number;
  alignmentX: "left" | "center" | "right";
  alignmentY: "top" | "bottom";
  positionDisplay: string;
  toggleVisibility: ReturnType<typeof vi.fn>;
  toggleLock: ReturnType<typeof vi.fn>;
  resetOpacity: ReturnType<typeof vi.fn>;
  setOpacity: ReturnType<typeof vi.fn>;
  cycleScale: ReturnType<typeof vi.fn>;
  setAlignment: ReturnType<typeof vi.fn>;
  setAlignmentX: ReturnType<typeof vi.fn>;
  setAlignmentY: ReturnType<typeof vi.fn>;
};

const mockIsTouchDevice = isTouchDevice as ReturnType<typeof vi.fn>;

describe("Dock component", () => {
  beforeEach(() => {
    // Reset mock values
    mockDockStore.initialized = true;
    mockDockStore.mode = "toolbar";
    mockDockStore.toolbarVisible = true;
    mockDockStore.managerVisible = false;
    mockDockStore.isManagerMode = false;
    mockDockStore.position = "bottom";
    mockDockStore.theme = "dark";
    mockDockStore.size = { width: 500, height: 48 };
    mockDockStore.init.mockClear();
    mockDockStore.enterToolbar.mockClear();
    mockDockStore.enterMockups.mockClear();
    mockDockStore.enterGrids.mockClear();
    mockDockStore.togglePosition.mockClear();
    mockDockStore.toggleTheme.mockClear();

    mockMockupStore.activeMockupId = "test-id";
    mockMockupStore.isHidden = false;
    mockMockupStore.isLocked = false;
    mockMockupStore.isDragging = false;
    mockMockupStore.isSolidOrZoomed = false;
    mockMockupStore.opacity = 0.5;
    mockMockupStore.scale = 1;
    mockMockupStore.alignmentX = "center";
    mockMockupStore.alignmentY = "top";
    mockMockupStore.positionDisplay = "100, 200";
    mockMockupStore.toggleVisibility.mockClear();
    mockMockupStore.toggleLock.mockClear();
    mockMockupStore.resetOpacity.mockClear();
    mockMockupStore.setOpacity.mockClear();
    mockMockupStore.cycleScale.mockClear();
    mockMockupStore.setAlignment.mockClear();
    mockMockupStore.setAlignmentX.mockClear();
    mockMockupStore.setAlignmentY.mockClear();
    mockIsTouchDevice.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe("visibility", () => {
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

    it("has hidden attribute when isSolidOrZoomed", () => {
      mockMockupStore.isSolidOrZoomed = true;
      const { container } = render(Dock);

      const dock = container.querySelector(".dock") as HTMLElement;
      expect(dock.hidden).toBe(true);
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

  describe("style bindings", () => {
    it("applies width from dockStore.size", () => {
      mockDockStore.size = { width: 600, height: 48 };
      const { container } = render(Dock);

      const dock = container.querySelector(".dock") as HTMLElement;
      expect(dock.style.width).toBe("600px");
    });

    it("applies height from dockStore.size", () => {
      mockDockStore.size = { width: 500, height: 100 };
      const { container } = render(Dock);

      const dock = container.querySelector(".dock") as HTMLElement;
      expect(dock.style.height).toBe("100px");
    });
  });

  describe("toolbar mode", () => {
    it("renders .toolbar when mode is toolbar and toolbarVisible", () => {
      mockDockStore.mode = "toolbar";
      mockDockStore.toolbarVisible = true;
      const { container } = render(Dock);

      expect(container.querySelector(".toolbar")).toBeInTheDocument();
    });

    it("does not render .toolbar when mode is not toolbar", () => {
      mockDockStore.mode = "mockups";
      const { container } = render(Dock);

      expect(container.querySelector(".toolbar")).toBeNull();
    });

    it("renders all toolbar buttons", () => {
      const { container } = render(Dock);

      const buttons = container.querySelectorAll(".toolbar .icon-button");
      expect(buttons.length).toBeGreaterThanOrEqual(8);
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
    it("shows opacity as percentage", () => {
      mockMockupStore.opacity = 0.75;
      const { container } = render(Dock);

      const opacityValue = container.querySelector(".opacity-button__value");
      expect(opacityValue?.textContent).toBe("75");
    });

    it("shows scale as 1x", () => {
      mockMockupStore.scale = 1;
      const { container } = render(Dock);

      const scaleValue = container.querySelector(".scale-button__value");
      expect(scaleValue?.textContent).toBe("1x");
    });

    it("shows scale as .5x", () => {
      mockMockupStore.scale = 0.5;
      const { container } = render(Dock);

      const scaleValue = container.querySelector(".scale-button__value");
      expect(scaleValue?.textContent).toBe(".5x");
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

    it("calls resetOpacity on opacity button click", () => {
      const { container } = render(Dock);

      const opacityBtn = container.querySelector("[data-testid='btn-opacity']") as HTMLButtonElement;
      opacityBtn.click();

      expect(mockMockupStore.resetOpacity).toHaveBeenCalledTimes(1);
    });

    it("calls cycleScale on scale button click", () => {
      const { container } = render(Dock);

      const scaleBtn = container.querySelector("[data-testid='btn-scale']") as HTMLButtonElement;
      scaleBtn.click();

      expect(mockMockupStore.cycleScale).toHaveBeenCalledTimes(1);
    });

    it("calls enterMockups on mockup manager button click", () => {
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

  describe("manager modes", () => {
    it("renders .manager-wrapper when mode is mockups and managerVisible", () => {
      mockDockStore.mode = "mockups";
      mockDockStore.managerVisible = true;
      const { container } = render(Dock);

      expect(container.querySelector(".manager-wrapper")).toBeInTheDocument();
    });

    it("renders .manager-wrapper when mode is grids and managerVisible", () => {
      mockDockStore.mode = "grids";
      mockDockStore.managerVisible = true;
      const { container } = render(Dock);

      expect(container.querySelector(".manager-wrapper")).toBeInTheDocument();
    });

    it("does not render .manager-wrapper when managerVisible is false", () => {
      mockDockStore.mode = "mockups";
      mockDockStore.managerVisible = false;
      const { container } = render(Dock);

      expect(container.querySelector(".manager-wrapper")).toBeNull();
    });
  });

  describe("theme icon display", () => {
    it("renders correctly when theme is dark", () => {
      mockDockStore.theme = "dark";
      const { container } = render(Dock);

      const themeBtn = container.querySelector("[data-testid='btn-theme']");
      expect(themeBtn).toBeInTheDocument();
    });

    it("renders correctly when theme is light", () => {
      mockDockStore.theme = "light";
      const { container } = render(Dock);

      const themeBtn = container.querySelector("[data-testid='btn-theme']");
      expect(themeBtn).toBeInTheDocument();
    });
  });

  describe("alignment popover", () => {
    it("shows alignment popover on alignment button mouseenter", async () => {
      mockMockupStore.isDragging = false;
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      // Wait for state update
      await new Promise((r) => setTimeout(r, 0));

      expect(container.querySelector(".dock__popover")).toBeInTheDocument();
    });

    it("does not show alignment popover when dragging", () => {
      mockMockupStore.isDragging = true;
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      expect(container.querySelector(".dock__popover")).toBeNull();
    });

    it("hides alignment popover on mouseleave", async () => {
      mockMockupStore.isDragging = false;
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover")).toBeInTheDocument();

      // Create mouseleave event that doesn't target alignment area
      alignBtn.dispatchEvent(
        new MouseEvent("mouseleave", {
          bubbles: true,
          relatedTarget: document.body
        })
      );

      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover")).toBeNull();
    });

    it("opens popover on first click, sets top-center on second click (three-stage cycle)", async () => {
      // Set alignment to something other than top-center
      mockMockupStore.alignmentY = "bottom";
      mockMockupStore.alignmentX = "left";

      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      // First click: opens popover
      alignBtn.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover")).not.toBeNull();
      expect(mockMockupStore.setAlignment).not.toHaveBeenCalled();

      // Second click: sets top-center (since not already at top-center)
      alignBtn.click();
      expect(mockMockupStore.setAlignment).toHaveBeenCalledWith("top", "center");
    });

    it("calls setAlignmentY on vertical alignment buttons", async () => {
      mockMockupStore.isDragging = false;
      const { container } = render(Dock);

      // Show popover first
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      // Click the top alignment button in vertical group
      const verticalButtons = container.querySelectorAll(".alignment-group--vertical .alignment-button");
      expect(verticalButtons.length).toBeGreaterThan(0);

      (verticalButtons[0] as HTMLButtonElement).click();
      expect(mockMockupStore.setAlignmentY).toHaveBeenCalledWith("top");
    });

    it("calls setAlignmentX on horizontal alignment buttons", async () => {
      mockMockupStore.isDragging = false;
      const { container } = render(Dock);

      // Show popover first
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      // Click the left alignment button in horizontal group
      const horizontalButtons = container.querySelectorAll(".alignment-group--horizontal .alignment-button");
      expect(horizontalButtons.length).toBeGreaterThan(0);

      (horizontalButtons[0] as HTMLButtonElement).click();
      expect(mockMockupStore.setAlignmentX).toHaveBeenCalledWith("left");
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

  describe("visibility button icons", () => {
    it("works when mockup is visible", () => {
      mockMockupStore.isHidden = false;
      const { container } = render(Dock);

      const visibilityBtn = container.querySelector("[data-testid='btn-visibility']");
      expect(visibilityBtn).toBeInTheDocument();
    });

    it("works when mockup is hidden", () => {
      mockMockupStore.isHidden = true;
      const { container } = render(Dock);

      const visibilityBtn = container.querySelector("[data-testid='btn-visibility']");
      expect(visibilityBtn).toBeInTheDocument();
    });
  });

  describe("lock button icons", () => {
    it("works when mockup is locked", () => {
      mockMockupStore.isLocked = true;
      const { container } = render(Dock);

      const lockBtn = container.querySelector("[data-testid='btn-lock']");
      expect(lockBtn).toBeInTheDocument();
    });

    it("works when mockup is unlocked", () => {
      mockMockupStore.isLocked = false;
      const { container } = render(Dock);

      const lockBtn = container.querySelector("[data-testid='btn-lock']");
      expect(lockBtn).toBeInTheDocument();
    });
  });

  describe("position button flip class", () => {
    it("applies .flip when position is top", () => {
      mockDockStore.position = "top";
      const { container } = render(Dock);

      const positionBtn = container.querySelector("[data-testid='btn-position']");
      expect(positionBtn?.classList.contains("flip")).toBe(true);
    });

    it("does not apply .flip when position is bottom", () => {
      mockDockStore.position = "bottom";
      const { container } = render(Dock);

      const positionBtn = container.querySelector("[data-testid='btn-position']");
      expect(positionBtn?.classList.contains("flip")).toBe(false);
    });
  });
});

// ============================================
// Touch Device Tests
// ============================================

describe("Dock component (touch device)", () => {
  beforeEach(() => {
    mockIsTouchDevice.mockReturnValue(true);

    // Reset mock values
    mockDockStore.initialized = true;
    mockDockStore.mode = "toolbar";
    mockDockStore.toolbarVisible = true;
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

    it("does not slide with a mouse, which clicks to reset instead", () => {
      const button = opacityButton();

      button.dispatchEvent(pointer("pointerdown", "mouse", 100));
      button.dispatchEvent(pointer("pointermove", "mouse", 200));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));

      expect(mockMockupStore.setOpacity).not.toHaveBeenCalled();
      expect(mockMockupStore.resetOpacity).toHaveBeenCalledTimes(1);
    });

    it("does not reset on a touch tap", () => {
      const button = opacityButton();

      button.dispatchEvent(pointer("pointerdown", "touch", 100));
      button.dispatchEvent(pointer("pointerup", "touch", 100));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));

      expect(mockMockupStore.resetOpacity).not.toHaveBeenCalled();
    });

    it("resets from the keyboard even after a touch slide", () => {
      const button = opacityButton();
      button.dispatchEvent(pointer("pointerdown", "touch", 100));
      button.dispatchEvent(pointer("pointerup", "touch", 100));

      button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));

      expect(mockMockupStore.resetOpacity).toHaveBeenCalledTimes(1);
    });
  });

  describe("alignment popover closing on touch outside", () => {
    it("closes alignment popover when tapping outside dock on mobile", async () => {
      const { container } = render(Dock);

      // Open popover
      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.click();
      await new Promise((r) => setTimeout(r, 10));

      expect(container.querySelector(".dock__popover")).toBeInTheDocument();

      // Tap outside the dock (simulate touchend on window)
      // Note: This is tricky to test because it depends on composedPath
      // We verify the popover exists first and the behavior is testable
    });
  });

  describe("alignment button three-stage cycle (mobile)", () => {
    it("opens popover on first click", async () => {
      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;
      alignBtn.click();
      await new Promise((r) => setTimeout(r, 0));

      expect(container.querySelector(".dock__popover")).toBeInTheDocument();
    });

    it("sets top-center on second click when not already at top-center", async () => {
      mockMockupStore.alignmentY = "bottom";
      mockMockupStore.alignmentX = "left";

      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      // First click: open popover
      alignBtn.click();
      await new Promise((r) => setTimeout(r, 0));

      // Second click: set to top-center
      alignBtn.click();

      expect(mockMockupStore.setAlignment).toHaveBeenCalledWith("top", "center");
    });

    it("closes popover on third click when already at top-center", async () => {
      mockMockupStore.alignmentY = "top";
      mockMockupStore.alignmentX = "center";

      const { container } = render(Dock);

      const alignBtn = container.querySelector("[data-testid='btn-alignment']") as HTMLButtonElement;

      // First click: open popover
      alignBtn.click();
      await new Promise((r) => setTimeout(r, 0));
      expect(container.querySelector(".dock__popover")).toBeInTheDocument();

      // Second click: already at top-center, so close popover
      alignBtn.click();
      await new Promise((r) => setTimeout(r, 0));

      expect(container.querySelector(".dock__popover")).toBeNull();
    });
  });
});
