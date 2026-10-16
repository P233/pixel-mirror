/**
 * Main Entry Point Tests
 *
 * Tests for the main.ts entry point behavior.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Each test file gets its own window, so one stand-in element class is enough
vi.mock("./App.svelte", () => ({
  default: { element: class extends HTMLElement {} }
}));

describe("main.ts", () => {
  beforeEach(() => {
    vi.resetModules();

    // Reset DOM state
    if (!document.body) document.documentElement.appendChild(document.createElement("body"));
    document.body.innerHTML = "";
    document.documentElement.style.position = "";
  });

  it("creates pixel-mirror element if not present", async () => {
    expect(document.querySelector("pixel-mirror")).toBeNull();

    await import("./main");

    expect(document.querySelector("pixel-mirror")).toBeInTheDocument();
    expect(customElements.get("pixel-mirror")).toBeDefined();
  });

  it("does not create duplicate element if already present", async () => {
    // Pre-create the element
    const existingElement = document.createElement("pixel-mirror");
    document.body.appendChild(existingElement);

    await import("./main");

    const elements = document.querySelectorAll("pixel-mirror");
    expect(elements.length).toBe(1);
  });

  it("does not throw when the script is loaded a second time", async () => {
    await import("./main");
    vi.resetModules();

    await expect(import("./main")).resolves.toBeDefined();
    expect(document.querySelectorAll("pixel-mirror")).toHaveLength(1);
  });

  it("waits for the DOM when the script runs before <body> exists", async () => {
    document.body.remove();

    await import("./main");
    expect(document.querySelector("pixel-mirror")).toBeNull();

    document.documentElement.appendChild(document.createElement("body"));
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(document.querySelector("pixel-mirror")).toBeInTheDocument();
  });

  it("restores the element after an Astro view transition replaces <body>", async () => {
    await import("./main");

    document.body.replaceWith(document.createElement("body"));
    expect(document.querySelector("pixel-mirror")).toBeNull();
    document.dispatchEvent(new Event("astro:after-swap"));

    expect(document.querySelector("pixel-mirror")).toBeInTheDocument();
  });

  it.each(["", "static", "absolute"])("preserves host html positioning %j", async (position) => {
    document.documentElement.style.position = position;

    await import("./main");

    expect(document.documentElement.style.position).toBe(position);
  });
});
