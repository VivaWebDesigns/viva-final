import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const r = (...parts: string[]) => path.resolve(import.meta.dirname, ...parts);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Static-asset stub — any @assets/… import gets a harmless string stub
      { find: /^@assets\/.*$/, replacement: r("tests/__mocks__/assetStub.ts") },
      // Path aliases matching tsconfig.json + vite.config.ts (specific before general)
      { find: "@features", replacement: r("client/src/features") },
      { find: "@shared",   replacement: r("shared") },
      { find: "@",         replacement: r("client/src") },
    ],
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
    server: {
      deps: {
        inline: ["framer-motion"],
      },
    },
  },
});
