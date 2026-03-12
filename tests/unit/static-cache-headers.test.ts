/**
 * Static Asset Cache Header Tests
 *
 * Validates that the production static asset server (server/static.ts)
 * sends the correct Cache-Control headers:
 *
 * - /assets/* (hashed Vite bundles) → public, max-age=31536000, immutable
 * - HTML shell responses → no-store, no-cache, must-revalidate
 * - Other static files (no extension match) → max-age=0
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";
import http from "http";

let tmpDir: string;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viva-static-test-"));
  fs.mkdirSync(path.join(tmpDir, "assets"), { recursive: true });

  fs.writeFileSync(path.join(tmpDir, "assets", "index-CbJtbRdG.js"), "// hashed bundle");
  fs.writeFileSync(path.join(tmpDir, "assets", "style-abc123.css"), "/* hashed css */");
  fs.writeFileSync(path.join(tmpDir, "index.html"), "<html>app shell</html>");
  fs.writeFileSync(path.join(tmpDir, "favicon.ico"), "icon");

  const { serveStatic } = await import("../../server/static");
  const app = express();

  const origResolve = path.resolve;
  const patchedResolve = (...args: string[]) => {
    if (args.length === 2 && args[1] === "public") return tmpDir;
    return origResolve(...args);
  };

  Object.defineProperty(path, "resolve", { value: patchedResolve, configurable: true });
  serveStatic(app);
  Object.defineProperty(path, "resolve", { value: origResolve, configurable: true });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function get(url: string) {
  const res = await fetch(baseUrl + url);
  return { status: res.status, cacheControl: res.headers.get("cache-control") };
}

describe("Hashed asset cache policy", () => {
  it("serves /assets/*.js with immutable max-age=1y cache header", async () => {
    const { status, cacheControl } = await get("/assets/index-CbJtbRdG.js");
    expect(status).toBe(200);
    expect(cacheControl).toMatch(/max-age=31536000/i);
    expect(cacheControl).toMatch(/immutable/i);
  });

  it("serves /assets/*.css with immutable max-age=1y cache header", async () => {
    const { status, cacheControl } = await get("/assets/style-abc123.css");
    expect(status).toBe(200);
    expect(cacheControl).toMatch(/max-age=31536000/i);
    expect(cacheControl).toMatch(/immutable/i);
  });

  it("does NOT send immutable header on favicon (non-hashed asset)", async () => {
    const { cacheControl } = await get("/favicon.ico");
    expect(cacheControl).not.toMatch(/immutable/i);
  });
});

describe("HTML shell cache policy", () => {
  it("SPA catch-all returns no-store header", async () => {
    const { cacheControl } = await get("/some-spa-route");
    expect(cacheControl).toMatch(/no-store/i);
    expect(cacheControl).toMatch(/no-cache/i);
  });

  it("SPA catch-all returns must-revalidate header", async () => {
    const { cacheControl } = await get("/");
    expect(cacheControl).toMatch(/must-revalidate/i);
  });
});
