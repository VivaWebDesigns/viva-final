import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@empieza": path.resolve(import.meta.dirname, "client", "src", "empieza"),
      "@crece": path.resolve(import.meta.dirname, "client", "src", "crece"),
      "@domina": path.resolve(import.meta.dirname, "client", "src", "domina"),
      "@features": path.resolve(import.meta.dirname, "client", "src", "features"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "client", "index.html"),
        empieza: path.resolve(import.meta.dirname, "client", "empieza.html"),
        crece: path.resolve(import.meta.dirname, "client", "crece.html"),
        domina: path.resolve(import.meta.dirname, "client", "domina.html"),
        // Private preview entry points — served at /preview/empieza, /preview/crece, /preview/domina
        // These are separate builds that read URL params and customize demo content at runtime.
        "preview-empieza": path.resolve(import.meta.dirname, "client", "preview-empieza.html"),
        "preview-crece": path.resolve(import.meta.dirname, "client", "preview-crece.html"),
        "preview-domina": path.resolve(import.meta.dirname, "client", "preview-domina.html"),
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
