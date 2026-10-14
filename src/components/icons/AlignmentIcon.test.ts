import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AlignmentIcon from "./AlignmentIcon.svelte";

const markOf = (container: HTMLElement) => {
  const mark = container.querySelector("circle.mark");
  return mark && [mark.getAttribute("cx"), mark.getAttribute("cy")];
};

describe("AlignmentIcon", () => {
  it("draws the six matrix positions", () => {
    const { container } = render(AlignmentIcon, { x: "center", y: "top" });

    expect(container.querySelectorAll("circle")).toHaveLength(6);
  });

  it("marks the current alignment and dims the other positions", () => {
    const { container } = render(AlignmentIcon, { x: "center", y: "top" });

    expect(markOf(container)).toEqual(["12", "8"]);
    expect(container.querySelectorAll("circle[opacity='0.45']")).toHaveLength(5);
    expect(markOf(render(AlignmentIcon, { x: "left", y: "bottom" }).container)).toEqual(["4", "16"]);
  });

  it("marks nothing while an axis is moved freely", () => {
    const { container } = render(AlignmentIcon, { x: "center", y: null });

    expect(markOf(container)).toBeNull();
    expect(container.querySelectorAll("circle[opacity='1']")).toHaveLength(6);
  });
});
