/**
 * GridManager Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GridManager from "./GridManager.svelte";
import { gridManagerStore } from "~/stores/gridManagerStore.svelte";
import { gridOverlayStore } from "~/stores/gridOverlayStore.svelte";
import { dockStore } from "~/stores/dockStore.svelte";

// Mock SVG icons
vi.mock("~/assets/delete-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/toggle-on-stroke-rounded.svg?component", () => ({ default: () => null }));

// Mock stores
vi.mock("~/stores/gridManagerStore.svelte", () => ({
  gridManagerStore: {
    initialized: true,
    layoutGrids: [] as LayoutGridConfig[],
    init: vi.fn(),
    toggleSpacingGrid: vi.fn(),
    toggleLayoutGrid: vi.fn(),
    updateSpacingGridHeight: vi.fn(),
    updateSpacingGridColor: vi.fn(),
    updateLayoutGridColor: vi.fn(),
    setActiveLayoutGrid: vi.fn(),
    add: vi.fn(),
    delete: vi.fn(),
    reset: vi.fn()
  }
}));

vi.mock("~/stores/gridOverlayStore.svelte", () => ({
  gridOverlayStore: {
    showSpacingGrid: false,
    spacingGridHeight: "8px",
    spacingGridColor: "rgba(255, 0, 0, 0.05)",
    showLayoutGrid: false,
    layoutGridColor: "rgba(0, 0, 255, 0.05)",
    activeLayoutGridId: null as string | null
  }
}));

vi.mock("~/stores/dockStore.svelte", () => ({
  dockStore: {
    enterToolbar: vi.fn()
  }
}));

// Get typed references to mocks (use `as unknown as` to bypass type checking for mocked modules)
const mockManagerStore = gridManagerStore as unknown as {
  initialized: boolean;
  layoutGrids: LayoutGridConfig[];
  init: ReturnType<typeof vi.fn>;
  toggleSpacingGrid: ReturnType<typeof vi.fn>;
  toggleLayoutGrid: ReturnType<typeof vi.fn>;
  updateSpacingGridHeight: ReturnType<typeof vi.fn>;
  updateSpacingGridColor: ReturnType<typeof vi.fn>;
  updateLayoutGridColor: ReturnType<typeof vi.fn>;
  setActiveLayoutGrid: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

const mockOverlayStore = gridOverlayStore as unknown as {
  showSpacingGrid: boolean;
  spacingGridHeight: string;
  spacingGridColor: string;
  showLayoutGrid: boolean;
  layoutGridColor: string;
  activeLayoutGridId: string | null;
};

const mockDockStore = dockStore as unknown as {
  enterToolbar: ReturnType<typeof vi.fn>;
};

describe("GridManager component", () => {
  beforeEach(() => {
    // Reset mock values
    mockManagerStore.initialized = true;
    mockManagerStore.layoutGrids = [];
    mockManagerStore.init.mockClear();
    mockManagerStore.toggleSpacingGrid.mockClear();
    mockManagerStore.toggleLayoutGrid.mockClear();
    mockManagerStore.updateSpacingGridHeight.mockClear();
    mockManagerStore.updateSpacingGridColor.mockClear();
    mockManagerStore.updateLayoutGridColor.mockClear();
    mockManagerStore.setActiveLayoutGrid.mockClear();
    mockManagerStore.add.mockClear();
    mockManagerStore.delete.mockClear();
    mockManagerStore.reset.mockClear();

    mockOverlayStore.showSpacingGrid = false;
    mockOverlayStore.spacingGridHeight = "8px";
    mockOverlayStore.spacingGridColor = "rgba(255, 0, 0, 0.05)";
    mockOverlayStore.showLayoutGrid = false;
    mockOverlayStore.layoutGridColor = "rgba(0, 0, 255, 0.05)";
    mockOverlayStore.activeLayoutGridId = null;

    mockDockStore.enterToolbar.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("conditional rendering", () => {
    it("renders .container when initialized", () => {
      mockManagerStore.initialized = true;
      const { container } = render(GridManager);

      expect(container.querySelector(".container")).toBeInTheDocument();
    });

    it("does not render when not initialized", () => {
      mockManagerStore.initialized = false;
      const { container } = render(GridManager);

      expect(container.querySelector(".container")).toBeNull();
    });
  });

  describe("spacing grid section", () => {
    it("renders Spacing Grids header", () => {
      const { container } = render(GridManager);

      const headers = container.querySelectorAll(".header__title");
      expect(headers[0].textContent).toBe("Spacing Grids");
    });

    it("toggle button has .enabled class when showSpacingGrid is true", () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const toggleBtn = container.querySelector("[data-testid='btn-toggle-spacing']");
      expect(toggleBtn?.classList.contains("enabled")).toBe(true);
    });

    it("toggle button does not have .enabled class when showSpacingGrid is false", () => {
      mockOverlayStore.showSpacingGrid = false;
      const { container } = render(GridManager);

      const toggleBtn = container.querySelector("[data-testid='btn-toggle-spacing']");
      expect(toggleBtn?.classList.contains("enabled")).toBe(false);
    });

    it("section content has .disabled class when showSpacingGrid is false", () => {
      mockOverlayStore.showSpacingGrid = false;
      const { container } = render(GridManager);

      const sectionContents = container.querySelectorAll(".section__content");
      expect(sectionContents[0].classList.contains("disabled")).toBe(true);
    });

    it("calls toggleSpacingGrid on toggle button click", () => {
      const { container } = render(GridManager);

      const toggleBtn = container.querySelector("[data-testid='btn-toggle-spacing']") as HTMLButtonElement;
      toggleBtn.click();

      expect(mockManagerStore.toggleSpacingGrid).toHaveBeenCalledTimes(1);
    });
  });

  describe("layout grid section", () => {
    it("renders Layout Grids header", () => {
      const { container } = render(GridManager);

      const headers = container.querySelectorAll(".header__title");
      expect(headers[1].textContent).toBe("Layout Grids");
    });

    it("toggle button has .enabled class when showLayoutGrid is true", () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const toggleBtn = container.querySelector("[data-testid='btn-toggle-layout']");
      expect(toggleBtn?.classList.contains("enabled")).toBe(true);
    });

    it("calls toggleLayoutGrid on toggle button click", () => {
      const { container } = render(GridManager);

      const toggleBtn = container.querySelector("[data-testid='btn-toggle-layout']") as HTMLButtonElement;
      toggleBtn.click();

      expect(mockManagerStore.toggleLayoutGrid).toHaveBeenCalledTimes(1);
    });
  });

  describe("layout grid table", () => {
    const mockGrids: LayoutGridConfig[] = [
      {
        id: "1",
        width: "1200px",
        columns: 12,
        gutterWidth: "24px",
        isGutterOnOutside: true,
        position: "center",
        createdAt: 1000
      },
      {
        id: "2",
        width: "960px",
        columns: 8,
        gutterWidth: "16px",
        isGutterOnOutside: false,
        position: "left",
        createdAt: 2000
      }
    ];

    it("renders correct number of grid rows", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows.length).toBe(2);
    });

    it("applies .active class to active grid row", () => {
      mockManagerStore.layoutGrids = mockGrids;
      mockOverlayStore.activeLayoutGridId = "1";
      const { container } = render(GridManager);

      const activeRow = container.querySelector("tbody tr.active");
      expect(activeRow).toBeInTheDocument();
    });

    it("disables delete button for active grid", () => {
      mockManagerStore.layoutGrids = mockGrids;
      mockOverlayStore.activeLayoutGridId = "1";
      const { container } = render(GridManager);

      const deleteBtns = container.querySelectorAll(".table__button--delete");
      expect((deleteBtns[0] as HTMLButtonElement).disabled).toBe(true);
    });

    it("enables delete button for inactive grid", () => {
      mockManagerStore.layoutGrids = mockGrids;
      mockOverlayStore.activeLayoutGridId = "1";
      const { container } = render(GridManager);

      const deleteBtns = container.querySelectorAll(".table__button--delete");
      expect((deleteBtns[1] as HTMLButtonElement).disabled).toBe(false);
    });

    it("calls setActiveLayoutGrid on row click", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const rows = container.querySelectorAll("tbody tr");
      (rows[0] as HTMLElement).click();

      expect(mockManagerStore.setActiveLayoutGrid).toHaveBeenCalledWith("1");
    });

    it("calls delete on delete button click", () => {
      mockManagerStore.layoutGrids = mockGrids;
      mockOverlayStore.activeLayoutGridId = "2"; // Make grid 1 deletable
      const { container } = render(GridManager);

      const deleteBtns = container.querySelectorAll(".table__button--delete");
      (deleteBtns[0] as HTMLButtonElement).click();

      expect(mockManagerStore.delete).toHaveBeenCalledWith("1");
    });
  });

  describe("add grid form", () => {
    it("renders input fields in table footer", () => {
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input");
      expect(footerInputs.length).toBe(3); // width, columns, gutter
    });

    it("sets inputmode=numeric only on columns input for mobile numeric keyboard", () => {
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      expect(footerInputs[0].getAttribute("inputmode")).toBeNull(); // width: needs unit input
      expect(footerInputs[1].getAttribute("inputmode")).toBe("numeric"); // columns: digits only
      expect(footerInputs[2].getAttribute("inputmode")).toBeNull(); // gutter: needs unit input
    });

    it("renders Add button", () => {
      const { container } = render(GridManager);

      const addBtn = container.querySelector(".table__add-button");
      expect(addBtn).toBeInTheDocument();
    });

    it("Add button is disabled when inputs are empty", () => {
      const { container } = render(GridManager);

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      expect(addBtn.disabled).toBe(true);
    });
  });

  describe("footer buttons", () => {
    it("renders Reset Grid Settings button", () => {
      const { container } = render(GridManager);

      const resetBtn = container.querySelector("[data-testid='btn-reset']");
      expect(resetBtn?.textContent).toContain("Reset All Settings");
    });

    it("renders Close button", () => {
      const { container } = render(GridManager);

      const closeBtn = container.querySelector("[data-testid='btn-close']");
      expect(closeBtn?.textContent).toContain("Close");
    });

    it("calls reset on Reset button click", () => {
      const { container } = render(GridManager);

      const resetBtn = container.querySelector("[data-testid='btn-reset']") as HTMLButtonElement;
      resetBtn.click();

      expect(mockManagerStore.reset).toHaveBeenCalledTimes(1);
    });

    it("calls enterToolbar on Close button click", () => {
      const { container } = render(GridManager);

      const closeBtn = container.querySelector("[data-testid='btn-close']") as HTMLButtonElement;
      closeBtn.click();

      expect(mockDockStore.enterToolbar).toHaveBeenCalledTimes(1);
    });
  });

  describe("fieldset inputs", () => {
    it("renders spacing grid height fieldset", () => {
      const { container } = render(GridManager);

      const legends = container.querySelectorAll(".fieldset__legend");
      expect(legends[0].textContent).toBe("Spacing Grid Height");
    });

    it("renders spacing grid color fieldset", () => {
      const { container } = render(GridManager);

      const legends = container.querySelectorAll(".fieldset__legend");
      expect(legends[1].textContent).toBe("Spacing Grid Color");
    });

    it("renders layout grid color fieldset", () => {
      const { container } = render(GridManager);

      const legends = container.querySelectorAll(".fieldset__legend");
      expect(legends[2].textContent).toBe("Layout Grid Color");
    });

    it("initializes input values from store", () => {
      mockOverlayStore.spacingGridHeight = "16px";
      mockOverlayStore.spacingGridColor = "rgba(0, 255, 0, 0.1)";
      mockOverlayStore.layoutGridColor = "rgba(255, 255, 0, 0.1)";
      const { container } = render(GridManager);

      const inputs = container.querySelectorAll(".fieldset__input") as NodeListOf<HTMLInputElement>;
      expect(inputs[0].value).toBe("16px");
      expect(inputs[1].value).toBe("rgba(0, 255, 0, 0.1)");
      expect(inputs[2].value).toBe("rgba(255, 255, 0, 0.1)");
    });

    it("Update button is disabled when spacing height input equals store value", () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const updateBtns = container.querySelectorAll(".fieldset__button") as NodeListOf<HTMLButtonElement>;
      expect(updateBtns[0].disabled).toBe(true);
    });

    it("Update button is disabled when spacing color input equals store value", () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const updateBtns = container.querySelectorAll(".fieldset__button") as NodeListOf<HTMLButtonElement>;
      expect(updateBtns[1].disabled).toBe(true);
    });

    it("Update button is disabled when layout color input equals store value", () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const updateBtns = container.querySelectorAll(".fieldset__button") as NodeListOf<HTMLButtonElement>;
      expect(updateBtns[2].disabled).toBe(true);
    });

    it("calls updateSpacingGridHeight on Update button click", async () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const input = container.querySelectorAll(".fieldset__input")[0] as HTMLInputElement;
      input.value = "12px";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const updateBtn = container.querySelectorAll(".fieldset__button")[0] as HTMLButtonElement;
      updateBtn.click();

      expect(mockManagerStore.updateSpacingGridHeight).toHaveBeenCalledWith("12px");
    });

    it("calls updateSpacingGridColor on Update button click", async () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const input = container.querySelectorAll(".fieldset__input")[1] as HTMLInputElement;
      input.value = "rgba(0, 0, 255, 0.1)";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const updateBtn = container.querySelectorAll(".fieldset__button")[1] as HTMLButtonElement;
      updateBtn.click();

      expect(mockManagerStore.updateSpacingGridColor).toHaveBeenCalledWith("rgba(0, 0, 255, 0.1)");
    });

    it("calls updateLayoutGridColor on Update button click", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const input = container.querySelectorAll(".fieldset__input")[2] as HTMLInputElement;
      input.value = "rgba(0, 255, 0, 0.1)";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const updateBtn = container.querySelectorAll(".fieldset__button")[2] as HTMLButtonElement;
      updateBtn.click();

      expect(mockManagerStore.updateLayoutGridColor).toHaveBeenCalledWith("rgba(0, 255, 0, 0.1)");
    });

    it("calls updateSpacingGridHeight on Enter key press", async () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const input = container.querySelectorAll(".fieldset__input")[0] as HTMLInputElement;
      input.value = "20px";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(mockManagerStore.updateSpacingGridHeight).toHaveBeenCalledWith("20px");
    });

    it("does not call update on Enter key if value unchanged", async () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const input = container.querySelectorAll(".fieldset__input")[0] as HTMLInputElement;
      // Value is same as store value
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(mockManagerStore.updateSpacingGridHeight).not.toHaveBeenCalled();
    });
  });

  describe("add grid form validation", () => {
    it("Add button is enabled when all required fields are valid", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "12";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      expect(addBtn.disabled).toBe(false);
    });

    it("Add button is disabled when columns is not a valid number", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "abc";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      expect(addBtn.disabled).toBe(true);
    });

    it("Add button is disabled when columns is 0", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "0";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      expect(addBtn.disabled).toBe(true);
    });

    it("Add button is disabled when gutter is empty", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "12";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      // gutter remains empty
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      expect(addBtn.disabled).toBe(true);
    });

    it("calls add with px suffix when width is numeric", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "12";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      addBtn.click();

      expect(mockManagerStore.add).toHaveBeenCalledWith({
        width: "1200px",
        columns: 12,
        gutterWidth: "24px",
        isGutterOnOutside: true,
        position: "center"
      });
    });

    it("calls add with original value when width has unit", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "80%";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "8";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "16px";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      addBtn.click();

      expect(mockManagerStore.add).toHaveBeenCalledWith({
        width: "80%",
        columns: 8,
        gutterWidth: "16px",
        isGutterOnOutside: true,
        position: "center"
      });
    });

    it("clears input fields after adding grid", async () => {
      mockOverlayStore.showLayoutGrid = true;
      mockManagerStore.add.mockResolvedValue("new-grid-id");
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "12";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      addBtn.click();
      await new Promise((r) => setTimeout(r, 0));

      expect(footerInputs[0].value).toBe("");
      expect(footerInputs[1].value).toBe("");
      expect(footerInputs[2].value).toBe("");
    });
  });

  describe("add grid form selects", () => {
    it("renders outer gutter select with Yes/No options", () => {
      const { container } = render(GridManager);

      const selects = container.querySelectorAll("tfoot select");
      const gutterSelect = selects[0] as HTMLSelectElement;
      const options = gutterSelect.querySelectorAll("option");
      expect(options.length).toBe(2);
      expect(options[0].textContent).toBe("Yes");
      expect(options[1].textContent).toBe("No");
    });

    it("renders position select with Center/Left/Right options", () => {
      const { container } = render(GridManager);

      const selects = container.querySelectorAll("tfoot select");
      const positionSelect = selects[1] as HTMLSelectElement;
      const options = positionSelect.querySelectorAll("option");
      expect(options.length).toBe(3);
      expect(options[0].textContent).toBe("Center");
      expect(options[1].textContent).toBe("Left");
      expect(options[2].textContent).toBe("Right");
    });

    it("uses selected gutter outside value when adding", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "12";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));

      const selects = container.querySelectorAll("tfoot select") as NodeListOf<HTMLSelectElement>;
      selects[0].value = "false";
      selects[0].dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      addBtn.click();

      expect(mockManagerStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          isGutterOnOutside: false
        })
      );
    });

    it("uses selected position value when adding", async () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const footerInputs = container.querySelectorAll("tfoot input") as NodeListOf<HTMLInputElement>;
      footerInputs[0].value = "1200";
      footerInputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[1].value = "12";
      footerInputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      footerInputs[2].value = "24";
      footerInputs[2].dispatchEvent(new Event("input", { bubbles: true }));

      const selects = container.querySelectorAll("tfoot select") as NodeListOf<HTMLSelectElement>;
      selects[1].value = "left";
      selects[1].dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));

      const addBtn = container.querySelector(".table__add-button") as HTMLButtonElement;
      addBtn.click();

      expect(mockManagerStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          position: "left"
        })
      );
    });
  });

  describe("keyboard navigation", () => {
    const mockGrids: LayoutGridConfig[] = [
      {
        id: "1",
        width: "1200px",
        columns: 12,
        gutterWidth: "24px",
        isGutterOnOutside: true,
        position: "center",
        createdAt: 1000
      }
    ];

    it("calls setActiveLayoutGrid on Enter key press on row", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const row = container.querySelector("tbody tr") as HTMLElement;
      row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

      expect(mockManagerStore.setActiveLayoutGrid).toHaveBeenCalledWith("1");
    });

    it("calls setActiveLayoutGrid on Space key press on row", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const row = container.querySelector("tbody tr") as HTMLElement;
      row.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));

      expect(mockManagerStore.setActiveLayoutGrid).toHaveBeenCalledWith("1");
    });

    it("does not call setActiveLayoutGrid on other keys", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const row = container.querySelector("tbody tr") as HTMLElement;
      row.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));

      expect(mockManagerStore.setActiveLayoutGrid).not.toHaveBeenCalled();
    });

    it("row has tabindex=0 for keyboard focus", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const row = container.querySelector("tbody tr") as HTMLElement;
      expect(row.getAttribute("tabindex")).toBe("0");
    });
  });

  describe("table data display", () => {
    const mockGrids: LayoutGridConfig[] = [
      {
        id: "1",
        width: "1200px",
        columns: 12,
        gutterWidth: "24px",
        isGutterOnOutside: true,
        position: "center",
        createdAt: 1000
      },
      {
        id: "2",
        width: "960px",
        columns: 8,
        gutterWidth: "16px",
        isGutterOnOutside: false,
        position: "left",
        createdAt: 2000
      }
    ];

    it("displays grid width correctly", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const cells = container.querySelectorAll("tbody tr:first-child td");
      expect(cells[0].textContent).toBe("1200px");
    });

    it("displays grid columns correctly", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const cells = container.querySelectorAll("tbody tr:first-child td");
      expect(cells[1].textContent).toBe("12");
    });

    it("displays grid gutter width correctly", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const cells = container.querySelectorAll("tbody tr:first-child td");
      expect(cells[2].textContent).toBe("24px");
    });

    it("displays Yes for isGutterOnOutside true", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const cells = container.querySelectorAll("tbody tr:first-child td");
      expect(cells[3].textContent).toBe("Yes");
    });

    it("displays No for isGutterOnOutside false", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const cells = container.querySelectorAll("tbody tr:nth-child(2) td");
      expect(cells[3].textContent).toBe("No");
    });

    it("displays grid position correctly", () => {
      mockManagerStore.layoutGrids = mockGrids;
      const { container } = render(GridManager);

      const cells = container.querySelectorAll("tbody tr:first-child td");
      expect(cells[4].textContent).toBe("center");
    });
  });

  describe("section disabled state", () => {
    it("spacing section is inert when disabled", () => {
      mockOverlayStore.showSpacingGrid = false;
      const { container } = render(GridManager);

      const sectionContents = container.querySelectorAll(".section__content") as NodeListOf<HTMLElement>;
      expect((sectionContents[0] as unknown as { inert: boolean }).inert).toBe(true);
    });

    it("layout section is inert when disabled", () => {
      mockOverlayStore.showLayoutGrid = false;
      const { container } = render(GridManager);

      const sectionContents = container.querySelectorAll(".section__content") as NodeListOf<HTMLElement>;
      expect((sectionContents[1] as unknown as { inert: boolean }).inert).toBe(true);
    });

    it("spacing section is not inert when enabled", () => {
      mockOverlayStore.showSpacingGrid = true;
      const { container } = render(GridManager);

      const sectionContents = container.querySelectorAll(".section__content") as NodeListOf<HTMLElement>;
      expect((sectionContents[0] as unknown as { inert: boolean }).inert).toBe(false);
    });

    it("layout section is not inert when enabled", () => {
      mockOverlayStore.showLayoutGrid = true;
      const { container } = render(GridManager);

      const sectionContents = container.querySelectorAll(".section__content") as NodeListOf<HTMLElement>;
      expect((sectionContents[1] as unknown as { inert: boolean }).inert).toBe(false);
    });

    it("layout section content has disabled class when showLayoutGrid is false", () => {
      mockOverlayStore.showLayoutGrid = false;
      const { container } = render(GridManager);

      const sectionContents = container.querySelectorAll(".section__content");
      expect(sectionContents[1].classList.contains("disabled")).toBe(true);
    });
  });
});
