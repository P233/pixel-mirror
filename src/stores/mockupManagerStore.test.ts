/**
 * MockupManagerStore Tests
 *
 * Tests for mockup CRUD operations and file upload handling.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "~/utils/errors";

// Mock database
vi.mock("./database", () => ({
  getAllMockups: vi.fn().mockResolvedValue([]),
  addMockups: vi.fn().mockResolvedValue([]),
  deleteMockup: vi.fn().mockResolvedValue(undefined),
  resetMockups: vi.fn().mockResolvedValue(undefined)
}));

// Mock mockupOverlayStore
vi.mock("./mockupOverlayStore.svelte", () => ({
  mockupOverlayStore: {
    activeMockupId: null as string | null,
    setActiveMockup: vi.fn()
  }
}));

// Mock toastStore
vi.mock("./toastStore.svelte", () => ({
  toastStore: {
    showError: vi.fn()
  }
}));

// Mock generateMockupBuffers
vi.mock("~/utils/generate-mockup-buffers", () => ({
  generateMockupBuffers: vi.fn().mockResolvedValue({ data: [], errors: [] })
}));

describe("mockupManagerStore", () => {
  let mockupManagerStore: typeof import("./mockupManagerStore.svelte").mockupManagerStore;
  let getAllMockups: ReturnType<typeof vi.fn>;
  let addMockups: ReturnType<typeof vi.fn>;
  let deleteMockup: ReturnType<typeof vi.fn>;
  let resetMockups: ReturnType<typeof vi.fn>;
  let mockupOverlayStore: {
    activeMockupId: string | null;
    setActiveMockup: ReturnType<typeof vi.fn>;
  };
  let toastStore: { showError: ReturnType<typeof vi.fn> };
  let generateMockupBuffers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    // Get fresh mocks
    const dbModule = await import("./database");
    const mockupOverlayModule = await import("./mockupOverlayStore.svelte");
    const toastModule = await import("./toastStore.svelte");
    const bufferModule = await import("~/utils/generate-mockup-buffers");

    getAllMockups = dbModule.getAllMockups as ReturnType<typeof vi.fn>;
    addMockups = dbModule.addMockups as ReturnType<typeof vi.fn>;
    deleteMockup = dbModule.deleteMockup as ReturnType<typeof vi.fn>;
    resetMockups = dbModule.resetMockups as ReturnType<typeof vi.fn>;
    mockupOverlayStore = mockupOverlayModule.mockupOverlayStore as unknown as typeof mockupOverlayStore;
    toastStore = toastModule.toastStore as unknown as typeof toastStore;
    generateMockupBuffers = bufferModule.generateMockupBuffers as ReturnType<typeof vi.fn>;

    // Reset mocks
    getAllMockups.mockReset().mockResolvedValue([]);
    addMockups.mockReset().mockResolvedValue([]);
    deleteMockup.mockReset().mockResolvedValue(undefined);
    resetMockups.mockReset().mockResolvedValue(undefined);
    mockupOverlayStore.activeMockupId = null;
    mockupOverlayStore.setActiveMockup.mockReset();
    toastStore.showError.mockReset();
    generateMockupBuffers.mockReset().mockResolvedValue({ data: [], errors: [] });

    // Import fresh store
    const module = await import("./mockupManagerStore.svelte");
    mockupManagerStore = module.mockupManagerStore;
  });

  describe("initial state", () => {
    it("starts uninitialized", () => {
      expect(mockupManagerStore.initialized).toBe(false);
    });

    it("has empty mockups before init", () => {
      expect(mockupManagerStore.mockups).toEqual([]);
    });

    it("returns activeMockupId from mockupOverlayStore", () => {
      mockupOverlayStore.activeMockupId = "test-id";

      expect(mockupManagerStore.activeMockupId).toBe("test-id");
    });
  });

  describe("init", () => {
    it("loads mockups from database", async () => {
      const mockMockups = [
        { id: "mockup-1", filename: "test1.png", mimeType: "image/png", thumbnailBuffer: new ArrayBuffer(0) },
        { id: "mockup-2", filename: "test2.png", mimeType: "image/png", thumbnailBuffer: new ArrayBuffer(0) }
      ];
      getAllMockups.mockResolvedValue(mockMockups);

      await mockupManagerStore.init();

      expect(mockupManagerStore.initialized).toBe(true);
      expect(mockupManagerStore.mockups).toEqual(mockMockups);
    });

    it("only initializes once", async () => {
      await mockupManagerStore.init();
      await mockupManagerStore.init();

      expect(getAllMockups).toHaveBeenCalledTimes(1);
    });

    it("handles database errors gracefully", async () => {
      const error = new Error("Database error");
      getAllMockups.mockRejectedValue(error);

      await mockupManagerStore.init();

      expect(mockupManagerStore.initialized).toBe(true);
      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to load mockups");
    });
  });

  describe("upload", () => {
    beforeEach(async () => {
      await mockupManagerStore.init();
    });

    it("does nothing with empty file array", async () => {
      await mockupManagerStore.upload([]);

      expect(generateMockupBuffers).not.toHaveBeenCalled();
    });

    it("reports every failed file in a single toast", async () => {
      const files = [new File(["a"], "a.txt"), new File(["b"], "b.bmp")];
      generateMockupBuffers.mockResolvedValue({
        data: [],
        errors: [
          new ValidationError("a.txt: Unsupported file type"),
          new ValidationError("b.bmp: Unsupported file type")
        ]
      });

      await mockupManagerStore.upload(files);

      expect(toastStore.showError).toHaveBeenCalledTimes(1);
      const [error] = toastStore.showError.mock.calls[0];
      expect(error.message).toContain("2 files could not be added");
      expect(error.message).toContain("a.txt");
      expect(error.message).toContain("b.bmp");
    });

    it("processes files and adds to database", async () => {
      const mockFile = new File(["test"], "test.png", { type: "image/png" });
      const mockData = [
        {
          originalBuffer: new ArrayBuffer(0),
          thumbnailBuffer: new ArrayBuffer(0),
          filename: "test.png",
          mimeType: "image/png"
        }
      ];
      generateMockupBuffers.mockResolvedValue({ data: mockData, errors: [] });
      getAllMockups.mockResolvedValue([{ id: "new-id", filename: "test.png" }]);

      await mockupManagerStore.upload([mockFile]);

      expect(generateMockupBuffers).toHaveBeenCalledWith([mockFile]);
      expect(addMockups).toHaveBeenCalledWith(mockData);
    });

    it("shows errors for invalid files", async () => {
      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      const mockError = { message: "Invalid file type" };
      generateMockupBuffers.mockResolvedValue({ data: [], errors: [mockError] });

      await mockupManagerStore.upload([mockFile]);

      expect(toastStore.showError).toHaveBeenCalledWith(mockError);
      expect(addMockups).not.toHaveBeenCalled();
    });

    it("shows errors for some invalid files while processing valid ones", async () => {
      const mockFiles = [
        new File(["valid"], "valid.png", { type: "image/png" }),
        new File(["invalid"], "invalid.txt", { type: "text/plain" })
      ];
      const mockData = [
        {
          originalBuffer: new ArrayBuffer(0),
          thumbnailBuffer: new ArrayBuffer(0),
          filename: "valid.png",
          mimeType: "image/png"
        }
      ];
      const mockError = { message: "Invalid file type: invalid.txt" };
      generateMockupBuffers.mockResolvedValue({ data: mockData, errors: [mockError] });

      await mockupManagerStore.upload(mockFiles);

      expect(toastStore.showError).toHaveBeenCalledWith(mockError);
      expect(addMockups).toHaveBeenCalledWith(mockData);
    });

    it("handles upload errors", async () => {
      const mockFile = new File(["test"], "test.png", { type: "image/png" });
      const error = new Error("Upload failed");
      generateMockupBuffers.mockRejectedValue(error);

      await mockupManagerStore.upload([mockFile]);

      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to upload mockups");
    });
  });

  describe("uploadAndActivate", () => {
    beforeEach(async () => {
      await mockupManagerStore.init();
    });

    it("does nothing with empty file array", async () => {
      await mockupManagerStore.uploadAndActivate([]);

      expect(generateMockupBuffers).not.toHaveBeenCalled();
      expect(mockupOverlayStore.setActiveMockup).not.toHaveBeenCalled();
    });

    it("uploads and activates first mockup", async () => {
      const mockFile = new File(["test"], "test.png", { type: "image/png" });
      const mockData = [
        {
          originalBuffer: new ArrayBuffer(0),
          thumbnailBuffer: new ArrayBuffer(0),
          filename: "test.png",
          mimeType: "image/png"
        }
      ];
      generateMockupBuffers.mockResolvedValue({ data: mockData, errors: [] });
      addMockups.mockResolvedValue(["new-id-1"]);
      getAllMockups.mockResolvedValue([{ id: "new-id-1", filename: "test.png" }]);

      await mockupManagerStore.uploadAndActivate([mockFile]);

      expect(addMockups).toHaveBeenCalledWith(mockData);
      expect(mockupOverlayStore.setActiveMockup).toHaveBeenCalledWith("new-id-1");
    });

    it("activates first mockup when multiple files uploaded", async () => {
      const mockFiles = [
        new File(["a"], "a.png", { type: "image/png" }),
        new File(["b"], "b.png", { type: "image/png" })
      ];
      const mockData = [
        {
          originalBuffer: new ArrayBuffer(0),
          thumbnailBuffer: new ArrayBuffer(0),
          filename: "a.png",
          mimeType: "image/png"
        },
        {
          originalBuffer: new ArrayBuffer(0),
          thumbnailBuffer: new ArrayBuffer(0),
          filename: "b.png",
          mimeType: "image/png"
        }
      ];
      generateMockupBuffers.mockResolvedValue({ data: mockData, errors: [] });
      addMockups.mockResolvedValue(["id-a", "id-b"]);

      await mockupManagerStore.uploadAndActivate(mockFiles);

      expect(mockupOverlayStore.setActiveMockup).toHaveBeenCalledWith("id-a");
    });

    it("shows errors but still activates valid mockups", async () => {
      const mockFiles = [
        new File(["valid"], "valid.png", { type: "image/png" }),
        new File(["invalid"], "invalid.txt", { type: "text/plain" })
      ];
      const mockData = [
        {
          originalBuffer: new ArrayBuffer(0),
          thumbnailBuffer: new ArrayBuffer(0),
          filename: "valid.png",
          mimeType: "image/png"
        }
      ];
      const mockError = { message: "Invalid file type" };
      generateMockupBuffers.mockResolvedValue({ data: mockData, errors: [mockError] });
      addMockups.mockResolvedValue(["valid-id"]);

      await mockupManagerStore.uploadAndActivate(mockFiles);

      expect(toastStore.showError).toHaveBeenCalledWith(mockError);
      expect(mockupOverlayStore.setActiveMockup).toHaveBeenCalledWith("valid-id");
    });

    it("does not activate when all files are invalid", async () => {
      const mockFile = new File(["test"], "test.txt", { type: "text/plain" });
      const mockError = { message: "Invalid file type" };
      generateMockupBuffers.mockResolvedValue({ data: [], errors: [mockError] });

      await mockupManagerStore.uploadAndActivate([mockFile]);

      expect(mockupOverlayStore.setActiveMockup).not.toHaveBeenCalled();
    });

    it("handles upload errors", async () => {
      const mockFile = new File(["test"], "test.png", { type: "image/png" });
      const error = new Error("Upload failed");
      generateMockupBuffers.mockRejectedValue(error);

      await mockupManagerStore.uploadAndActivate([mockFile]);

      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to upload mockups");
    });
  });

  describe("select", () => {
    it("calls setActiveMockup on mockupOverlayStore", () => {
      mockupManagerStore.select("mockup-id");

      expect(mockupOverlayStore.setActiveMockup).toHaveBeenCalledWith("mockup-id");
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      const mockMockups = [
        { id: "mockup-1", filename: "test1.png", mimeType: "image/png", thumbnailBuffer: new ArrayBuffer(0) },
        { id: "mockup-2", filename: "test2.png", mimeType: "image/png", thumbnailBuffer: new ArrayBuffer(0) }
      ];
      getAllMockups.mockResolvedValue(mockMockups);
      await mockupManagerStore.init();
    });

    it("deletes mockup from database and local state", async () => {
      await mockupManagerStore.delete("mockup-1");

      expect(deleteMockup).toHaveBeenCalledWith("mockup-1");
      expect(mockupManagerStore.mockups.find((m) => m.id === "mockup-1")).toBeUndefined();
    });

    it("clears active mockup when deleting active one", async () => {
      mockupOverlayStore.activeMockupId = "mockup-1";

      await mockupManagerStore.delete("mockup-1");

      expect(mockupOverlayStore.setActiveMockup).toHaveBeenCalledWith(null);
    });

    it("does not clear active mockup when deleting non-active", async () => {
      mockupOverlayStore.activeMockupId = "mockup-2";

      await mockupManagerStore.delete("mockup-1");

      expect(mockupOverlayStore.setActiveMockup).not.toHaveBeenCalled();
    });

    it("handles delete errors", async () => {
      const error = new Error("Delete failed");
      deleteMockup.mockRejectedValue(error);

      await mockupManagerStore.delete("mockup-1");

      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to delete mockup");
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      const mockMockups = [
        { id: "mockup-1", filename: "test1.png", mimeType: "image/png", thumbnailBuffer: new ArrayBuffer(0) }
      ];
      getAllMockups.mockResolvedValue(mockMockups);
      await mockupManagerStore.init();
    });

    it("clears all mockups", async () => {
      await mockupManagerStore.clear();

      expect(resetMockups).toHaveBeenCalled();
      expect(mockupManagerStore.mockups).toEqual([]);
      expect(mockupOverlayStore.setActiveMockup).toHaveBeenCalledWith(null);
    });

    it("handles clear errors", async () => {
      const error = new Error("Clear failed");
      resetMockups.mockRejectedValue(error);

      await mockupManagerStore.clear();

      expect(toastStore.showError).toHaveBeenCalledWith(error, "Failed to clear mockups");
    });
  });
});
