import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the built site works on GitHub Pages / any subpath.
  base: "./",
  server: {
    open: true,
  },
});
