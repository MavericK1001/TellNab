import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "support-site-react"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "support-dist"),
    emptyOutDir: true,
  },
});
