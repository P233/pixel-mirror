/**
 * Generate Mockup Buffers Tests
 *
 * Tests for the generateMockupBuffers function's validation delegation
 * and error handling. The actual image processing requires browser APIs
 * that are difficult to mock in a unit test context.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "./errors";

// Mock validation
vi.mock("./validation", () => ({
  validateFiles: vi.fn().mockReturnValue({ validFiles: [], errors: [] })
}));

// Mock constants
vi.mock("~/constants", () => ({
  MOCKUP_THUMBNAIL_SIZE: 100
}));

describe("generateMockupBuffers", () => {
  let validateFiles: ReturnType<typeof vi.fn>;
  let generateMockupBuffers: typeof import("./generate-mockup-buffers").generateMockupBuffers;

  beforeEach(async () => {
    vi.resetModules();

    // Get fresh validation mock
    const validationModule = await import("./validation");
    validateFiles = validationModule.validateFiles as ReturnType<typeof vi.fn>;
    validateFiles.mockReset().mockReturnValue({ validFiles: [], errors: [] });

    // Import the module fresh
    const module = await import("./generate-mockup-buffers");
    generateMockupBuffers = module.generateMockupBuffers;
  });

  describe("validation delegation", () => {
    it("returns validation errors when no valid files", async () => {
      const validationErrors = [new ValidationError("Invalid file type")];
      validateFiles.mockReturnValue({ validFiles: [], errors: validationErrors });

      const result = await generateMockupBuffers([new File(["test"], "test.txt")]);

      expect(result.data).toEqual([]);
      expect(result.errors).toEqual(validationErrors);
    });

    it("returns empty results when validation returns no files and no errors", async () => {
      validateFiles.mockReturnValue({ validFiles: [], errors: [] });

      const result = await generateMockupBuffers([]);

      expect(result.data).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("passes files to validation", async () => {
      const files = [new File(["test1"], "test1.png"), new File(["test2"], "test2.png")];
      validateFiles.mockReturnValue({ validFiles: [], errors: [] });

      await generateMockupBuffers(files);

      expect(validateFiles).toHaveBeenCalledWith(files);
    });
  });

  describe("error accumulation", () => {
    it("includes validation errors in final result", async () => {
      const validationError = new ValidationError("File too large");
      validateFiles.mockReturnValue({ validFiles: [], errors: [validationError] });

      const result = await generateMockupBuffers([new File(["test"], "large.png")]);

      expect(result.errors).toContain(validationError);
    });

    it("returns multiple validation errors", async () => {
      const errors = [new ValidationError("Error 1"), new ValidationError("Error 2"), new ValidationError("Error 3")];
      validateFiles.mockReturnValue({ validFiles: [], errors });

      const result = await generateMockupBuffers([]);

      expect(result.errors).toHaveLength(3);
      expect(result.errors).toEqual(errors);
    });
  });

  describe("interface compliance", () => {
    it("returns GenerateMockupBuffersResult shape", async () => {
      validateFiles.mockReturnValue({ validFiles: [], errors: [] });

      const result = await generateMockupBuffers([]);

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("errors");
      expect(Array.isArray(result.data)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
