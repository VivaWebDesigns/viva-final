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

  it("records CTA destinations, useful form fields, schema properties, and content signals", () => {
    const result = snapshot("/static", "simulated_googlebot_rendered", `<!doctype html><html><head><title>Evidence</title><meta name="generator" content="GoDaddy Websites + Marketing"><script type="application/ld+json">{"@type":"LocalBusiness","name":"Example","telephone":"555-555-5555","address":{"@type":"PostalAddress"}}</script></head><body><p>Rates start at $50. Read our vaccination and cancellation policies.</p><a href="tel:5555555555">Call now</a><form action="/lead" method="post"><input name="email" type="email" required><button type="submit">Request a quote</button></form><img src="one.jpg"><img src="two.jpg" alt="photo"></body></html>`);
    expect(result.pageEvidence).toMatchObject({
      generator: "GoDaddy Websites + Marketing",
      contentSignals: { pricing: true, policies: true },
      images: { total: 2, missingAlt: 1, genericAlt: 1 },
    });
    expect(result.pageEvidence?.ctas).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Call now", type: "phone", usable: true })]));
    expect(result.pageEvidence?.forms[0]).toMatchObject({ action: "https://fixture.example/lead", method: "POST", fields: ["email"], requiredFields: 1, hasContactField: true, submitLabel: "Request a quote" });
    expect(result.pageEvidence?.schemaEntities[0]).toMatchObject({ types: ["LocalBusiness"], properties: expect.arrayContaining(["name", "telephone", "address"]) });
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
