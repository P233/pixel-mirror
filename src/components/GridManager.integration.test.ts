/**
 * GridManager tests with the real (reactive) grid stores; only the database is mocked.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/stores/database", () => import("~/stores/__fixtures__/memoryDatabase"));

import GridManager from "./GridManager.svelte";
import { flushSettings } from "~/platform/settings.svelte";
import { gridManagerStore } from "~/stores/gridManagerStore.svelte";

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("GridManager with real stores", () => {
  beforeEach(async () => {
    const db = (await import("~/stores/database")) as unknown as typeof import("~/stores/__fixtures__/memoryDatabase");
    db.resetMemoryDatabase();
    await gridManagerStore.init();
    render(GridManager);
    await flush();
  });

  afterEach(async () => {
    cleanup();
    await flushSettings();
  });

  it("keeps unsaved edits in other fields when one field is saved", async () => {
    const [spacingColorInput, layoutColorInput] = screen.getAllByRole("textbox", {
      name: "Color"
    }) as HTMLInputElement[];
    await fireEvent.input(layoutColorInput, { target: { value: "#ff0000" } });

    await fireEvent.input(spacingColorInput, { target: { value: "rgba(1, 2, 3, 0.1)" } });
    gridManagerStore.updateSpacingGridColor("rgba(1, 2, 3, 0.1)");
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
});
