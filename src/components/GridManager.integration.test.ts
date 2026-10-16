/**
 * GridManager tests with the real (reactive) grid stores; business commands use IndexedDB.
 */

import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GridManager from "./GridManager.svelte";
import { flushSettings } from "~/platform/settings.svelte";
import { gridStore } from "~/stores/gridStore.svelte";

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("GridManager with real stores", () => {
  beforeEach(async () => {
    await gridStore.init();
    await gridStore.reset();
    gridStore.toggleLayoutGrid();
    gridStore.toggleSpacingGrid();
    await flushSettings();
    render(GridManager);
    await flush();
  });

  afterEach(async () => {
    cleanup();
    await flushSettings();
    vi.restoreAllMocks();
  });

  it("keeps unsaved edits in other fields when one field is saved", async () => {
    const [spacingColorInput, layoutColorInput] = screen.getAllByRole("textbox", {
      name: "Color"
    }) as HTMLInputElement[];
    await fireEvent.input(layoutColorInput, { target: { value: "#ff0000" } });

    await fireEvent.input(spacingColorInput, { target: { value: "rgba(1, 2, 3, 0.1)" } });
    gridStore.updateSpacingGridColor("rgba(1, 2, 3, 0.1)");
    await flush();

    expect(layoutColorInput.value).toBe("#ff0000");
  });

  it("keeps the add-grid inputs when validation fails", async () => {
    await fireEvent.click(screen.getByRole("button", { name: "New grid" }));
    await flush();
    const widthInput = screen.getByRole("textbox", { name: "Width" }) as HTMLInputElement;
    const columnsInput = screen.getByRole("textbox", { name: "Columns" }) as HTMLInputElement;
    const gutterInput = screen.getByRole("textbox", { name: "Gutter" }) as HTMLInputElement;
    await fireEvent.input(widthInput, { target: { value: "abc" } });
    await fireEvent.input(columnsInput, { target: { value: "12" } });
    await fireEvent.input(gutterInput, { target: { value: "24px" } });

    await fireEvent.click(screen.getByRole("button", { name: "Add grid" }));
    await flush();

    // The form stays open (detached inputs would keep their values too)
    expect(screen.getByRole("form", { name: "New grid" })).toBeInTheDocument();
    expect(widthInput.isConnected).toBe(true);
    expect(widthInput.value).toBe("abc");
    expect(columnsInput.value).toBe("12");
    expect(gutterInput.value).toBe("24px");
  });
  it("preserves height and color drafts while refreshing foreign library changes", async () => {
    const db = await import("~/platform/database");
    const height = screen.getByRole("textbox", { name: "Height" });
    const color = screen.getAllByRole("textbox", { name: "Color" })[0];
    gridStore.updateSpacingGridHeight("12px");
    await flush();
    await fireEvent.input(height, { target: { value: "19px" } });
    await fireEvent.input(color, { target: { value: "#123456" } });
    await db.resetGrids();
    await gridStore.refresh();
    await flush();
    expect(height).toHaveValue("19px");
    expect(color).toHaveValue("#123456");
    expect(gridStore.spacingGridHeight).toBe("12px");
    expect(gridStore.layoutGrids).toHaveLength(1);
  });

  it("keeps drafts and focus after a failed reset", async () => {
    const db = await import("~/platform/database");
    vi.spyOn(db, "resetGrids").mockRejectedValueOnce(new Error("quota"));
    await fireEvent.click(screen.getByRole("button", { name: "New grid" }));
    const width = screen.getByRole("textbox", { name: "Width" });
    const height = screen.getByRole("textbox", { name: "Height" });
    await fireEvent.input(width, { target: { value: "960px" } });
    await fireEvent.input(height, { target: { value: "19px" } });
    const reset = screen.getByTestId("btn-reset");
    reset.focus();
    await fireEvent.click(reset);
    await fireEvent.click(reset);
    await flush();
    expect(width).toHaveValue("960px");
    expect(height).toHaveValue("19px");
    expect(reset).toHaveTextContent("Confirm Reset?");
    expect(reset).toHaveFocus();
  });

  it("disables settings throughout reset and clears drafts only after success", async () => {
    const db = await import("~/platform/database");
    const original = db.resetGrids;
    let release!: () => void;
    vi.spyOn(db, "resetGrids").mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return original();
    });
    await fireEvent.click(screen.getByRole("button", { name: "New grid" }));
    await fireEvent.input(screen.getByRole("textbox", { name: "Width" }), { target: { value: "960px" } });
    const reset = screen.getByTestId("btn-reset");
    reset.focus();
    await fireEvent.click(reset);
    await fireEvent.click(reset);
    expect(reset).toBeDisabled();
    expect((document.querySelector(".inner") as HTMLElement & { inert: boolean }).inert).toBe(true);
    expect(screen.getByRole("form", { name: "New grid" })).toBeInTheDocument();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    await vi.waitFor(() => {
      expect(reset).not.toBeDisabled();
      expect(reset).toHaveFocus();
      expect(screen.queryByRole("form", { name: "New grid" })).toBeNull();
    });
    expect(gridStore.spacingGridHeight).toBe("8px");
  });
});
