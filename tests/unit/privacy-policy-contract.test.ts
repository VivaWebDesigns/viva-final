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
      expect(readSource(`client/public/${page}`)).toContain(
        'href="/privacy-policy">Privacy Policy</a>',
      );
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
  });
});
