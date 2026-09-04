import { describe, expect, it } from "vitest";
import { extractSnapshot } from "../../server/features/technical-seo/extract";
import { analyzeScan } from "../../server/features/technical-seo/analyze";
import { technicalSeoFixturePages } from "../fixtures/technical-seo/fixturePages";

function snapshot(path: string, profile: "neutral_raw" | "simulated_googlebot_raw" | "simulated_googlebot_rendered", html?: string) {
  return extractSnapshot({
    profile,
    requestedUrl: `https://fixture.example${path}`,
    finalUrl: `https://fixture.example${path}`,
    statusCode: technicalSeoFixturePages[path]?.status ?? 200,
    responseTimeMs: 10,
    redirects: [], headers: {}, html: html ?? technicalSeoFixturePages[path].body,
  });
}

describe("technical SEO evidence extraction", () => {
  it("extracts canonical, headings, links, and metadata", () => {
    const result = snapshot("/static", "simulated_googlebot_raw");
    expect(result.title).toBe("Static Fixture");
    expect(result.canonical).toEqual(["https://fixture.example/static"]);
    expect(result.h1).toEqual(["Static fixture"]);
    expect(result.internalLinks).toEqual(["https://fixture.example/about"]);
  });

  it("preserves malformed JSON-LD as evidence", () => {
    const result = snapshot("/malformed-schema", "simulated_googlebot_rendered");
    expect(result.structuredData).toHaveLength(1);
    expect(result.structuredData[0].valid).toBe(false);
  });

  it("detects noindex conservatively", () => {
    const neutral = snapshot("/noindex", "neutral_raw");
    const raw = snapshot("/noindex", "simulated_googlebot_raw");
    const rendered = snapshot("/noindex", "simulated_googlebot_rendered");
    const result = analyzeScan(neutral, raw, rendered, { url: "https://fixture.example/robots.txt", statusCode: 200, allowed: true, matchedAgent: "googlebot", applicableRules: [], sitemaps: [], error: null }, { checked: [], foundIn: [], errors: [] });
    expect(result.summary.indexability).toBe("not_indexable");
    expect(result.issues.some((item) => item.id === "noindex")).toBe(true);
  });

  it("separates JavaScript appearance from a fetch-profile difference", () => {
    const raw = snapshot("/js-content", "simulated_googlebot_raw");
    const renderedHtml = `<!doctype html><html><head><title>JS Fixture</title></head><body><main><h1>Rendered heading</h1><p>${"Rendered content ".repeat(60)}</p></main></body></html>`;
    const rendered = snapshot("/js-content", "simulated_googlebot_rendered", renderedHtml);
    const result = analyzeScan(snapshot("/js-content", "neutral_raw"), raw, rendered, { url: "https://fixture.example/robots.txt", statusCode: 200, allowed: true, matchedAgent: "googlebot", applicableRules: [], sitemaps: [], error: null }, { checked: [], foundIn: [], errors: [] });
    expect((result.comparisons.rawVsRendered.meaningfulContent as any).changed).toBe(true);
    expect((result.comparisons.fetchProfiles.meaningfulContent as any).changed).toBe(false);
    expect(result.issues.some((item) => item.id === "js-dependent-content")).toBe(true);
  });
});
