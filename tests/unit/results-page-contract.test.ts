import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanPublicPageFiles } from "../../server/public-pages";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const resultsHtml = fs.readFileSync(
  path.join(projectRoot, "client/public/results.html"),
  "utf8",
);

describe("client results page", () => {
  it("publishes each case study through its dedicated URL and selector entry", () => {
    expect(cleanPublicPageFiles["/results/glass-and-door-pro"]).toBe("results.html");
    expect(cleanPublicPageFiles["/results/carolina-custom-automation"]).toBe("results.html");
    expect(resultsHtml).toContain('location.pathname.indexOf("carolina-custom-automation") !== -1');
    expect(resultsHtml).toContain('class="results-case-picker" aria-label="Featured client results"');
    expect(resultsHtml).not.toContain('class="results-case-picker" aria-label="Featured client results" hidden');
    expect(resultsHtml).toContain('data-results-case-link="glass-and-door-pro"');
    expect(resultsHtml).toContain('data-results-case-link="carolina-custom-automation"');
    expect(resultsHtml).toContain('data-results-case-panel="glass-and-door-pro"');
    expect(resultsHtml).toContain('data-results-case-panel="carolina-custom-automation"');
  });

  it("keeps the Carolina Custom Automation scans in their clarified chronology", () => {
    const original = resultsHtml.indexOf("carolina-custom-automation-original-clover-3-mile-20260901.png");
    const sixtyDays = resultsHtml.indexOf("carolina-custom-automation-60-days-fort-mill-3-mile-20260901.png");
    const latest = resultsHtml.indexOf("carolina-custom-automation-latest-fort-mill-5-mile-20260901.png");

    expect(original).toBeGreaterThan(-1);
    expect(original).toBeLessThan(sixtyDays);
    expect(sixtyDays).toBeLessThan(latest);
    expect(resultsHtml).toContain("60 Days Later + Fort Mill Move");
    expect(resultsHtml).toContain("not a controlled same-location comparison");
  });

  it("states the reported lead count and owner quote", () => {
    expect(resultsHtml).toContain("10&ndash;14 Google leads per week");
    expect(resultsHtml).toContain("No regular Google inquiries");
    expect(resultsHtml).toContain("We&rsquo;ve had a 5 star Google Business Profile and website for over 5 years and just now started getting Google leads.");
    expect(resultsHtml).toContain("van-carolina-custom-automation-avatar-20260901-v1.webp");
  });
});
