import { svelte } from "@sveltejs/vite-plugin-svelte";
import cssnano from "cssnano";
import path from "path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

/**
 * Vite plugin to remove data-testid attributes in production builds
 */
function removeTestIds(): Plugin {
  return {
    name: "remove-test-ids",
    apply: "build",
    transform(code, id) {
      if (id.endsWith(".svelte") && code.includes("data-testid")) {
        // Remove data-testid="..." attributes from Svelte templates
        return {
          code: code.replace(/\s*data-testid="[^"]*"/g, ""),
          map: null // Indicate no sourcemap changes
        };
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 3000
  },
  plugins: [removeTestIds(), svelte()],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "~/styles/shared.scss" as *;`
      }
    },
    postcss: {
      plugins: [
        cssnano({
          preset: [
            "cssnano-preset-advanced",
            {
              discardUnused: { fontFace: false },
              zindex: false
            }
          ]
        })
      ]
    }
  },
  resolve: {
    alias: [{ find: "~", replacement: path.resolve("src") }]
  },
  build: {
    lib: {
      entry: "src/main.ts",
      name: "PixelMirror",
      formats: ["iife"],
      fileName: () => "index.js"
    },
    rolldownOptions: {
      output: {
        // Escape non-ASCII text: a classic script on a page without a UTF-8 charset is decoded as Latin-1
        minify: { compress: true, mangle: true, codegen: { asciiOnly: true } }
      }
    }
  }
});
