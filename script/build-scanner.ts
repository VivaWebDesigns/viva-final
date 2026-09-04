import { build } from "esbuild";
import { rm, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

async function buildScanner() {
  console.log("type-checking scanner...");
  execSync("npx tsc --noEmit", { stdio: "inherit" });
  await rm("dist/scanner-worker.cjs", { force: true });
  await mkdir("dist", { recursive: true });
  await build({
    entryPoints: ["server/scanner-worker.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/scanner-worker.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    external: ["playwright", "playwright-core", "pg-native"],
    minify: true,
    logLevel: "info",
  });
}

buildScanner().catch((error) => { console.error(error); process.exit(1); });
