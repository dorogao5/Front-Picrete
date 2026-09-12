import { buildInfo } from "./build-info.ts";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), buildInfo()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/\/(react-markdown|remark-|rehype-|katex|unified|micromark|mdast-|hast-)/.test(id)) {
            return "content";
          }
          if (/\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return "vendor";
          if (id.includes("/lucide-react/")) return "ui";
          return undefined;
        },
      },
    },
  },
}));
