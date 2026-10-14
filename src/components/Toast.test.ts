/**
 * Toast Component Tests
 */

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toast from "./Toast.svelte";
import { toastStore } from "~/stores/toastStore.svelte";

// Mock the toast store
vi.mock("~/stores/toastStore.svelte", () => ({
  toastStore: {
    errorMessage: undefined as string | undefined,
    showError: vi.fn(),
    clear: vi.fn()
  }
}));

// Get a typed reference to the mocked store
const mockStore = toastStore as {
  errorMessage: string | undefined;
  showError: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

describe("Toast component", () => {
  beforeEach(() => {
    mockStore.errorMessage = undefined;
    mockStore.clear.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders nothing when errorMessage is undefined", () => {
      mockStore.errorMessage = undefined;
      const { container } = render(Toast);

      expect(container.querySelector(".toast")).toBeNull();
    });

    it("renders .toast element when errorMessage exists", () => {
      mockStore.errorMessage = "Test error";
      const { container } = render(Toast);

      expect(container.querySelector(".toast")).toBeInTheDocument();
    });

    it("renders .toast__message with the error text", () => {
      mockStore.errorMessage = "Something went wrong";
      const { container } = render(Toast);

      const messageEl = container.querySelector(".toast__message");
      expect(messageEl).toBeInTheDocument();
      expect(messageEl?.textContent).toBe("Something went wrong");
    });

    it("displays error message in screen", () => {
      mockStore.errorMessage = "Network error occurred";
      render(Toast);

      expect(screen.getByText("Network error occurred")).toBeInTheDocument();
    });
  });

  describe("CSS classes", () => {
    it("has .toast class on container", () => {
      mockStore.errorMessage = "Error";
      const { container } = render(Toast);

      expect(container.querySelector(".toast")).toBeInTheDocument();
    });

    it("has .toast__message class on message span", () => {
      mockStore.errorMessage = "Error";
      const { container } = render(Toast);

      expect(container.querySelector(".toast__message")).toBeInTheDocument();
    });

    it("has role=alert for screen readers and auto-dismisses after timeout", () => {
      vi.useFakeTimers();
      mockStore.errorMessage = "Error";
      const { container } = render(Toast);

      const toast = container.querySelector(".toast");
      expect(toast?.getAttribute("role")).toBe("alert");

      vi.advanceTimersByTime(4500);
      expect(mockStore.clear).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});
