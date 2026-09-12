import { describe, expect, it } from "vitest";
import type { TechnicalSeoScanResult } from "../../shared/technicalSeo";
import { normalizeTechnicalSeoResult } from "../../shared/technicalSeoScoring";
import { assessTrustConversion } from "../../shared/technicalSeoTrust";

function lakeWylieResult(): TechnicalSeoScanResult {
  const baseSignals = { faq: false, reviews: false, privacy: false, licensingInsurance: false, specificCapacity: false };
  return {
    version: 3,
    issues: [{ id: "no-onsite-reviews", name: "No reviews", severity: "medium", category: "Trust & conversion", observation: "None", evidence: "Two pages", interpretation: "No social proof", recommendedAction: "Add reviews" }],
    summary: { finalUrl: "https://lakewylieboarding.com/", issueCounts: { critical: 0, high: 0, medium: 1, low: 0, informational: 0 } },
    profiles: {
      simulatedGooglebotRaw: { redirects: [] },
      simulatedGooglebotRendered: { viewport: "width=device-width, initial-scale=1" },
    },
    siteAudit: {
      context: { businessName: "Lake Wylie Dog Boarding", trade: "dog boarding", city: "Clover", state: "SC", targetServices: ["dog boarding"], serviceAreas: ["Clover"] },
      pages: [
        {
          url: "https://lakewylieboarding.com/", statusCode: 200, h1: ["Welcome"], internalLinks: ["https://lakewylieboarding.com/agreement%2Fforms"], platformHints: [],
          contact: { phones: ["8033153578"], emails: ["Info@lakewylieboarding.com"], addresses: [] }, signals: { socialLinks: ["https://facebook.com/example"] },
          evidence: {
            contentSignals: { ...baseSignals, pricing: false, policies: true, credentials: true, about: true },
            ctas: [
              { type: "email", label: "Book a stay for your pet", usable: true, destination: "mailto:Info@lakewylieboarding.com" },
              { type: "phone", label: "Call Now", usable: true, destination: "tel:8033153578" },
            ],
            forms: [{ action: null, method: "GET", fields: ["NAME", "EMAIL", "Message"], requiredFields: 0, hasContactField: true, submitLabel: "Send" }],
          },
        },
        {
          url: "https://lakewylieboarding.com/agreement%2Fforms", statusCode: 200, h1: ["Agreement"], internalLinks: ["https://lakewylieboarding.com/"], platformHints: [],
          contact: { phones: ["8033153578"], emails: [], addresses: [] }, signals: { socialLinks: [] },
          evidence: { contentSignals: { ...baseSignals, pricing: true, policies: true, credentials: false, about: false }, ctas: [], forms: [] },
        },
      ],
      crawl: { sitemapUrlsFound: 2 },
      grades: [
        { key: "technical", label: "Technical SEO & source code", grade: "B", score: 83, rationale: "Measured" },
        { key: "trust_conversion", label: "Trust & conversion", grade: "A", score: 92, rationale: "Old element-count score" },
      ],
    },
  } as unknown as TechnicalSeoScanResult;
}

describe("trust and conversion evidence hierarchy", () => {
  it("credits the Forms-page policies but grades the Lake Wylie journey D", () => {
    const assessment = assessTrustConversion(lakeWylieResult());
    expect(assessment).toMatchObject({ score: 66, grade: "D", trustPoints: 40, conversionPoints: 26 });
    expect(assessment?.metrics).toMatchObject({ hasPolicies: true, hasReviews: false, emailBooking: true, usefulForm: true, hasPhoneField: false, hasServiceContextField: false });
    expect(assessment?.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining(["booking-cta-uses-email", "lead-form-no-required-fields", "lead-form-lacks-decision-context", "privacy-policy-not-confirmed", "licensing-insurance-not-confirmed"]));
    expect(assessment?.issues.some((issue) => issue.id === "customer-policies-not-confirmed")).toBe(false);
  });

  it("corrects the saved grade and explains the evidence gate without another crawl", () => {
    const corrected = normalizeTechnicalSeoResult(lakeWylieResult());
    const trust = corrected.siteAudit?.grades.find((item) => item.key === "trust_conversion");
    expect(trust).toMatchObject({ grade: "D", score: 66 });
    expect(trust?.rationale).toContain("Trust evidence 40/60 and conversion readiness 26/40");
    expect(trust?.rationale).toContain("booking-intent CTA relies on email");
  });
});
