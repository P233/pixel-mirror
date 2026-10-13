/**
 * Toast Store - Manages error notifications
 */

import { normalizeError } from "~/utils/errors";

function createToastStore() {
  let currentMessage = $state<string | undefined>(undefined);

  const showError = (error: unknown, context?: string) => {
    const appError = normalizeError(error, context);
    currentMessage = appError.message;
    console.error("[PixelMirror]", appError.message, appError.details ?? "");
  };

  return {
    get errorMessage() {
      return currentMessage;
    },
    showError,
    clear: () => {
      currentMessage = undefined;
    }
  };
}

export const toastStore = createToastStore();
