import { describe, expect, it } from "vitest";
import {
  fail,
  ok,
  validateColor,
  validateCSSLength,
  validateFile,
  validateFiles,
  validateLayoutGridConfig,
  validatePositiveInt
} from "./validation";
import { ValidationError } from "./errors";

describe("validation utilities", () => {
  describe("ok / fail helpers", () => {
    it("ok() returns success result with data", () => {
      const result = ok("test");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("test");
      }
    });

    it("fail() returns failure result with ValidationError", () => {
      const result = fail("error message", "details");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe("error message");
        expect(result.error.details).toBe("details");
      }
    });
  });

  describe("validateCSSLength", () => {
    it.each([
      ["100px", "100px"],
      ["50%", "50%"],
      ["1.5rem", "1.5rem"],
      ["10em", "10em"],
      ["100vw", "100vw"],
      ["50vh", "50vh"],
      ["  100px  ", "100px"] // trims whitespace
    ])("validates '%s' as valid CSS length", (input, expected) => {
      const result = validateCSSLength(input, "test");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(expected);
      }
    });

    it.each([
      ["", "is required"],
      ["   ", "is required"],
      ["abc", "Invalid"],
      ["100", "Invalid"], // missing unit
      ["px", "Invalid"], // missing number
      ["-10px", "Invalid"], // negative not supported
      ["100 px", "Invalid"] // space in value
    ])("rejects '%s' as invalid CSS length", (input, expectedError) => {
      const result = validateCSSLength(input, "Width");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(expectedError);
      }
    });
  });

  describe("validateColor", () => {
    it.each([
      ["#fff", "#fff"],
      ["#FFF", "#FFF"],
      ["#ffffff", "#ffffff"],
      ["#FFFFFF", "#FFFFFF"],
      ["#ffffffff", "#ffffffff"], // 8-char hex with alpha
      ["rgb(255, 0, 0)", "rgb(255, 0, 0)"],
      ["rgba(255, 0, 0, 0.5)", "rgba(255, 0, 0, 0.5)"],
      ["red", "red"], // named colors
      ["hsl(0 100% 50% / 0.1)", "hsl(0 100% 50% / 0.1)"],
      ["  #fff  ", "#fff"] // trims whitespace
    ])("validates '%s' as valid color", (input, expected) => {
      const result = validateColor(input, "test");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(expected);
      }
    });

    it.each([
      ["", "is required"],
      ["   ", "is required"],
      ["banana", "Invalid"], // not a color
      ["#gg0000", "Invalid"], // invalid hex chars
      ["#ff", "Invalid"], // too short
      ["rgb()", "Invalid"] // empty rgb
    ])("rejects '%s' as invalid color", (input, expectedError) => {
      const result = validateColor(input, "Color");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain(expectedError);
      }
    });
  });

  describe("validatePositiveInt", () => {
    it("validates integer within default range", () => {
      const result = validatePositiveInt(5, "Count");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(5);
      }
    });

    it("validates integer within custom range", () => {
      const result = validatePositiveInt(50, "Columns", 1, 100);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(50);
      }
    });

    it("rejects non-integer", () => {
      const result = validatePositiveInt(5.5, "Count");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("must be an integer");
      }
    });

    it("rejects value below minimum", () => {
      const result = validatePositiveInt(0, "Count", 1, 100);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("must be between");
      }
    });

    it("rejects value above maximum", () => {
      const result = validatePositiveInt(101, "Count", 1, 100);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("must be between");
      }
    });
  });

  describe("validateLayoutGridConfig", () => {
    const validConfig: GridInput = {
      width: "1140px",
      columns: 12,
      gutterWidth: "24px",
      isGutterOnOutside: true,
      position: "center"
    };

    it("validates correct grid config", () => {
      const result = validateLayoutGridConfig(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.width).toBe("1140px");
        expect(result.data.columns).toBe(12);
        expect(result.data.gutterWidth).toBe("24px");
        expect(result.data.position).toBe("center");
      }
    });

    it("rejects invalid width", () => {
      const result = validateLayoutGridConfig({ ...validConfig, width: "invalid" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid columns (non-integer)", () => {
      const result = validateLayoutGridConfig({ ...validConfig, columns: 12.5 });
      expect(result.success).toBe(false);
    });

    it("rejects invalid columns (out of range)", () => {
      const result = validateLayoutGridConfig({ ...validConfig, columns: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects invalid gutter width", () => {
      const result = validateLayoutGridConfig({ ...validConfig, gutterWidth: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid position", () => {
      const result = validateLayoutGridConfig({
        ...validConfig,
        position: "invalid" as LayoutGridPosition
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Invalid position");
      }
    });

    it.each(["left", "center", "right"] as const)("accepts position '%s'", (position) => {
      const result = validateLayoutGridConfig({ ...validConfig, position });
      expect(result.success).toBe(true);
    });
  });

  describe("validateFile", () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      const content = new Array(size).fill("a").join("");
      return new File([content], name, { type });
    };

    it.each([
      ["test.png", "image/png"],
      ["test.jpg", "image/jpeg"],
      ["test.webp", "image/webp"],
      ["test.gif", "image/gif"]
    ])("accepts valid file %s with type %s", (name, type) => {
      const file = createMockFile(name, type, 1024);
      const result = validateFile(file);
      expect(result.success).toBe(true);
    });

    it("rejects unsupported file type", () => {
      const file = createMockFile("test.pdf", "application/pdf", 1024);
      const result = validateFile(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Unsupported file type");
      }
    });

    it("rejects file exceeding size limit", () => {
      const file = createMockFile("test.png", "image/png", 11 * 1024 * 1024); // 11MB
      const result = validateFile(file);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("File too large");
      }
    });

    it("accepts file at size limit", () => {
      const file = createMockFile("test.png", "image/png", 10 * 1024 * 1024); // exactly 10MB
      const result = validateFile(file);
      expect(result.success).toBe(true);
    });
  });

  describe("validateFiles", () => {
    const createMockFile = (name: string, type: string, size: number): File => {
      const content = new Array(size).fill("a").join("");
      return new File([content], name, { type });
    };

    it("returns all valid files when all pass validation", () => {
      const files = [createMockFile("test1.png", "image/png", 1024), createMockFile("test2.jpg", "image/jpeg", 1024)];
      const result = validateFiles(files);
      expect(result.validFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("separates valid and invalid files", () => {
      const files = [
        createMockFile("valid.png", "image/png", 1024),
        createMockFile("invalid.pdf", "application/pdf", 1024),
        createMockFile("valid.jpg", "image/jpeg", 1024)
      ];
      const result = validateFiles(files);
      expect(result.validFiles).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("invalid.pdf");
    });

    it("handles empty array", () => {
      const result = validateFiles([]);
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("reports all errors when all files invalid", () => {
      const files = [
        createMockFile("test1.pdf", "application/pdf", 1024),
        createMockFile("test2.txt", "text/plain", 1024)
      ];
      const result = validateFiles(files);
      expect(result.validFiles).toHaveLength(0);
      expect(result.errors).toHaveLength(2);
    });
  });
});
