import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({ default: { lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) } }));

import { safeFetchHtml } from "../../server/features/technical-seo/http-fetch";
import { VIVA_SCANNER_USER_AGENT } from "../../server/features/technical-seo/constants";

afterEach(() => vi.unstubAllGlobals());

describe("bounded technical SEO HTTP fetch", () => {
  it("records a public redirect chain", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 301, headers: { location: "https://example.com/final" } }))
      .mockResolvedValueOnce(new Response("<html><body>Final</body></html>", { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await safeFetchHtml("https://example.com/start", VIVA_SCANNER_USER_AGENT);
    expect(result.finalUrl).toBe("https://example.com/final");
    expect(result.redirects).toEqual([{ from: "https://example.com/start", to: "https://example.com/final", status: 301 }]);
  });

  it("blocks a redirect to a private address before requesting it", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetchHtml("https://example.com/start", VIVA_SCANNER_USER_AGENT)).rejects.toMatchObject({ code: "UNSAFE_URL" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops reading an oversized response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(101), { status: 200 })));
    await expect(safeFetchHtml("https://example.com/large", VIVA_SCANNER_USER_AGENT, { maxBytes: 100 })).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});
