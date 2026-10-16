import { OPACITY_DEFAULT, OPACITY_MAX, OPACITY_MIN, SCALE_OPTIONS } from "~/constants";
import {
  addMockups,
  deleteMockup,
  readMockupLibrary,
  resetMockups,
  selectMockup,
  type MockupChange
} from "~/platform/database";
import { alignmentX, alignmentY, DEFAULT_PLACEMENT } from "~/features/overlay/model";
import { createSettings } from "~/platform/settings.svelte";
import { ValidationError } from "~/utils/errors";
import { generateMockupBuffers } from "~/utils/generate-mockup-buffers";
import { toastStore } from "./toastStore.svelte";

const DEFAULT_APPEARANCE: MockupAppearanceSettings = {
  isHidden: false,
  isLocked: false,
  opacity: OPACITY_DEFAULT,
  position: { x: 0, y: 0 },
  alignmentX: alignmentX(DEFAULT_PLACEMENT),
  alignmentY: alignmentY(DEFAULT_PLACEMENT),
  scale: 1
};
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function createMockupStore() {
  const settings = createSettings("mockupOverlay", DEFAULT_APPEARANCE, {
    isHidden: (value) => typeof value === "boolean",
    isLocked: (value) => typeof value === "boolean",
    opacity: (value) => isFiniteNumber(value) && value >= OPACITY_MIN && value <= OPACITY_MAX,
    position: (value) => isFiniteNumber((value as Position)?.x) && isFiniteNumber((value as Position)?.y),
    alignmentX: (value) => value === null || value === "left" || value === "center" || value === "right",
    alignmentY: (value) => value === null || value === "top" || value === "bottom",
    scale: (value) => SCALE_OPTIONS.includes(value as (typeof SCALE_OPTIONS)[number])
  });
  let mockups = $state<Mockup[]>([]);
  let activeMockupId = $state<string | null>(null);
  const activeMockup = $derived(mockups.find((mockup) => mockup.id === activeMockupId));
  let initialization = $state<"pending" | "ready" | "failed">("pending");
  let hasLoaded = false;
  let tail = Promise.resolve();
  let loadPromise: Promise<void> | null = null;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- lifecycle subscribers are not rendered
  const listeners = new Set<(event: "commit" | "refresh") => void>();

  function enqueue<R>(operation: () => Promise<R>, message: string): Promise<R | undefined> {
    const result = tail.then(operation).catch((error) => {
      toastStore.showError(error, message);
      return undefined;
    });
    tail = result.then(() => {});
    return result;
  }

  function notify(event: "commit" | "refresh") {
    for (const listener of listeners) listener(event);
  }

  function refresh(): Promise<void> {
    if (loadPromise) return loadPromise;
    loadPromise = enqueue(async () => {
      try {
        await settings.load(
          async () => {
            const library = await readMockupLibrary(hasLoaded ? activeMockupId : undefined);
            return { stored: hasLoaded ? settings.current : library.stored, result: library };
          },
          (library) => {
            mockups = library.items;
            activeMockupId = library.activeId;
            notify("refresh");
          }
        );
        hasLoaded = true;
        initialization = "ready";
      } catch (error) {
        initialization = "failed";
        throw error;
      }
    }, "Failed to load mockups")
      .then(() => {})
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  }

  function commit(write: () => Promise<MockupChange>, remove?: string, activate = false) {
    return settings.commit(
      activate ? ["isHidden", "isLocked"] : [],
      async () => {
        const result = await write();
        return { appearance: result.appearance, result };
      },
      (result) => {
        mockups =
          remove === "all"
            ? []
            : [...result.added, ...mockups.filter((item) => item.id !== remove)].sort(
                (a, b) => b.createdAt - a.createdAt
              );
        activeMockupId = result.activeId;
        notify("commit");
      }
    );
  }

  function upload(files: File[], activate: boolean) {
    if (!files.length) return Promise.resolve();
    // Reserve the command's position before decoding; a later clear must run after this upload.
    return enqueue(async () => {
      const { data, errors } = await generateMockupBuffers(files);
      if (errors.length === 1) toastStore.showError(errors[0]);
      else if (errors.length > 1) {
        toastStore.showError(
          new ValidationError(
            `${errors.length} files could not be added: ${errors.map((error) => error.message).join("; ")}`
          )
        );
      }
      if (data.length) await commit(() => addMockups(data, activate, activeMockupId), undefined, activate);
    }, "Failed to upload mockups");
  }

  return {
    get initialized() {
      return initialization !== "pending";
    },
    get mockups() {
      return mockups;
    },
    get activeMockupId() {
      return activeMockupId;
    },
    get activeMockup() {
      return activeMockup;
    },
    get appearance() {
      return settings.current;
    },
    updateAppearance: settings.update,
    init: () => (initialization === "ready" ? Promise.resolve() : refresh()),
    refresh,
    subscribe(listener: (event: "commit" | "refresh") => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    upload: (files: File[]) => upload(files, false),
    uploadAndActivate: (files: File[]) => upload(files, true),
    select: (id: string | null) =>
      enqueue(() => commit(() => selectMockup(id), undefined, id !== null), "Failed to select mockup"),
    delete: (id: string) =>
      enqueue(() => commit(() => deleteMockup(id, activeMockupId), id), "Failed to delete mockup"),
    clear: () => enqueue(() => commit(resetMockups, "all"), "Failed to clear mockups")
  };
}

export const mockupStore = createMockupStore();
