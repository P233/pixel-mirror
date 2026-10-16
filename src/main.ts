import App from "./App.svelte";

const TAG_NAME = "pixel-mirror";

function mount() {
  // Loading the script twice (e.g. the Vite plugin plus a manual <script>) must not throw
  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, App.element!);
  }

  if (!document.querySelector(TAG_NAME)) {
    document.body.appendChild(document.createElement(TAG_NAME));
  }
}
// A script that runs from <head> without `defer` (or is inserted dynamically) runs before <body> exists
if (document.body) {
  mount();
} else {
  document.addEventListener("DOMContentLoaded", mount, { once: true });
}

// Astro view transitions replace <body>, which removes the element; put it back after each swap
document.addEventListener("astro:after-swap", mount);
