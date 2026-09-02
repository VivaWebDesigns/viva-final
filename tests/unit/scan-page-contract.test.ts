import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scanHtml = fs.readFileSync(
  path.join(process.cwd(), "client/public/scan.html"),
  "utf8",
);

describe("visibility scan page contract", () => {
  it("preserves the scan submission endpoint and field identifiers", () => {
    expect(scanHtml).toMatch(
      /<form[^>]+action="\/scan-submit"[^>]+method="post"/,
    );

    for (const field of [
      "business",
      "address",
      "service",
      "city",
      "name",
      "email",
      "phone",
      "message",
      "smsConsent",
      "honeypot",
    ]) {
      const id = field === "honeypot"
        ? "scan-honeypot"
        : field === "smsConsent"
          ? "scan-sms-consent"
          : field;
      expect(scanHtml).toMatch(
        new RegExp(`<(?:input|textarea)[^>]+id="${id}"[^>]+name="${field}"`),
      );
    }
  });

  it("offers optional SMS consent next to the scan submission", () => {
    expect(scanHtml).toContain('name="smsConsent" type="checkbox" value="yes"');
    expect(scanHtml).toContain("Consent is not a condition of purchase.");
    expect(scanHtml).toContain('href="/privacy-policy"');
    expect(scanHtml).not.toMatch(/name="smsConsent"[^>]+required/);
  });

  it("keeps required scan data required in the browser", () => {
    for (const field of ["business", "address", "service", "city", "name", "email"]) {
      expect(scanHtml).toMatch(
        new RegExp(`<(?:input|textarea)[^>]+name="${field}"[^>]+required`),
      );
    }
  });

  it("supports company-name prefilling from personalized scan-report links", () => {
    expect(scanHtml).toContain('new URLSearchParams(window.location.search).get("business")');
    expect(scanHtml).toContain('document.getElementById("business")');
    expect(scanHtml).toContain('id="scan-request"');
  });

  it("uses one H1 and removes experimental offer language", () => {
    expect(scanHtml.match(/<h1(?:\s|>)/g)).toHaveLength(1);
    expect(scanHtml).toContain("electrician near me");
    expect(scanHtml).toContain("Charlotte, NC");
    expect(scanHtml).not.toContain("plumber near me");
    expect(scanHtml).not.toContain("Monroe Plumbing Co.");
    expect(scanHtml).not.toContain("building case studies");
    expect(scanHtml).not.toContain("proving the methodology");
    expect(scanHtml).not.toContain("No follow-up unless you ask for one");
  });
});
