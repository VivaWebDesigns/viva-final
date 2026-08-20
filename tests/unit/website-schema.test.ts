import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vivaOrganizationSchema } from "../../client/src/components/JsonLd";

const expectedAddress = {
  "@type": "PostalAddress",
  addressLocality: "Charlotte",
  addressRegion: "NC",
  addressCountry: "US",
};

function getPublicHomepageSchema() {
  const projectRoot = path.resolve(import.meta.dirname, "../..");
  const homepage = fs.readFileSync(path.join(projectRoot, "client/public/index.html"), "utf8");
  const jsonLd = homepage.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  if (!jsonLd) throw new Error("Homepage JSON-LD schema not found");
  return JSON.parse(jsonLd[1]);
}

const publicPageNames = [
  "index.html",
  "contact.html",
  "results.html",
  "scan.html",
  "contact-thanks.html",
  "thanks.html",
  "privacy-policy.html",
];

describe("Viva website schema", () => {
  it("identifies Viva as a Charlotte organization without publishing its street address", () => {
    expect(vivaOrganizationSchema["@type"]).toBe("Organization");
    expect(getPublicHomepageSchema()["@type"]).toBe("Organization");
    expect(vivaOrganizationSchema.address).toEqual(expectedAddress);
    expect(getPublicHomepageSchema().address).toEqual(expectedAddress);
    expect(JSON.stringify(vivaOrganizationSchema)).not.toContain("1628 Redcoat Dr");
    expect(JSON.stringify(getPublicHomepageSchema())).not.toContain("1628 Redcoat Dr");
  });

  it("shows the Charlotte base and business hours in every public page footer", () => {
    const projectRoot = path.resolve(import.meta.dirname, "../..");
    for (const pageName of publicPageNames) {
      const page = fs.readFileSync(path.join(projectRoot, "client/public", pageName), "utf8");
      const footer = page.split('<footer class="site-footer">')[1];
      expect(footer, `${pageName} footer`).toContain("Based in Charlotte, NC");
      expect(footer, `${pageName} weekday hours`).toContain("Mon&ndash;Fri: 8 AM&ndash;6 PM");
      expect(footer, `${pageName} Saturday hours`).toContain("Sat: 10 AM&ndash;4 PM");
      expect(footer, `${pageName} Sunday hours`).toContain("Sun: Closed");
    }
  });
});
