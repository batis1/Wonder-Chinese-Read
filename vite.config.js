import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { compressBuild } from "./scripts/compress-build.mjs";
import path from "node:path";
export default defineConfig(({ mode }) => ({
  define: { "import.meta.env.VITE_HOSTED": JSON.stringify(mode === "hosted") },
  plugins: [
    react(),
    {
      name: "preload-course-catalog",
      transformIndexHtml() {
        return mode === "hosted" ? [{ tag: "link", attrs: { rel: "preload", href: "/courses/catalog.json", as: "fetch", crossorigin: "anonymous" }, injectTo: "head" }] : [];
      },
    },
    {
      name: "precompress-assets",
      closeBundle() {
        compressBuild(path.resolve("dist"));
      },
    },
  ],
  server: { host: "127.0.0.1" },
}));
