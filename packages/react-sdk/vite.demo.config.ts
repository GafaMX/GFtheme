import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Build ESTATICO del sitio de prueba (demo.html): genera archivos planos que se
 * pueden subir a cualquier hosting (p.ej. el Azure de buq-sdk-dev) sin depender
 * de un dev server ni de tuneles. La config principal (vite.config.ts) compila
 * la libreria; esta compila la pagina.
 *
 *   npm run build:demo   →  dist-demo/
 */
export default defineConfig({
  plugins: [react()],
  // Rutas relativas: el build debe funcionar colgado de cualquier carpeta del
  // hosting (p.ej. /v2-demo/ en el Azure de buq-sdk-dev), no solo en la raiz.
  base: "./",
  build: {
    outDir: "dist-demo",
    rollupOptions: {
      input: {
        demo: "demo.html",
      },
    },
  },
});
