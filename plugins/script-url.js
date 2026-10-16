export function scriptUrl(base) {
  const pathname = new URL(base, "http://pixel-mirror.local").pathname;
  return `${pathname.replace(/\/?$/, "/")}@pixel-mirror/index.js`;
}
