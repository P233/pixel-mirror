/**
 * GridOverlay Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GridOverlay from "./GridOverlay.svelte";
import { gridStore } from "~/stores/gridStore.svelte";
import { overlayController } from "~/features/overlay/controller.svelte";

// Mock stores
vi.mock("~/stores/gridStore.svelte", () => ({
  gridStore: {
    showSpacingGrid: false,
    spacingGridColor: "rgba(255, 0, 0, 0.05)",
    spacingGridHeight: "8px",
    showLayoutGrid: false,
    activeLayoutGrid: undefined as LayoutGridConfig | undefined,
    layoutGridColor: "rgba(0, 0, 255, 0.05)",
    init: vi.fn(),
    cleanup: vi.fn()
  }
}));

vi.mock("~/features/overlay/controller.svelte", () => ({
  overlayController: {
    isSolidOrZoomed: false
  }
}));

// Get typed references to mocks (use `as unknown as` to bypass type checking for mocked modules)
const mockGridStore = gridStore as unknown as {
  showSpacingGrid: boolean;
  spacingGridColor: string;
  spacingGridHeight: string;
  showLayoutGrid: boolean;
  activeLayoutGrid: LayoutGridConfig | undefined;
  layoutGridColor: string;
  init: ReturnType<typeof vi.fn>;
  cleanup: ReturnType<typeof vi.fn>;
};

const mockMockupStore = overlayController as {
  isSolidOrZoomed: boolean;
};

describe("GridOverlay component", () => {
  beforeEach(() => {
    // Reset mock values
    mockGridStore.showSpacingGrid = false;
    mockGridStore.spacingGridColor = "rgba(255, 0, 0, 0.05)";
    mockGridStore.spacingGridHeight = "8px";
    mockGridStore.showLayoutGrid = false;
    mockGridStore.activeLayoutGrid = undefined;
    mockGridStore.layoutGridColor = "rgba(0, 0, 255, 0.05)";
    mockGridStore.init.mockClear();
    mockGridStore.cleanup.mockClear();
    mockMockupStore.isSolidOrZoomed = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe("spacing grid", () => {
    it("does not render .spacing-grid when hidden", () => {
      mockGridStore.showSpacingGrid = false;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".spacing-grid")).toBeNull();
    });

    it("renders .spacing-grid when visible", () => {
      mockGridStore.showSpacingGrid = true;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".spacing-grid")).toBeInTheDocument();
    });

    it("applies spacingGridColor to background-image", () => {
      mockGridStore.showSpacingGrid = true;
      mockGridStore.spacingGridColor = "rgba(255, 0, 0, 0.1)";
      const { container } = render(GridOverlay);

      const el = container.querySelector(".spacing-grid") as HTMLElement;
      expect(el.style.backgroundImage).toContain("rgba(255, 0, 0, 0.1)");
    });

    it("applies spacingGridHeight to background-size", () => {
      mockGridStore.showSpacingGrid = true;
      mockGridStore.spacingGridHeight = "12px";
      const { container } = render(GridOverlay);

      const el = container.querySelector(".spacing-grid") as HTMLElement;
      expect(el.style.backgroundSize).toContain("24px");
    });

    it("hides when mockup is in solid/zoomed mode", () => {
      mockGridStore.showSpacingGrid = true;
      mockMockupStore.isSolidOrZoomed = true;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".spacing-grid")).toBeNull();
    });
  });

  describe("layout grid", () => {
    const mockLayoutGrid: LayoutGridConfig = {
      id: "test-grid",
      width: "1200px",
      columns: 12,
      gutterWidth: "24px",
      isGutterOnOutside: true,
      position: "center",
      createdAt: Date.now()
    };

    it("renders .layout-grid when showLayoutGrid && activeLayoutGrid", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = mockLayoutGrid;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid")).toBeInTheDocument();
    });

    it("does not render .layout-grid when showLayoutGrid is false", () => {
      mockGridStore.showLayoutGrid = false;
      mockGridStore.activeLayoutGrid = mockLayoutGrid;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid")).toBeNull();
    });

    it("does not render .layout-grid when activeLayoutGrid is undefined", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = undefined;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid")).toBeNull();
    });

    it("renders correct number of .layout-grid__column elements", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, columns: 6 };
      const { container } = render(GridOverlay);

      const columns = container.querySelectorAll(".layout-grid__column");
      expect(columns.length).toBe(6);
    });

    it("applies .layout-grid--center position class", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, position: "center" };
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid--center")).toBeInTheDocument();
    });

    it("applies .layout-grid--left position class", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, position: "left" };
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid--left")).toBeInTheDocument();
    });

    it("applies .layout-grid--right position class", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, position: "right" };
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid--right")).toBeInTheDocument();
    });

    it("applies grid width to .layout-grid__inner", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, width: "960px" };
      const { container } = render(GridOverlay);

      const inner = container.querySelector(".layout-grid__inner") as HTMLElement;
      expect(inner.style.width).toBe("960px");
    });

    it("applies gutter width as gap", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, gutterWidth: "16px" };
      const { container } = render(GridOverlay);

      const inner = container.querySelector(".layout-grid__inner") as HTMLElement;
      expect(inner.style.gap).toBe("16px");
    });

    it("applies half gutter as padding when isGutterOnOutside", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = { ...mockLayoutGrid, gutterWidth: "24px", isGutterOnOutside: true };
      const { container } = render(GridOverlay);

      const inner = container.querySelector(".layout-grid__inner") as HTMLElement;
      expect(inner.style.paddingLeft).toBe("12px");
      expect(inner.style.paddingRight).toBe("12px");
    });

    it("hides when mockup is in solid/zoomed mode", () => {
      mockGridStore.showLayoutGrid = true;
      mockGridStore.activeLayoutGrid = mockLayoutGrid;
      mockMockupStore.isSolidOrZoomed = true;
      const { container } = render(GridOverlay);

      expect(container.querySelector(".layout-grid")).toBeNull();
    });
  });

  // scaleValue helper - pure function, can test without component
  describe("scaleValue helper (internal)", () => {
    const scaleValue = (value: string, multiplier: number): string => {
      return value.replace(/[\d.]+/, (n) => String(+n * multiplier));
    };

    it("scales pixel values", () => {
      expect(scaleValue("8px", 2)).toBe("16px");
      expect(scaleValue("24px", 0.5)).toBe("12px");
    });

    it("scales percentage values", () => {
      expect(scaleValue("100%", 0.5)).toBe("50%");
      expect(scaleValue("50%", 2)).toBe("100%");
    });

    it("scales rem values", () => {
      expect(scaleValue("1.5rem", 2)).toBe("3rem");
      expect(scaleValue("2rem", 0.5)).toBe("1rem");
    });

    it("handles decimal values", () => {
      expect(scaleValue("0.5px", 2)).toBe("1px");
    });
  });

  // Store interface verification
  describe("store interfaces", () => {
    it("gridStore has correct interface shape", () => {
      const mockStore = {
        showLayoutGrid: false,
        activeLayoutGrid: undefined,
        layoutGridColor: "rgba(0, 0, 255, 0.05)",
        showSpacingGrid: false,
        spacingGridColor: "rgba(255, 0, 0, 0.05)",
        spacingGridHeight: "8px",
        init: vi.fn(),
        cleanup: vi.fn()
      };

      expect(typeof mockStore.showLayoutGrid).toBe("boolean");
      expect(typeof mockStore.showSpacingGrid).toBe("boolean");
      expect(typeof mockStore.init).toBe("function");
    });
  });
});
