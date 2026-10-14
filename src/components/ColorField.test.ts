import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ColorField from "./ColorField.svelte";

const renderField = async (value: string) => {
  const onchange = vi.fn();
  const { container } = render(ColorField, {
    value,
    fallback: "#ff0000",
    pickerLabel: "Pick grid color",
    opacityLabel: "Grid opacity",
    onchange
  });
  // svelte/events registers wheel listeners a microtask late
  await tick();
  return {
    onchange,
    field: container.querySelector(".color-field__control") as HTMLElement,
    text: screen.getByRole("textbox", { name: "Color" }) as HTMLInputElement,
    picker: screen.getByLabelText("Pick grid color") as HTMLInputElement
  };
};

const wheel = (target: HTMLElement, deltaY: number) => {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
};

describe("ColorField", () => {
  afterEach(() => cleanup());

  it("shows the opacity inside the field", async () => {
    await renderField("rgba(255, 0, 0, 0.05)");

    const opacity = screen.getByRole("spinbutton", { name: "Grid opacity" });
    expect(opacity).toHaveTextContent("5%");
    expect(opacity).toHaveAttribute("aria-valuenow", "5");
  });

  it("changes the opacity when scrolling over the field, without scrolling the panel", async () => {
    const { field, text, onchange } = await renderField("rgba(255, 0, 0, 0.05)");

    // One mouse-wheel notch down: +5%, the same direction as Ctrl+Scroll on the mockup
    const down = wheel(text, 100);
    expect(down.defaultPrevented).toBe(true);
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.1)");
    await tick();
    expect(text).toHaveValue("rgba(255, 0, 0, 0.1)");

    // Small trackpad deltas add up
    wheel(field, -8);
    wheel(field, -8);
    wheel(field, -8);
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.09)");
  });

  it("leaves the wheel alone for colors it can't read", async () => {
    const { field, onchange } = await renderField("hsl(0 100% 50%)");

    expect(wheel(field, -100).defaultPrevented).toBe(false);
    expect(onchange).not.toHaveBeenCalled();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("changes the opacity from the keyboard", async () => {
    const { onchange } = await renderField("rgba(255, 0, 0, 0.5)");
    const opacity = screen.getByRole("spinbutton", { name: "Grid opacity" });

    await fireEvent.keyDown(opacity, { key: "ArrowUp" });
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.51)");
    await fireEvent.keyDown(opacity, { key: "ArrowDown", shiftKey: true });
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.41)");
    await fireEvent.keyDown(opacity, { key: "End" });
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 1)");
    await fireEvent.keyDown(opacity, { key: "Home" });
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0)");
  });

  it("keeps the opacity when a color is picked", async () => {
    const { picker, onchange } = await renderField("rgba(255, 0, 0, 0.3)");

    expect(picker).toHaveValue("#ff0000");
    await fireEvent.input(picker, { target: { value: "#00ff00" } });

    expect(onchange).toHaveBeenLastCalledWith("rgba(0, 255, 0, 0.3)");
  });

  it("sets the alpha attribute so pickers that support it can choose opacity", async () => {
    const { picker } = await renderField("rgba(255, 0, 0, 0.3)");

    expect(picker).toHaveAttribute("alpha");
  });

  it("saves typed colors on Enter and restores an emptied field", async () => {
    const { text, onchange } = await renderField("rgba(255, 0, 0, 0.05)");

    await fireEvent.input(text, { target: { value: "#123456" } });
    await fireEvent.keyDown(text, { key: "Enter" });
    expect(onchange).toHaveBeenLastCalledWith("#123456");

    onchange.mockClear();
    await fireEvent.input(text, { target: { value: "  " } });
    await fireEvent.change(text);
    expect(onchange).not.toHaveBeenCalled();
    expect(text).toHaveValue("rgba(255, 0, 0, 0.05)");
  });
});
