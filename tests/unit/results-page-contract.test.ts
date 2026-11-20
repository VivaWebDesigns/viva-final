import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanPublicPageFiles } from "../../server/public-pages";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const resultsHtml = fs.readFileSync(
  path.join(projectRoot, "client/public/results.html"),
  "utf8",
);

const carolinaHtml = fs.readFileSync(path.join(projectRoot, "client/public/results-carolina-custom-automation.html"), "utf8");

describe("client results page", () => {
  it("links each case study to its own public page", () => {
    for (const slug of ["glass-and-door-pro", "carolina-custom-automation"]) {
      expect(cleanPublicPageFiles[`/results/${slug}`]).toBe(`results-${slug}.html`);
      expect(resultsHtml).toContain(`href="/results/${slug}"`);
    }
  });

  it("keeps the Carolina Custom Automation scans in their clarified chronology", () => {
    const original = carolinaHtml.indexOf("carolina-custom-automation-original-clover-3-mile-20260901.png");
    const sixtyDays = carolinaHtml.indexOf("carolina-custom-automation-60-days-fort-mill-3-mile-20260901.png");
    const latest = carolinaHtml.indexOf("carolina-custom-automation-latest-fort-mill-5-mile-20260901.png");

    expect(original).toBeGreaterThan(-1);
    expect(original).toBeLessThan(sixtyDays);
    expect(sixtyDays).toBeLessThan(latest);
    expect(carolinaHtml).toContain("60 days later · Fort Mill");
    expect(carolinaHtml).toContain("not a controlled, same-location comparison");
  });

  it("states the reported lead count and owner quote", () => {
    expect(carolinaHtml).toContain("10–14 Google leads per week");
    expect(carolinaHtml).toContain("No regular Google inquiries");
    expect(carolinaHtml).toContain("We’ve had a 5 star Google Business Profile and website for over 5 years and just now started getting Google leads.");
    expect(carolinaHtml).toContain("van-carolina-custom-automation-avatar-20260901-v1.webp");
  });
});
