import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function cssInjectedByJs(): Plugin {
  return {
    name: "embed-css-in-js",
    apply: "build",
    generateBundle(_, bundle) {
      const css: string[] = [];
      for (const [key, item] of Object.entries(bundle)) {
        if (item.type === "asset" && item.fileName.endsWith(".css")) {
          css.push(String(item.source));
          delete bundle[key];
        }
      }
      if (!css.length) return;
      const js = Object.values(bundle).find((item) => item.type === "chunk");
      if (js && js.type === "chunk") {
        js.code = `document.head.appendChild(Object.assign(document.createElement("style"),{textContent:${JSON.stringify(css.join("\n"))},dataset:{gafaEmbed:"css"}}));${js.code}`;
      }
    },
  };
}

/**
 * IIFE con React y CSS adentro, para pegar un <script> en WordPress/Elementor
 * sin instalar nada en el tema.
 *
 *   npm run build:embed  →  ../../docs/v2-embed/gafa-embed.js
 */
export default defineConfig({
  plugins: [react(), cssInjectedByJs()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "../../docs/v2-embed",
    emptyOutDir: true,
    lib: {
      entry: "src/sdk/embed.ts",
      name: "GafaThemeEmbed",
      fileName: () => "gafa-embed.js",
      formats: ["iife"],
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: "gafa-embed.[ext]",
      },
    },
  },
});
