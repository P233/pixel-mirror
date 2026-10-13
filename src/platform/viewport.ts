/**
 * Page and viewport measurements of the host document
 */

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
export function readPageSize(): Size {
  const { clientWidth, scrollHeight } = document.documentElement;
  return { width: clientWidth, height: scrollHeight };
}

/**
 * Calls `onChange` with the page size now and whenever it may have changed
 * (window resize, or the document growing/shrinking). Returns a function that stops observing.
 */
export function observePageSize(onChange: (size: Size) => void): () => void {
  const update = () => onChange(readPageSize());
  update();

  window.addEventListener("resize", update);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
  observer?.observe(document.documentElement);
  if (document.body) observer?.observe(document.body);

  return () => {
    window.removeEventListener("resize", update);
    observer?.disconnect();
  };
}
