// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pixelMirror from "../plugins/vite.js";

describe("pixel-mirror Vite plugin", () => {
  let root: string;
  let server: ViteDevServer;
  let baseUrl: string;

  beforeAll(async () => {
    // A project root that has no node_modules/pixel-mirror at all, like a hoisted monorepo package
    root = await mkdtemp(path.join(tmpdir(), "pixel-mirror-vite-"));
    await writeFile(path.join(root, "index.html"), "<!doctype html><html><head></head><body></body></html>");
    server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [pixelMirror()] });
    await server.listen(0);
    baseUrl = `http://localhost:${server.config.server.port}`;
  });

  afterAll(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });

  it("injects a deferred script tag in dev", async () => {
    const html = await (await fetch(`${baseUrl}/`)).text();

    expect(html).toMatch(/<script src="\/@pixel-mirror\/index\.js" defer><\/script>/);
  });

  it("serves the bundle itself instead of falling through to the SPA index.html", async () => {
    const response = await fetch(`${baseUrl}/@pixel-mirror/index.js`);

    expect(response.headers.get("content-type")).not.toContain("text/html");
    // 404 only when the package hasn't been built yet
    expect([200, 404]).toContain(response.status);
    if (response.status === 200) expect(response.headers.get("content-type")).toBe("text/javascript");
  });

  it("only runs in dev", () => {
    expect(pixelMirror().apply).toBe("serve");
  });
});
