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
      "We do not sell or share your mobile information or SMS opt-in data and consent with third parties or affiliates for marketing or promotional purposes.",
    );
    expect(policySource).toContain("We ask for your permission during a phone call before sending one text");
    expect(policySource).toContain("Providing a phone number or submitting a website form does not enroll you in text messages.");
    expect(policySource).toContain("Consent is not a condition of purchase.");
    expect(policySource).toContain("Message and data rates may apply.");
    expect(policySource).toContain("<strong>STOP</strong>");
    expect(policySource).toContain('href="/terms"');
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
    expect(policySource).toContain("random anonymous browser-session identifier");
    expect(policySource).toContain("We do not store the visitor&rsquo;s full IP address");
    expect(policySource).toContain("connect a session to a particular lead or email address");
    expect(policySource).toContain("automatically deleted after 90 days");

    const modalSource = readSource("client/src/components/PrivacyPolicyModal.tsx");
    expect(modalSource).toContain("Report Engagement Data");
    expect(modalSource).toContain("first-party event recording");
    expect(modalSource).toContain("automatically deleted after 90 days");
  });
});
