import vitePlugin from "./vite.js";
import { scriptUrl } from "./script-url.js";

export default function pixelMirror() {
  return {
    name: "pixel-mirror",
    hooks: {
      "astro:config:setup": ({ config, command, injectScript, updateConfig }) => {
        if (command !== "dev") return;

        // Reuse the Vite plugin's middleware to serve the bundle, then load it like a deferred script
        updateConfig({ vite: { plugins: [vitePlugin()] } });
        injectScript(
          "head-inline",
          `(() => {
             const script = document.createElement("script");
             script.src = ${JSON.stringify(scriptUrl(config.base))};
             document.head.appendChild(script);
           })();`
        );
      }
    }
  };
}
