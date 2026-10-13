/**
 * MockupManager Component Tests
 */

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockupManager from "./MockupManager.svelte";
import { mockupManagerStore } from "~/stores/mockupManagerStore.svelte";
import { dockStore } from "~/stores/dockStore.svelte";

// Mock SVG icons
vi.mock("~/assets/delete-02-stroke-rounded.svg?component", () => ({ default: () => null }));
vi.mock("~/assets/image-upload-stroke-rounded.svg?component", () => ({ default: () => null }));

// Mock stores
vi.mock("~/stores/mockupManagerStore.svelte", () => ({
  mockupManagerStore: {
    initialized: true,
    mockups: [] as Array<{
      id: string;
      filename: string;
      mimeType: string;
      thumbnail: Blob;
    }>,
    activeMockupId: null as string | null,
    init: vi.fn(),
    upload: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    clear: vi.fn()
  }
}));

vi.mock("~/stores/dockStore.svelte", () => ({
  DOCK_TRANSITION_DURATION: 200,
  dockStore: {
    enterToolbar: vi.fn()
  }
}));

// Get typed references to mocks (use `as unknown as` to bypass type checking for mocked modules)
const mockManagerStore = mockupManagerStore as unknown as {
  initialized: boolean;
  mockups: Array<{
    id: string;
    filename: string;
    mimeType: string;
    thumbnail: Blob;
  }>;
  activeMockupId: string | null;
  init: ReturnType<typeof vi.fn>;
  upload: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

const mockDockStore = dockStore as unknown as {
  enterToolbar: ReturnType<typeof vi.fn>;
};

describe("MockupManager component", () => {
  beforeEach(() => {
    // Reset mock values
    mockManagerStore.initialized = true;
    mockManagerStore.mockups = [];
    mockManagerStore.activeMockupId = null;
    mockManagerStore.init.mockClear();
    mockManagerStore.upload.mockClear();
    mockManagerStore.delete.mockClear();
    mockManagerStore.select.mockClear();
    mockManagerStore.clear.mockClear();
    mockDockStore.enterToolbar.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("conditional rendering", () => {
    it("renders .container when initialized", () => {
      mockManagerStore.initialized = true;
      const { container } = render(MockupManager);

      expect(container.querySelector(".container")).toBeInTheDocument();
    });

    it("does not render when not initialized", () => {
      mockManagerStore.initialized = false;
      const { container } = render(MockupManager);

      expect(container.querySelector(".container")).toBeNull();
    });
  });

  describe("upload button", () => {
    it("renders upload button", () => {
      const { container } = render(MockupManager);

      expect(container.querySelector(".upload-button")).toBeInTheDocument();
    });

    it("has file input with correct accept attribute", () => {
      const { container } = render(MockupManager);

      const input = container.querySelector("input[type='file']") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.accept).toContain("image/");
    });

    it("has multiple attribute on file input", () => {
      const { container } = render(MockupManager);

      const input = container.querySelector("input[type='file']") as HTMLInputElement;
      expect(input.multiple).toBe(true);
    });
  });

  describe("mockup list", () => {
    it("renders correct number of mockup items", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) },
        { id: "2", filename: "test2.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) },
        { id: "3", filename: "test3.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const mockups = container.querySelectorAll(".mockup");
      expect(mockups.length).toBe(3);
    });

    it("applies .active class to active mockup", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) },
        { id: "2", filename: "test2.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = "1";
      const { container } = render(MockupManager);

      const activeMockup = container.querySelector(".mockup.active");
      expect(activeMockup).toBeInTheDocument();
    });

    it("renders indicator for active mockup", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = "1";
      const { container } = render(MockupManager);

      expect(container.querySelector(".mockup__indicator")).toBeInTheDocument();
    });

    it("does not render indicator for inactive mockup", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = null;
      const { container } = render(MockupManager);

      expect(container.querySelector(".mockup__indicator")).toBeNull();
    });

    it("disables preview button for active mockup", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = "1";
      const { container } = render(MockupManager);

      const previewBtn = container.querySelector(".mockup__preview") as HTMLButtonElement;
      expect(previewBtn.disabled).toBe(true);
    });
  });

  describe("footer buttons", () => {
    it("renders Clear Mockups button", () => {
      const { container } = render(MockupManager);

      const clearBtn = container.querySelector("[data-testid='btn-clear']");
      expect(clearBtn?.textContent).toContain("Clear Mockups");
    });

    it("renders Close button", () => {
      const { container } = render(MockupManager);

      const closeBtn = container.querySelector("[data-testid='btn-close']");
      expect(closeBtn?.textContent).toContain("Close");
    });

    it("Clear button is disabled when no mockups", () => {
      mockManagerStore.mockups = [];
      const { container } = render(MockupManager);

      const clearBtn = container.querySelector("[data-testid='btn-clear']") as HTMLButtonElement;
      expect(clearBtn.disabled).toBe(true);
    });

    it("Clear button is enabled when mockups exist", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const clearBtn = container.querySelector("[data-testid='btn-clear']") as HTMLButtonElement;
      expect(clearBtn.disabled).toBe(false);
    });
  });

  describe("button clicks", () => {
    it("calls clear on Clear Mockups button click", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const clearBtn = container.querySelector("[data-testid='btn-clear']") as HTMLButtonElement;
      clearBtn.click();

      expect(mockManagerStore.clear).toHaveBeenCalledTimes(1);
    });

    it("calls enterToolbar on Close button click", () => {
      const { container } = render(MockupManager);

      const closeBtn = container.querySelector("[data-testid='btn-close']") as HTMLButtonElement;
      closeBtn.click();

      expect(mockDockStore.enterToolbar).toHaveBeenCalledTimes(1);
    });

    it("calls delete on delete button click", () => {
      mockManagerStore.mockups = [
        {
          id: "test-id",
          filename: "test1.png",
          mimeType: "image/png",
          thumbnail: new Blob(["x"], { type: "image/png" })
        }
      ];
      const { container } = render(MockupManager);

      const deleteBtn = container.querySelector(".mockup__delete") as HTMLButtonElement;
      deleteBtn.click();

      expect(mockManagerStore.delete).toHaveBeenCalledWith("test-id");
    });
  });

  describe("accessibility", () => {
    it("has region role with aria-label", () => {
      const { container } = render(MockupManager);

      const region = container.querySelector("[role='region']");
      expect(region).toBeInTheDocument();
      expect(region?.getAttribute("aria-label")).toBe("Mockup Manager");
    });
  });

  describe("file input", () => {
    it("calls upload when files are selected", () => {
      const { container } = render(MockupManager);

      const input = container.querySelector("input[type='file']") as HTMLInputElement;
      const file = new File(["test"], "test.png", { type: "image/png" });

      // Create a mock FileList
      Object.defineProperty(input, "files", {
        value: [file],
        writable: true
      });

      input.dispatchEvent(new Event("change", { bubbles: true }));

      expect(mockManagerStore.upload).toHaveBeenCalledWith([file]);
    });

    it("resets input value after file selection to allow re-selecting same file", () => {
      const { container } = render(MockupManager);

      const input = container.querySelector("input[type='file']") as HTMLInputElement;
      const file = new File(["test"], "test.png", { type: "image/png" });

      // Set up input with files
      Object.defineProperty(input, "files", {
        value: [file],
        writable: true,
        configurable: true
      });

      // The input value is set to "" by the handler to allow selecting the same file again
      input.dispatchEvent(new Event("change", { bubbles: true }));

      // After the handler runs, value should be empty string
      expect(input.value).toBe("");
    });

    it("does not call upload when files is null", () => {
      const { container } = render(MockupManager);

      const input = container.querySelector("input[type='file']") as HTMLInputElement;

      Object.defineProperty(input, "files", {
        value: null,
        writable: true
      });

      input.dispatchEvent(new Event("change", { bubbles: true }));

      expect(mockManagerStore.upload).not.toHaveBeenCalled();
    });
  });

  describe("mockup selection", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls enterToolbar when selecting a mockup", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = null;
      const { container } = render(MockupManager);

      const previewBtn = container.querySelector(".mockup__preview") as HTMLButtonElement;
      previewBtn.click();

      expect(mockDockStore.enterToolbar).toHaveBeenCalledTimes(1);
    });

    it("calls select after DOCK_TRANSITION_DURATION", async () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = null;
      const { container } = render(MockupManager);

      const previewBtn = container.querySelector(".mockup__preview") as HTMLButtonElement;
      previewBtn.click();

      // Initially not called
      expect(mockManagerStore.select).not.toHaveBeenCalled();

      // Advance timers past DOCK_TRANSITION_DURATION (200ms)
      vi.advanceTimersByTime(200);

      expect(mockManagerStore.select).toHaveBeenCalledWith("1");
    });
  });

  describe("mockup display", () => {
    it("displays mockup filename as alt text", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "my-design.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const img = container.querySelector(".mockup__image") as HTMLImageElement;
      expect(img.alt).toBe("my-design.png");
    });

    it("sets draggable to false on images", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const img = container.querySelector(".mockup__image") as HTMLImageElement;
      expect(img.draggable).toBe(false);
    });

    it("enables preview button for inactive mockup", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test1.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) },
        { id: "2", filename: "test2.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      mockManagerStore.activeMockupId = "1";
      const { container } = render(MockupManager);

      const previewBtns = container.querySelectorAll(".mockup__preview") as NodeListOf<HTMLButtonElement>;
      expect(previewBtns[1].disabled).toBe(false);
    });
  });

  describe("delete button behavior", () => {
    it("stops event propagation on delete", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const deleteBtn = container.querySelector(".mockup__delete") as HTMLButtonElement;
      const clickEvent = new MouseEvent("click", { bubbles: true });
      const stopPropagation = vi.spyOn(clickEvent, "stopPropagation");

      deleteBtn.dispatchEvent(clickEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it("has title attribute for accessibility", () => {
      mockManagerStore.mockups = [
        { id: "1", filename: "test.png", mimeType: "image/png", thumbnail: new Blob(["x"], { type: "image/png" }) }
      ];
      const { container } = render(MockupManager);

      const deleteBtn = container.querySelector(".mockup__delete") as HTMLButtonElement;
      expect(deleteBtn.title).toBe("Delete mockup");
    });
  });
});
