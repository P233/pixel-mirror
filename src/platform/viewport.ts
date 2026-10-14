/**
 * Page and viewport measurements of the host document
 */

import { on } from "svelte/events";

/** Center of the visible area, in page coordinates */
export function readViewportCenter(): Position {
  const { clientWidth, clientHeight } = document.documentElement;
  return { x: window.scrollX + clientWidth / 2, y: window.scrollY + clientHeight / 2 };
}

/** Convert a pointer's client coordinates to page coordinates */
export function toPagePoint(clientX: number, clientY: number): Position {
  return { x: clientX + window.scrollX, y: clientY + window.scrollY };
}

/** Width without the scrollbar and full scrollable height: the area the mockup aligns to */
export function readPageSize(ignoreElement?: HTMLElement | null): Size {
  const prevHeight = ignoreElement?.style.height;
  if (ignoreElement) ignoreElement.style.height = "0px";
  const { clientWidth, scrollHeight } = document.documentElement;
  if (ignoreElement) ignoreElement.style.height = prevHeight ?? "";
  return { width: clientWidth, height: scrollHeight };
}

/** Content changes are measured at most this often (ms); each measurement forces a layout */
const CONTENT_CHANGE_THROTTLE = 150;

/**
 * Calls `onChange` with the page size now and whenever it may have changed. Returns a function
 * that stops observing.
 *
 * Resizes of <html>/<body> cover most pages. When they have a fixed height (e.g. `height: 100%`),
 * content that grows or shrinks overflows them without resizing them, so DOM changes, resource
 * loads and finished host transitions trigger a (throttled) measurement as well.
 */
export function observePageSize(
  onChange: (size: Size) => void,
  getIgnoreElement?: () => HTMLElement | null
): () => void {
  const update = () => onChange(readPageSize(getIgnoreElement?.()));
  update();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const scheduleUpdate = () => {
    timer ??= setTimeout(() => {
      timer = null;
      update();
    }, CONTENT_CHANGE_THROTTLE);
  };

  const stops = [
    on(window, "resize", update),
    // These don't leave the tool's shadow root, so only host content triggers them
    on(document, "load", scheduleUpdate, { capture: true }),
    on(document, "transitionend", scheduleUpdate, { capture: true }),
    on(document, "animationend", scheduleUpdate, { capture: true })
  ];
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
  resizeObserver?.observe(document.documentElement);
  if (document.body) resizeObserver?.observe(document.body);
  // Mutations inside the tool's shadow root are not reported, so measuring can't feed back into itself
  const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(scheduleUpdate);
  mutationObserver?.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true
  });

  return () => {
    stops.forEach((stop) => stop());
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    if (timer !== null) clearTimeout(timer);
  };
}
