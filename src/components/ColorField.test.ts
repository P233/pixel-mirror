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
    await renderField("rgba(255, 0, 0, 0.1)");

    const opacity = screen.getByRole("spinbutton", { name: "Grid opacity" });
    expect(opacity).toHaveTextContent("10%");
    expect(opacity).toHaveAttribute("aria-valuenow", "10");
    expect(opacity).toHaveAttribute("aria-valuemin", "1");
    expect(opacity).toHaveAttribute("aria-valuemax", "99");
  });

  it("changes the opacity when scrolling over the field, without scrolling the panel", async () => {
    const { field, text, onchange } = await renderField("rgba(255, 0, 0, 0.1)");

    // One mouse-wheel notch down: +5%, the same direction as Ctrl+Scroll on the mockup
    const down = wheel(text, 100);
    expect(down.defaultPrevented).toBe(true);
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.15)");
    await tick();
    expect(text).toHaveValue("rgba(255, 0, 0, 0.15)");

    // Small trackpad deltas add up
    wheel(field, -8);
    wheel(field, -8);
    wheel(field, -8);
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.14)");
  });

  it("leaves the wheel alone for invalid color drafts", async () => {
    const { field, onchange } = await renderField("not-a-color");

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
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.99)");
    await fireEvent.keyDown(opacity, { key: "Home" });
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.01)");
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
    const { text, onchange } = await renderField("rgba(255, 0, 0, 0.1)");

    await fireEvent.input(text, { target: { value: "#123456" } });
    await fireEvent.keyDown(text, { key: "Enter" });
    expect(onchange).toHaveBeenLastCalledWith("rgba(18, 52, 86, 0.99)");

    onchange.mockClear();
    await fireEvent.input(text, { target: { value: "  " } });
    await fireEvent.change(text);
    expect(onchange).not.toHaveBeenCalled();
    expect(text).toHaveValue("rgba(255, 0, 0, 0.1)");
  });

  it.each([
    ["rgba(1, 2, 3, 0)", "rgba(1, 2, 3, 0.01)"],
    ["rgba(1, 2, 3, 1)", "rgba(1, 2, 3, 0.99)"],
    ["rgba(1, 2, 3, 0.05)", "rgba(1, 2, 3, 0.05)"],
    ["rgba(1, 2, 3, 0.95)", "rgba(1, 2, 3, 0.95)"]
  ])("bounds typed %s", async (input, expected) => {
    const { text, onchange } = await renderField("rgba(255, 0, 0, 0.5)");
    await fireEvent.input(text, { target: { value: input } });
    await fireEvent.change(text);
    expect(onchange).toHaveBeenLastCalledWith(expected);
    expect(text).toHaveValue(expected);
  });

  it.each([
    [0.01, -10000],
    [0.99, 10000]
  ])("keeps wheel opacity within bounds at %s", async (alpha, delta) => {
    const { field, onchange } = await renderField(`rgba(255, 0, 0, ${alpha})`);
    wheel(field, delta);
    expect(onchange).not.toHaveBeenCalled();
  });

  it("preserves alpha when scrolling an HSL color", async () => {
    const { field, onchange } = await renderField("hsl(0 100% 50% / 0.5)");
    wheel(field, 100);
    expect(onchange).toHaveBeenLastCalledWith("rgba(255, 0, 0, 0.55)");
  });

  it.each([
    [0, 0.01],
    [1, 0.99]
  ])("bounds alpha %s from a native alpha picker", async (alpha, expected) => {
    const prototype = HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "alpha");
    Object.defineProperty(prototype, "alpha", { configurable: true, value: true });
    try {
      const { picker, onchange } = await renderField("rgba(255, 0, 0, 0.5)");
      Object.defineProperty(picker, "value", {
        configurable: true,
        writable: true,
        value: `color(srgb 0 1 0 / ${alpha})`
      });
      await fireEvent.input(picker);
      expect(onchange).toHaveBeenLastCalledWith(`rgba(0, 255, 0, ${expected})`);
    } finally {
      if (descriptor) Object.defineProperty(prototype, "alpha", descriptor);
      else Reflect.deleteProperty(prototype, "alpha");
    }
  });
});
