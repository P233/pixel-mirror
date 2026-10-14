/**
 * DropZone Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import DropZone from "./DropZone.svelte";

describe("DropZone component", () => {
  afterEach(() => {
    cleanup();
  });

  describe("conditional rendering", () => {
    it("renders when visible is true", () => {
      const { container } = render(DropZone, { props: { visible: true } });

      expect(container.querySelector(".drop-zone")).toBeInTheDocument();
    });

    it("does not render when visible is false", () => {
      const { container } = render(DropZone, { props: { visible: false } });

      expect(container.querySelector(".drop-zone")).toBeNull();
    });
  });

  describe("structure", () => {
    it("renders card inside drop zone", () => {
      const { container } = render(DropZone, { props: { visible: true } });

      expect(container.querySelector(".drop-zone__card")).toBeInTheDocument();
    });

    it("renders icon", () => {
      const { container } = render(DropZone, { props: { visible: true } });

      expect(container.querySelector(".drop-zone__icon")).toBeInTheDocument();
    });

    it("renders text with correct content", () => {
      const { container } = render(DropZone, { props: { visible: true } });

      const text = container.querySelector(".drop-zone__text");
      expect(text).toBeInTheDocument();
      expect(text?.textContent).toBe("Drop image to set as mockup");
    });
  });

  describe("accessibility", () => {
    it("has region role with aria-label", () => {
      const { container } = render(DropZone, { props: { visible: true } });

      const region = container.querySelector("[role='region']");
      expect(region).toBeInTheDocument();
      expect(region?.getAttribute("aria-label")).toBe("Drop zone for mockup upload");
    });

    it("has pointer-events: none to not interfere with document drop handlers", () => {
      const { container } = render(DropZone, { props: { visible: true } });

      const dropZone = container.querySelector(".drop-zone") as HTMLElement;
      expect(dropZone).toBeInTheDocument();
    });
  });
});
