import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 4173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
});
