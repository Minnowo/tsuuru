import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";

import { readFile, writeFile } from "node:fs/promises";

function standaloneHtml() {
  return {
    name: "standalone-html",
    async closeBundle() {
      const htmlPath = "dist/index.html";
      const jsPath = "dist/index.js";
      const cssPath = "dist/index.css";

      let html = await readFile(htmlPath, "utf8");
      const js = await readFile(jsPath, "utf8");
      const css = await readFile(cssPath, "utf8");

      // Remove Vite-generated script tag
      html = html.replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/g, "");

      // Remove Vite-generated stylesheet link
      html = html.replace(/<link[^>]*href="[^"]+\.css"[^>]*\/?>/g, "");

      // Insert CSS in head
      html = html.replace("</head>", `<style>${css}</style>\n</head>`);

      // Insert JS at bottom of body
      html = html.replace("</body>", `<script>${js}</script>\n</body>`);

      await writeFile(htmlPath, html);

      console.log("Generated standalone dist/index.html");
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), preact(), standaloneHtml()],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "index.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
