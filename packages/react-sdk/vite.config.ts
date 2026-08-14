import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Librería (React externo). El drop-in de WP es vite.embed.config.ts. */
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
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
