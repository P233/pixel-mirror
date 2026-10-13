/**
 * Mockup Manager Store
 *
 * Handles mockup CRUD operations and file upload with validation.
 */

// Utils
import { ValidationError } from "~/utils/errors";
import { generateMockupBuffers } from "~/utils/generate-mockup-buffers";
// Database
import { addMockups, deleteMockup, getAllMockups, resetMockups } from "./database";
// Stores
import { mockupOverlayStore } from "./mockupOverlayStore.svelte";
import { toastStore } from "./toastStore.svelte";

function createMockupManagerStore() {
  let mockups = $state<Omit<Mockup, "originalBuffer">[]>([]);

  let initialized = $state(false);
  let initPromise: Promise<void> | null = null;

  // Shared upload logic: validates files, saves to database, updates local state.
  // Returns saved mockup IDs (empty array if none were valid).
  async function processUpload(files: File[]): Promise<string[]> {
    const { data, errors } = await generateMockupBuffers(files);

    // The toast shows one message at a time, so report all failures together
    if (errors.length === 1) {
      toastStore.showError(errors[0]);
    } else if (errors.length > 1) {
      const summary = errors.map((error) => error.message).join("; ");
      toastStore.showError(new ValidationError(`${errors.length} files could not be added: ${summary}`));
    }

    if (data.length > 0) {
      const ids = await addMockups(data);
      mockups = await getAllMockups();
      return ids;
    }

    return [];
  }

  return {
    get initialized() {
      return initialized;
    },
    get mockups() {
      return mockups;
    },
    get activeMockupId() {
      return mockupOverlayStore.activeMockupId;
    },

    init: async () => {
      if (initialized || initPromise) return initPromise;

      initPromise = (async () => {
        try {
          mockups = await getAllMockups();
        } catch (e) {
          toastStore.showError(e, "Failed to load mockups");
        } finally {
          initialized = true;
          initPromise = null;
        }
      })();

      return initPromise;
    },

    upload: async (files: File[]) => {
      if (files.length === 0) return;

      try {
        await processUpload(files);
      } catch (e) {
        toastStore.showError(e, "Failed to upload mockups");
      }
    },

    uploadAndActivate: async (files: File[]) => {
      if (files.length === 0) return;

      try {
        const ids = await processUpload(files);
        if (ids.length > 0) {
          mockupOverlayStore.setActiveMockup(ids[0]);
        }
      } catch (e) {
        toastStore.showError(e, "Failed to upload mockups");
      }
    },

    select: (id: string) => {
      mockupOverlayStore.setActiveMockup(id);
    },

    // CRUD operations use try/catch to ensure data consistency:
    // local state is only updated after database operation succeeds

    delete: async (id: string) => {
      try {
        await deleteMockup(id);
        mockups = mockups.filter((m) => m.id !== id);

        if (mockupOverlayStore.activeMockupId === id) {
          mockupOverlayStore.setActiveMockup(null);
        }
      } catch (e) {
        toastStore.showError(e, "Failed to delete mockup");
      }
    },

    clear: async () => {
      try {
        await resetMockups();
        mockups = [];
        mockupOverlayStore.setActiveMockup(null);
      } catch (e) {
        toastStore.showError(e, "Failed to clear mockups");
      }
    }
  };
}

export const mockupManagerStore = createMockupManagerStore();
