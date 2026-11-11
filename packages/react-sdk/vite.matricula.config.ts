import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function writeStandaloneHtml() {
  return {
    name: "write-standalone-html",
    closeBundle() {
      const dir = resolve(root, "dist-matricula");
      const files = readdirSync(dir);
      const jsName = files.find((name) => name.endsWith(".js"));
      const cssName = files.find((name) => name.endsWith(".css"));
      if (!jsName) throw new Error("No JS bundle in dist-matricula");
      const js = readFileSync(resolve(dir, jsName), "utf8");
      const css = cssName ? readFileSync(resolve(dir, cssName), "utf8") : "";
      const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>The Base · Matrícula (preview SDK V2)</title>
    <script>window.__GAFA_MATRICULA_PREVIEW__ = true;</script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>${css}</style>
  </head>
  <body>
    <div id="app"></div>
    <script>${js}</script>
  </body>
</html>
`;
      const outDir = resolve(root, "../../docs/v2-preview");
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, "preview-standalone.html"), html);
    },
  };
}

export default defineConfig({
  plugins: [react(), writeStandaloneHtml()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist-matricula",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, "src/preview.tsx"),
      name: "GafaMatriculaPreview",
      formats: ["iife"],
      fileName: () => "matricula.js",
    },
  },
});
