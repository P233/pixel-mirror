import { beforeEach, describe, expect, it, vi } from "vitest";

// We need to test the store factory function behavior
// Since toastStore is a singleton, we'll test its public API

describe("toastStore", () => {
  // Import fresh for each test
  let toastStore: typeof import("./toastStore.svelte").toastStore;
  // Error classes from the same fresh module graph as the store, so instanceof checks hold
  let DatabaseError: typeof import("~/utils/errors").DatabaseError;
  let ValidationError: typeof import("~/utils/errors").ValidationError;

  beforeEach(async () => {
    // Reset module state
    vi.resetModules();
    const module = await import("./toastStore.svelte");
    ({ DatabaseError, ValidationError } = await import("~/utils/errors"));
    toastStore = module.toastStore;
    toastStore.clear();
  });

  describe("initial state", () => {
    it("has no error message initially", () => {
      expect(toastStore.errorMessage).toBeUndefined();
    });
  });

  describe("showError", () => {
    it("sets error message from Error object", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      toastStore.showError(new Error("Test error"));

      expect(toastStore.errorMessage).toBe("Test error");
      consoleSpy.mockRestore();
    });

    it("sets error message from ValidationError with details", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new ValidationError("Validation failed", "Field is required");
      toastStore.showError(error);

      expect(toastStore.errorMessage).toBe("Validation failed");
      expect(consoleSpy).toHaveBeenCalledWith("[PixelMirror]", "Validation failed", "Field is required", error);
      consoleSpy.mockRestore();
    });

    it("logs the original error so its cause stays visible", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const quotaError = new Error("QuotaExceededError");
      const error = new DatabaseError("Failed to add mockups", quotaError);

      toastStore.showError(error, "Failed to upload mockups");

      expect(toastStore.errorMessage).toBe("Failed to upload mockups: Failed to add mockups");
      expect(consoleSpy).toHaveBeenCalledWith(
        "[PixelMirror]",
        "Failed to upload mockups: Failed to add mockups",
        "",
        error
      );
      expect((consoleSpy.mock.calls[0][3] as Error).cause).toBe(quotaError);
      consoleSpy.mockRestore();
    });

    it("sets error message with context prefix", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      toastStore.showError(new Error("Network error"), "Upload");

      expect(toastStore.errorMessage).toBe("Upload: Network error");
      consoleSpy.mockRestore();
    });

    it("handles unknown error types", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      toastStore.showError("string error");

      expect(toastStore.errorMessage).toBe("An unknown error occurred");
      consoleSpy.mockRestore();
    });

    it("handles null/undefined errors", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      toastStore.showError(null);
      expect(toastStore.errorMessage).toBe("An unknown error occurred");

      toastStore.showError(undefined);
      expect(toastStore.errorMessage).toBe("An unknown error occurred");

      consoleSpy.mockRestore();
    });

    it("logs error to console", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new Error("Console test");
      toastStore.showError(error);

      expect(consoleSpy).toHaveBeenCalledWith("[PixelMirror]", "Console test", "", error);
      consoleSpy.mockRestore();
    });
  });

  describe("clear", () => {
    it("clears the error message", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      toastStore.showError(new Error("Test"));
      expect(toastStore.errorMessage).toBe("Test");

      toastStore.clear();
      expect(toastStore.errorMessage).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("can be called when no error exists", () => {
      expect(() => toastStore.clear()).not.toThrow();
      expect(toastStore.errorMessage).toBeUndefined();
    });
  });

  describe("error message updates", () => {
    it("replaces previous error message", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      toastStore.showError(new Error("First error"));
      expect(toastStore.errorMessage).toBe("First error");

      toastStore.showError(new Error("Second error"));
      expect(toastStore.errorMessage).toBe("Second error");

      consoleSpy.mockRestore();
    });
  });

  it("does not intercept the host page's unhandled promise rejections", () => {
    const event = new Event("unhandledrejection", { cancelable: true });
    Object.assign(event, { reason: new Error("host app bug") });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(toastStore.errorMessage).toBeUndefined();
  });
});
