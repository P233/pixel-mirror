import type svelteSvg from "@poppanator/sveltekit-svg";

type SvgPluginOptions = NonNullable<Parameters<typeof svelteSvg>[0]>;

// `{` and `}` would be read as Svelte template syntax
const escapeTemplateSyntax = (markup: string) => markup.replace(/{/g, "&#123;").replace(/}/g, "&#125;");

export const svgPluginOptions: SvgPluginOptions = {
  svgoOptions: {
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false
          }
        }
      }
    ]
  },
  // Compile the SVG content as template markup. The plugin's default wraps it in `{@html}`,
  // which assigns innerHTML directly and fails on host pages that enforce Trusted Types.
  preCompileHook: (_svg, { attributes = "", content = "" }) =>
    `<svg ${attributes} {...$$props}>${escapeTemplateSyntax(content)}</svg>`
};
