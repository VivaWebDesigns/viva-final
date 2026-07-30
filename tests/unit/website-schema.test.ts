import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vivaLocalBusinessSchema } from "../../client/src/components/JsonLd";

const expectedAddress = {
  "@type": "PostalAddress",
  streetAddress: "1628 Redcoat Dr",
  addressLocality: "Charlotte",
  addressRegion: "NC",
  postalCode: "28211",
  addressCountry: "US",
};

const expectedHours = [
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "18:00",
  },
  {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: "Saturday",
    opens: "10:00",
    closes: "16:00",
  },
];

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
];

describe("Viva website schema", () => {
  it("uses the full business address in both schema sources", () => {
    expect(vivaLocalBusinessSchema.address).toEqual(expectedAddress);
    expect(getPublicHomepageSchema().address).toEqual(expectedAddress);
  });

  it("uses weekday and Saturday business hours in both schema sources", () => {
    expect(vivaLocalBusinessSchema.openingHoursSpecification).toEqual(expectedHours);
    expect(getPublicHomepageSchema().openingHoursSpecification).toEqual(expectedHours);
  });

  it("shows the schema address and hours in every public page footer", () => {
    const projectRoot = path.resolve(import.meta.dirname, "../..");
    for (const pageName of publicPageNames) {
      const page = fs.readFileSync(path.join(projectRoot, "client/public", pageName), "utf8");
      const footer = page.split('<footer class="site-footer">')[1];
      expect(footer, `${pageName} footer`).toContain("1628 Redcoat Dr, Charlotte, NC 28211");
      expect(footer, `${pageName} weekday hours`).toContain("Mon&ndash;Fri: 8 AM&ndash;6 PM");
      expect(footer, `${pageName} Saturday hours`).toContain("Sat: 10 AM&ndash;4 PM");
      expect(footer, `${pageName} Sunday hours`).toContain("Sun: Closed");
    }
  });
});
