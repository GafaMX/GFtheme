import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Librería (React externo). El drop-in de WP/Replit/HTML es vite.embed.config.ts.
 *  `npm run dev` también sirve `/src/sdk/embed.ts` para que cualquier origen
 *  lo cargue en vivo (type=module) sin copiar source ni publicar el IIFE. */
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  build: {
    lib: {
      entry: "src/sdk/index.ts",
      name: "GafaThemeReactSdk",
      fileName: "gafa-theme-react-sdk",
      formats: ["es", "umd"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react-dom/client": "ReactDOM",
        },
      },
    },
  },
});
