import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  build: {
    emptyOutDir: false,
    outDir: "dist/renderer"
  }
});
