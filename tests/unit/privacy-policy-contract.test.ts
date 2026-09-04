import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("privacy policy contract", () => {
  it("provides a public privacy policy route linked from the footer", () => {
    const routesSource = readSource("server/public-pages.ts");
    const publicPages = [
      "index.html",
      "results.html",
      "contact.html",
      "scan.html",
      "thanks.html",
      "contact-thanks.html",
    ];

    expect(routesSource).toContain('"/privacy-policy": "privacy-policy.html"');
    publicPages.forEach((page) => {
      const pageSource = readSource(`client/public/${page}`);
      expect(pageSource).toContain(
        'href="/privacy-policy">Privacy Policy</a>',
      );
      expect(pageSource).toContain('<nav aria-label="Footer navigation">');
      expect(pageSource).not.toContain("<h3>Site</h3>");
    });
  });

  it("includes the required mobile information disclosure", () => {
    const policySource = readSource("client/public/privacy-policy.html");

    expect(policySource).toContain("4. Mobile Information and SMS Consent");
    expect(policySource).toContain(
      "No Mobile information will be shared with third parties/affiliates for marketing/promotional purposes.",
    );
    expect(policySource).toContain(
      "All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.",
    );
    expect(policySource).toContain("Message frequency varies.");
    expect(policySource).toContain("Message and data rates may apply.");
    expect(policySource).toContain(
      "Providing a phone number or submitting a form does not by itself enroll you in text messages.",
    );
  });

  it("accurately covers analytics, retention, collected scan data, and children", () => {
    const policySource = readSource("client/public/privacy-policy.html");

    expect(policySource).toContain("Google Analytics, deployed through Google Tag Manager");
    expect(policySource).toContain("business address or Google Business Profile link");
    expect(policySource).toContain("6. Data Retention");
    expect(policySource).toContain("children under the age of 13");
    expect(policySource).not.toContain("11. Communications");
    expect(policySource).toContain("We do not load Google Analytics on scan-report pages.");
    expect(policySource).toContain("Report Engagement Data");
    expect(policySource).toContain("first-party event recording");

    const modalSource = readSource("client/src/components/PrivacyPolicyModal.tsx");
    expect(modalSource).toContain("Report Engagement Data");
    expect(modalSource).toContain("first-party event recording");
  });
});
