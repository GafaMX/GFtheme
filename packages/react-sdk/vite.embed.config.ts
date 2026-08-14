import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Build drop-in para WordPress: un IIFE con React 19 DENTRO (no peer externo).
 * El socio cambia el <script src> del theme; no copia TypeScript a Replit.
 *
 *   npm run build:embed   →  dist-embed/gafa-sdk.js
 */

/** Un solo <script>, como v1: el CSS viaja inyectado en el JS. */
function injectCssIntoJs(): Plugin {
  return {
    name: "inject-css-into-js",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const cssChunks: string[] = [];
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === "asset" && fileName.endsWith(".css")) {
          cssChunks.push(String(item.source));
          delete bundle[fileName];
        }
      }
      if (cssChunks.length === 0) {
        return;
      }
      const jsEntry = Object.values(bundle).find((item) => item.type === "chunk" && item.isEntry);
      if (!jsEntry || jsEntry.type !== "chunk") {
        return;
      }
      jsEntry.code =
        `(function(){var d=document;if(!d)return;var s=d.createElement("style");s.setAttribute("data-gafa-sdk","embed");s.appendChild(d.createTextNode(${JSON.stringify(cssChunks.join("\n"))}));(d.head||d.documentElement).appendChild(s);})();\n` +
        jsEntry.code;
    },
  };
}

export default defineConfig({
  plugins: [react(), injectCssIntoJs()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-embed",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: "src/sdk/embed.ts",
      name: "GafaFitSdkEmbed",
      formats: ["iife"],
      fileName: () => "gafa-sdk.js",
    },
  },
});
