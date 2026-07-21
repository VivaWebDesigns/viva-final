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
      "honeypot",
    ]) {
      expect(scanHtml).toMatch(
        new RegExp(`<(?:input|textarea)[^>]+id="${field === "honeypot" ? "scan-honeypot" : field}"[^>]+name="${field}"`),
      );
    }
  });

  it("keeps required scan data required in the browser", () => {
    for (const field of ["business", "address", "service", "city", "name", "email"]) {
      expect(scanHtml).toMatch(
        new RegExp(`<(?:input|textarea)[^>]+name="${field}"[^>]+required`),
      );
    }
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
