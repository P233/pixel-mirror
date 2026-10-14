import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

// Served by the dev server itself, so the URL works wherever the package is installed
// (hoisted monorepos, pnpm stores, linked packages) and regardless of `server.fs.allow`
const SCRIPT_URL = "/@pixel-mirror/index.js";
const SCRIPT_FILE = fileURLToPath(new URL("../dist/index.js", import.meta.url));

export default function pixelMirror() {
  return {
    name: "pixel-mirror",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(SCRIPT_URL, (_req, res) => {
        createReadStream(SCRIPT_FILE)
          .on("open", () => {
            res.setHeader("Content-Type", "text/javascript; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
          })
          .on("error", () => {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(`pixel-mirror: ${SCRIPT_FILE} not found. Run the package build first.`);
          })
          .pipe(res);
      });
    },
    transformIndexHtml() {
      return [{ tag: "script", attrs: { src: SCRIPT_URL, defer: true }, injectTo: "head" }];
    }
  };
}
