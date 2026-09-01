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
  it("provides a dedicated URL and selector entry for each case study", () => {
    expect(cleanPublicPageFiles["/results/glass-and-door-pro"]).toBe("results.html");
    expect(cleanPublicPageFiles["/results/carolina-custom-automation"]).toBe("results.html");
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

  it("states the reported business outcome without inventing a lead count", () => {
    expect(resultsHtml).toContain("calls and emails from Google every day");
    expect(resultsHtml).toContain("No regular Google inquiries");
    expect(resultsHtml).not.toContain("calls per day</strong><span>Carolina Custom Automation");
  });
});
