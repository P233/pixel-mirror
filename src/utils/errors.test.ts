import { describe, expect, it } from "vitest";
import { DatabaseBlockedError, DatabaseError, normalizeError, ValidationError } from "./errors";
import type { AppError } from "./errors";

describe("error utilities", () => {
  describe("ValidationError", () => {
    it("creates error with message only", () => {
      const error = new ValidationError("Invalid input");
      expect(error.message).toBe("Invalid input");
      expect(error.name).toBe("ValidationError");
      expect(error.details).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
    });

    it("creates error with message and details", () => {
      const error = new ValidationError("Invalid input", "Expected number, got string");
      expect(error.message).toBe("Invalid input");
      expect(error.details).toBe("Expected number, got string");
    });
  });

  describe("DatabaseError", () => {
    it("creates error with message only", () => {
      const error = new DatabaseError("Failed to save");
      expect(error.message).toBe("Failed to save");
      expect(error.name).toBe("DatabaseError");
      expect(error.cause).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DatabaseError);
    });

    it("keeps the original error as its cause", () => {
      const original = new Error("IndexedDB quota exceeded");
      const error = new DatabaseError("Failed to save", original);
      expect(error.message).toBe("Failed to save");
      expect(error.cause).toBe(original);
    });

    it("preserves non-Error original errors", () => {
      const error = new DatabaseError("Failed", "string error");
      expect(error.cause).toBe("string error");
    });
  });

  describe("normalizeError", () => {
    it("shows what to do when an older tab blocks the database upgrade", () => {
      const error = new DatabaseError("Failed to load settings", new DatabaseBlockedError());

      expect(normalizeError(error, "Failed to load dock settings")).toEqual({
        message: "Pixel Mirror was updated: close other tabs that use the old version, then reload this page"
      });
    });

    it("normalizes ValidationError", () => {
      const error = new ValidationError("Invalid input", "details here");
      const result = normalizeError(error);
      expect(result).toEqual<AppError>({
        message: "Invalid input",
        details: "details here"
      });
    });

    it("normalizes ValidationError without details", () => {
      const error = new ValidationError("Invalid input");
      const result = normalizeError(error);
      expect(result).toEqual<AppError>({
        message: "Invalid input",
        details: undefined
      });
    });

    it("normalizes standard Error", () => {
      const error = new Error("Something went wrong");
      const result = normalizeError(error);
      expect(result).toEqual<AppError>({
        message: "Something went wrong"
      });
    });

    it("normalizes DatabaseError as standard Error", () => {
      const error = new DatabaseError("DB failed");
      const result = normalizeError(error);
      expect(result).toEqual<AppError>({
        message: "DB failed"
      });
    });

    it("normalizes unknown error types", () => {
      const result1 = normalizeError("string error");
      expect(result1.message).toBe("An unknown error occurred");

      const result2 = normalizeError(null);
      expect(result2.message).toBe("An unknown error occurred");

      const result3 = normalizeError(undefined);
      expect(result3.message).toBe("An unknown error occurred");

      const result4 = normalizeError({ custom: "object" });
      expect(result4.message).toBe("An unknown error occurred");
    });

    it("adds context prefix when provided", () => {
      const error = new ValidationError("Invalid input", "details");
      const result = normalizeError(error, "Upload");
      expect(result).toEqual<AppError>({
        message: "Upload: Invalid input",
        details: "details"
      });
    });

    it("adds context prefix to standard Error", () => {
      const error = new Error("Network failed");
      const result = normalizeError(error, "API");
      expect(result).toEqual<AppError>({
        message: "API: Network failed"
      });
    });

    it("adds context prefix to unknown errors", () => {
      const result = normalizeError(42, "Processing");
      expect(result).toEqual<AppError>({
        message: "Processing: An unknown error occurred"
      });
    });
  });
});
