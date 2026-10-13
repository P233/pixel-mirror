import svelteSvg from "@poppanator/sveltekit-svg";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import path from "path";
import { defineConfig } from "vitest/config";
import { svgPluginOptions } from "./svg.config";

export default defineConfig({
  plugins: [svelte(), svelteSvg(svgPluginOptions), svelteTesting()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,ts}"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,svelte}"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts", "src/**/*.spec.ts", "src/**/__mocks__/**"]
    }
  },
  resolve: {
    conditions: process.env.VITEST ? ["browser"] : undefined,
    alias: [{ find: "~", replacement: path.resolve("src") }]
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "${path.resolve("src/styles/shared.scss")}" as *;`
      }
    }
  }
});
