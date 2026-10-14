/**
 * Whether keys go to a field that takes text input on the host page or in the tool
 */

// Buttons are not included: Space on a focused button is the solid-mode shortcut
const TEXT_ENTRY_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

function isTextEntry(target: EventTarget | null | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TEXT_ENTRY_TAGS.has(target.tagName) || target.isContentEditable;
}

/** The key event targets an input, select, textarea or contentEditable, including inside open shadow roots */
export function isTypingInField(e: KeyboardEvent): boolean {
  if (isTextEntry(e.composedPath()[0])) return true;

  let activeElement = document.activeElement;
  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }
  return isTextEntry(activeElement);
}
