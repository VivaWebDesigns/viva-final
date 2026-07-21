import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import http from "http";
import {
  cleanPublicPageRedirects,
  registerCleanPublicPageRedirects,
} from "../../server/public-pages";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  registerCleanPublicPageRedirects(app);

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  baseUrl = `http://localhost:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("legacy public page redirects", () => {
  it.each(Object.entries(cleanPublicPageRedirects))(
    "redirects %s permanently to %s",
    async (legacyPath, cleanPath) => {
      const response = await fetch(baseUrl + legacyPath, { redirect: "manual" });
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(cleanPath);
    },
  );
});
