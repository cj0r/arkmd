import { defineConfig } from "vite";

// The renderer (viewer.html + markdown-it/highlight.js), themes.json and fonts are shared with Android.
export default defineConfig({
  publicDir: "../shared/web",
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
  build: { outDir: "dist", target: "es2022", emptyOutDir: true },
});
