import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { scriptUrl } from "./script-url.js";

// Served by the dev server itself, so the URL works wherever the package is installed
// (hoisted monorepos, pnpm stores, linked packages) and regardless of `server.fs.allow`
const SCRIPT_FILE = fileURLToPath(new URL("../dist/index.js", import.meta.url));

export default function pixelMirror() {
  return {
    name: "pixel-mirror",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(scriptUrl(server.config.base), (_req, res) => {
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
    transformIndexHtml(_html, context) {
      return [{ tag: "script", attrs: { src: scriptUrl(context.server.config.base), defer: true }, injectTo: "head" }];
    }
  };
}
