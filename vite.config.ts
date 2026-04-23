/**
 * PaneHop client Vite build configuration.
 *
 * Purpose: build the frontend from `src/client/` into `dist/client` while
 * keeping the Node backend routes unchanged while allowing page entry HTML to
 * live under `src/client/pages/`.
 *
 * Boundary: client build tooling only.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  root: path.join(__dirname, "src", "client"),
  build: {
    emptyOutDir: true,
    outDir: path.join(__dirname, "dist", "client"),
    sourcemap: true,
    rollupOptions: {
      input: {
        index: path.join(__dirname, "src", "client", "pages", "index.html"),
        app: path.join(__dirname, "src", "client", "pages", "app.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
