/**
 * GridManager tests with the real (reactive) grid stores; only the database is mocked.
 */

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { settingsEventBus } from "~/stores/eventBus";

vi.mock("~/stores/database", () => ({
  getSettingsByGroup: vi.fn().mockResolvedValue({}),
  updateSetting: vi.fn(async (group: SettingGroup, key: string, value: unknown) => {
    settingsEventBus.emit(group, { [key]: value });
  }),
  getAllGrids: vi.fn().mockResolvedValue([
    {
      id: "g1",
      width: "1140px",
      columns: 12,
      gutterWidth: "24px",
      isGutterOnOutside: true,
      position: "center",
      createdAt: 1
    }
  ]),
  getGrid: vi.fn().mockResolvedValue(undefined),
  addGrid: vi.fn(),
  deleteGrid: vi.fn(),
  resetGrids: vi.fn(),
  resetGridOverlaySettings: vi.fn()
}));

import GridManager from "./GridManager.svelte";
import { gridManagerStore } from "~/stores/gridManagerStore.svelte";

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("GridManager with real stores", () => {
  let container: HTMLElement;

  beforeEach(async () => {
    ({ container } = render(GridManager));
    await flush();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps unsaved edits in other fields when one field is saved", async () => {
    const [, spacingColorInput, layoutColorInput] = container.querySelectorAll<HTMLInputElement>(".fieldset__input");
    await fireEvent.input(layoutColorInput, { target: { value: "#ff0000" } });

    await fireEvent.input(spacingColorInput, { target: { value: "rgba(1, 2, 3, 0.1)" } });
    gridManagerStore.updateSpacingGridColor("rgba(1, 2, 3, 0.1)");
    await flush();

    expect(layoutColorInput.value).toBe("#ff0000");
  });

  it("keeps the add-grid inputs when validation fails", async () => {
    const [widthInput, columnsInput, gutterInput] = container.querySelectorAll<HTMLInputElement>("tfoot input");
    await fireEvent.input(widthInput, { target: { value: "abc" } });
    await fireEvent.input(columnsInput, { target: { value: "12" } });
    await fireEvent.input(gutterInput, { target: { value: "24px" } });

    await fireEvent.click(container.querySelector<HTMLButtonElement>(".table__add-button")!);
    await flush();

    expect(widthInput.value).toBe("abc");
    expect(columnsInput.value).toBe("12");
    expect(gutterInput.value).toBe("24px");
  });
});
