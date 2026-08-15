import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("privacy policy contract", () => {
  it("provides a public privacy policy route linked from the footer", () => {
    const appSource = readSource("client/src/App.tsx");
    const footerSource = readSource("client/src/components/Footer.tsx");

    expect(appSource).toContain('<Route path="/privacy-policy" component={PrivacyPolicy} />');
    expect(footerSource).toContain('href="/privacy-policy"');
  });

  it("includes the required mobile information disclosure", () => {
    const policySource = readSource("client/src/components/PrivacyPolicyModal.tsx");

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
