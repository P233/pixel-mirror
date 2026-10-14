/**
 * GridManager Component Tests
 */

import { type BoundFunctions, type queries } from "@testing-library/dom";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GridManager from "./GridManager.svelte";
import { gridManagerStore } from "~/stores/gridManagerStore.svelte";
import { gridOverlayStore } from "~/stores/gridOverlayStore.svelte";
import { dockStore } from "~/stores/dockStore.svelte";

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
  const grids: LayoutGridConfig[] = [
    {
      id: "1",
      width: "1200px",
      columns: 12,
      gutterWidth: "24px",
      isGutterOnOutside: true,
      position: "center",
      createdAt: 1
    },
    {
      id: "2",
      width: "960px",
      columns: 8,
      gutterWidth: "16px",
      isGutterOnOutside: false,
      position: "left",
      createdAt: 2
    }
  ];

  beforeEach(() => {
    mockManagerStore.initialized = true;
    mockManagerStore.layoutGrids = [];
    for (const fn of [
      mockManagerStore.init,
      mockManagerStore.toggleSpacingGrid,
      mockManagerStore.toggleLayoutGrid,
      mockManagerStore.updateSpacingGridHeight,
      mockManagerStore.updateSpacingGridColor,
      mockManagerStore.updateLayoutGridColor,
      mockManagerStore.setActiveLayoutGrid,
      mockManagerStore.add,
      mockManagerStore.delete,
      mockManagerStore.reset
    ]) {
      fn.mockReset();
    }

    mockOverlayStore.showSpacingGrid = true;
    mockOverlayStore.spacingGridHeight = "8px";
    mockOverlayStore.spacingGridColor = "rgba(255, 0, 0, 0.05)";
    mockOverlayStore.showLayoutGrid = true;
    mockOverlayStore.layoutGridColor = "rgba(0, 0, 255, 0.05)";
    mockOverlayStore.activeLayoutGridId = null;

    mockDockStore.enterToolbar.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  const sectionOf = (title: string) =>
    within(screen.getByRole("heading", { name: title }).closest("section") as HTMLElement);

  const typeInto = async (input: HTMLElement, value: string) => {
    await fireEvent.input(input, { target: { value } });
  };

  describe("rendering", () => {
    it("renders the panel once the store is initialized", () => {
      expect(render(GridManager).queryByRole("region", { name: "Grid Manager" })).toBeInTheDocument();
    });

    it("renders nothing before the store is initialized", () => {
      mockManagerStore.initialized = false;

      expect(render(GridManager).queryByRole("region", { name: "Grid Manager" })).toBeNull();
    });

    it("has no fieldsets: fields are labelled controls", () => {
      const view = render(GridManager);

      expect(view.container.querySelector("fieldset, legend")).toBeNull();
      expect(view.getByRole("textbox", { name: "Height" })).toBeInTheDocument();
      expect(view.getAllByRole("textbox", { name: "Color" })).toHaveLength(2);
    });
  });

  describe("section switches", () => {
    it("names each switch after the grid it controls, not its state", () => {
      const view = render(GridManager);

      expect(view.getByRole("switch", { name: "Spacing Grids" })).toHaveAttribute("data-testid", "btn-toggle-spacing");
      expect(view.getByRole("switch", { name: "Layout Grids" })).toHaveAttribute("data-testid", "btn-toggle-layout");
    });

    it("reflects the stored state in aria-checked", () => {
      mockOverlayStore.showSpacingGrid = true;
      mockOverlayStore.showLayoutGrid = false;
      const view = render(GridManager);

      expect(view.getByRole("switch", { name: "Spacing Grids" })).toHaveAttribute("aria-checked", "true");
      expect(view.getByRole("switch", { name: "Layout Grids" })).toHaveAttribute("aria-checked", "false");
    });

    it("toggles each grid", async () => {
      const view = render(GridManager);

      await fireEvent.click(view.getByRole("switch", { name: "Spacing Grids" }));
      await fireEvent.click(view.getByRole("switch", { name: "Layout Grids" }));

      expect(mockManagerStore.toggleSpacingGrid).toHaveBeenCalledTimes(1);
      expect(mockManagerStore.toggleLayoutGrid).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["Spacing Grids", "showSpacingGrid"],
      ["Layout Grids", "showLayoutGrid"]
    ] as const)("makes the %s settings inert while the grid is off", (title, flag) => {
      mockOverlayStore[flag] = false;
      const view = render(GridManager);

      const body = view.getByRole("heading", { name: title }).closest("section")!.querySelector(".section__body");
      expect((body as HTMLElement & { inert: boolean }).inert).toBe(true);
      expect(body).toHaveClass("disabled");
    });

    it("keeps the settings usable while the grid is on", () => {
      const view = render(GridManager);

      for (const body of view.container.querySelectorAll<HTMLElement & { inert: boolean }>(".section__body")) {
        expect(body.inert).toBe(false);
      }
    });
  });

  describe("spacing grid fields", () => {
    it("shows the stored values", () => {
      mockOverlayStore.spacingGridHeight = "16px";
      mockOverlayStore.spacingGridColor = "rgba(0, 255, 0, 0.1)";
      mockOverlayStore.layoutGridColor = "rgba(255, 255, 0, 0.1)";
      const view = render(GridManager);

      expect(view.getByRole("textbox", { name: "Height" })).toHaveValue("16px");
      expect(sectionOf("Spacing Grids").getByRole("textbox", { name: "Color" })).toHaveValue("rgba(0, 255, 0, 0.1)");
      expect(sectionOf("Layout Grids").getByRole("textbox", { name: "Color" })).toHaveValue("rgba(255, 255, 0, 0.1)");
    });

    it("saves the height on change and on Enter", async () => {
      const view = render(GridManager);
      const height = view.getByRole("textbox", { name: "Height" });

      await typeInto(height, "12px");
      await fireEvent.change(height);
      expect(mockManagerStore.updateSpacingGridHeight).toHaveBeenLastCalledWith("12px");

      await typeInto(height, "20px");
      await fireEvent.keyDown(height, { key: "Enter" });
      expect(mockManagerStore.updateSpacingGridHeight).toHaveBeenLastCalledWith("20px");
    });

    it("skips unchanged values and restores an emptied field", async () => {
      const view = render(GridManager);
      const height = view.getByRole("textbox", { name: "Height" });

      await fireEvent.keyDown(height, { key: "Enter" });
      await typeInto(height, "   ");
      await fireEvent.change(height);
      await tick();

      expect(mockManagerStore.updateSpacingGridHeight).not.toHaveBeenCalled();
      expect(height).toHaveValue("8px");
    });

    it("marks the current height preset and applies another", async () => {
      const view = render(GridManager);
      const presets = within(view.getByRole("group", { name: "Height presets" }));

      expect(presets.getByRole("button", { name: "8px" })).toHaveAttribute("aria-pressed", "true");
      expect(presets.getByRole("button", { name: "16px" })).toHaveAttribute("aria-pressed", "false");

      await fireEvent.click(presets.getByRole("button", { name: "16px" }));
      expect(mockManagerStore.updateSpacingGridHeight).toHaveBeenCalledWith("16px");
    });
  });

  describe("color fields", () => {
    it.each([
      ["Spacing Grids", "picker-spacing-color", "updateSpacingGridColor"],
      ["Layout Grids", "picker-layout-color", "updateLayoutGridColor"]
    ] as const)(
      "saves the %s color from the text field and keeps its alpha from the picker",
      async (title, picker, action) => {
        const view = render(GridManager);

        const text = sectionOf(title).getByRole("textbox", { name: "Color" });
        await typeInto(text, "rgba(1, 2, 3, 0.1)");
        await fireEvent.change(text);
        expect(mockManagerStore[action]).toHaveBeenLastCalledWith("rgba(1, 2, 3, 0.1)");

        const colorInput = view.getByTestId(picker);
        await fireEvent.input(colorInput, { target: { value: "#00ff00" } });
        expect(mockManagerStore[action]).toHaveBeenLastCalledWith("rgba(0, 255, 0, 0.1)");
      }
    );

    it("shows each grid color's opacity inside its field", () => {
      render(GridManager);

      expect(screen.getByRole("spinbutton", { name: "Spacing grid opacity" })).toHaveAttribute("aria-valuenow", "5");
      expect(screen.getByRole("spinbutton", { name: "Layout grid opacity" })).toHaveAttribute("aria-valuenow", "5");
    });

    it("names the native color pickers", () => {
      const view = render(GridManager);

      expect(view.getByLabelText("Pick spacing grid color")).toHaveAttribute("type", "color");
      expect(view.getByLabelText("Pick layout grid color")).toHaveAttribute("type", "color");
    });
  });

  describe("grid list", () => {
    it("lists each grid as a radio named by its summary", () => {
      mockManagerStore.layoutGrids = grids;
      const view = render(GridManager);

      const radios = within(view.getByRole("radiogroup", { name: "Grids" })).getAllByRole("radio");
      expect(radios).toHaveLength(2);
      expect(radios[0]).toHaveAccessibleName("1200px · 12 columns · 24px gutters Center · outer gutters");
      expect(radios[1]).toHaveAccessibleName("960px · 8 columns · 16px gutters Left · no outer gutters");
    });

    it("checks the active grid only", () => {
      mockManagerStore.layoutGrids = grids;
      mockOverlayStore.activeLayoutGridId = "2";
      const view = render(GridManager);

      expect(view.getAllByRole("radio").map((radio) => (radio as HTMLInputElement).checked)).toEqual([false, true]);
    });

    it("selects a grid once when its radio is chosen", async () => {
      mockManagerStore.layoutGrids = grids;
      const view = render(GridManager);

      await fireEvent.click(view.getAllByRole("radio")[0]);

      expect(mockManagerStore.setActiveLayoutGrid).toHaveBeenCalledTimes(1);
      expect(mockManagerStore.setActiveLayoutGrid).toHaveBeenCalledWith("1");
    });

    it("deletes inactive grids; the grid in use can't be deleted", async () => {
      mockManagerStore.layoutGrids = grids;
      mockOverlayStore.activeLayoutGridId = "2";
      const view = render(GridManager);

      expect(view.getByRole("button", { name: "Delete grid 960px · 8 columns · 16px gutters" })).toBeDisabled();
      await fireEvent.click(view.getByRole("button", { name: "Delete grid 1200px · 12 columns · 24px gutters" }));

      expect(mockManagerStore.delete).toHaveBeenCalledWith("1");
      expect(mockManagerStore.setActiveLayoutGrid).not.toHaveBeenCalled();
    });
  });

  describe("new grid form", () => {
    const openForm = async () => {
      await fireEvent.click(screen.getByRole("button", { name: "New grid" }));
      await tick();
      return within(screen.getByRole("form", { name: "New grid" }));
    };

    const fill = async (
      form: BoundFunctions<typeof queries>,
      values: { width: string; columns: string; gutter: string }
    ) => {
      await typeInto(form.getByRole("textbox", { name: "Width" }), values.width);
      await typeInto(form.getByRole("textbox", { name: "Columns" }), values.columns);
      await typeInto(form.getByRole("textbox", { name: "Gutter" }), values.gutter);
    };

    it("stays folded away until requested, then focuses the width field", async () => {
      const view = render(GridManager);
      expect(view.queryByRole("form", { name: "New grid" })).toBeNull();

      const form = await openForm();

      expect(form.getByRole("textbox", { name: "Width" })).toHaveFocus();
      expect(view.queryByRole("button", { name: "New grid" })).toBeNull();
    });

    it("offers numeric input for columns only and the expected options", async () => {
      render(GridManager);
      const form = await openForm();

      expect(form.getByRole("textbox", { name: "Width" })).not.toHaveAttribute("inputmode");
      expect(form.getByRole("textbox", { name: "Columns" })).toHaveAttribute("inputmode", "numeric");
      expect(form.getByRole("textbox", { name: "Gutter" })).not.toHaveAttribute("inputmode");
      const optionsOf = (name: string) =>
        within(form.getByRole("combobox", { name }))
          .getAllByRole("option")
          .map((o) => o.textContent);
      expect(optionsOf("Outer gutters")).toEqual(["Yes", "No"]);
      expect(optionsOf("Position")).toEqual(["Center", "Left", "Right"]);
    });

    it.each([
      [{ width: "", columns: "12", gutter: "24" }, "empty width"],
      [{ width: "1200", columns: "abc", gutter: "24" }, "non-numeric columns"],
      [{ width: "1200", columns: "0", gutter: "24" }, "zero columns"],
      [{ width: "1200", columns: "12", gutter: "" }, "empty gutter"]
    ])("disables Add grid for %o (%s)", async (values) => {
      render(GridManager);
      const form = await openForm();

      await fill(form, values);

      expect(form.getByRole("button", { name: "Add grid" })).toBeDisabled();
    });

    it("adds a grid, defaulting bare numbers to px", async () => {
      mockManagerStore.add.mockResolvedValue("new-id");
      render(GridManager);
      const form = await openForm();

      await fill(form, { width: "1200", columns: "12", gutter: "24" });
      await fireEvent.click(form.getByRole("button", { name: "Add grid" }));

      expect(mockManagerStore.add).toHaveBeenCalledWith({
        width: "1200px",
        columns: 12,
        gutterWidth: "24px",
        isGutterOnOutside: true,
        position: "center"
      });
    });

    it("keeps units and uses the chosen outer gutters and position", async () => {
      mockManagerStore.add.mockResolvedValue("new-id");
      render(GridManager);
      const form = await openForm();

      await fill(form, { width: "80%", columns: "8", gutter: "16px" });
      const outer = form.getByRole("combobox", { name: "Outer gutters" }) as HTMLSelectElement;
      outer.value = "false";
      await fireEvent.change(outer);
      const position = form.getByRole("combobox", { name: "Position" }) as HTMLSelectElement;
      position.value = "left";
      await fireEvent.change(position);
      await fireEvent.click(form.getByRole("button", { name: "Add grid" }));

      expect(mockManagerStore.add).toHaveBeenCalledWith({
        width: "80%",
        columns: 8,
        gutterWidth: "16px",
        isGutterOnOutside: false,
        position: "left"
      });
    });

    it("closes and clears the form after adding, returning focus to + New grid", async () => {
      mockManagerStore.add.mockResolvedValue("new-id");
      const view = render(GridManager);
      const form = await openForm();

      await fill(form, { width: "1200", columns: "12", gutter: "24" });
      await fireEvent.click(form.getByRole("button", { name: "Add grid" }));
      await new Promise((r) => setTimeout(r, 0));

      expect(view.queryByRole("form", { name: "New grid" })).toBeNull();
      expect(view.getByRole("button", { name: "New grid" })).toHaveFocus();
      const reopened = await openForm();
      expect(reopened.getByRole("textbox", { name: "Width" })).toHaveValue("");
    });

    it("keeps the input when adding fails", async () => {
      mockManagerStore.add.mockResolvedValue(undefined);
      render(GridManager);
      const form = await openForm();

      await fill(form, { width: "abc", columns: "12", gutter: "24px" });
      await fireEvent.click(form.getByRole("button", { name: "Add grid" }));
      await new Promise((r) => setTimeout(r, 0));

      expect(form.getByRole("textbox", { name: "Width" })).toHaveValue("abc");
      expect(form.getByRole("textbox", { name: "Gutter" })).toHaveValue("24px");
    });

    it("cancels without adding", async () => {
      const view = render(GridManager);
      const form = await openForm();

      await fill(form, { width: "1200", columns: "12", gutter: "24" });
      await fireEvent.click(form.getByRole("button", { name: "Cancel" }));
      await tick();

      expect(view.queryByRole("form", { name: "New grid" })).toBeNull();
      expect(mockManagerStore.add).not.toHaveBeenCalled();
    });
  });

  describe("footer", () => {
    it("asks for confirmation before resetting", async () => {
      const view = render(GridManager);
      const reset = view.getByTestId("btn-reset");
      expect(reset).toHaveTextContent("Reset All Settings");

      await fireEvent.click(reset);
      expect(mockManagerStore.reset).not.toHaveBeenCalled();
      expect(reset).toHaveTextContent("Confirm Reset?");

      await fireEvent.click(reset);
      expect(mockManagerStore.reset).toHaveBeenCalledTimes(1);
    });

    it("closes the panel", async () => {
      const view = render(GridManager);

      await fireEvent.click(view.getByRole("button", { name: "Close" }));

      expect(mockDockStore.enterToolbar).toHaveBeenCalledTimes(1);
    });
  });
});
