import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

const publicPages = [
  "index.html",
  "results.html",
  "contact.html",
  "scan.html",
  "thanks.html",
  "contact-thanks.html",
  "privacy-policy.html",
];

describe("Google Tag Manager installation", () => {
  it.each(publicPages)("installs GTM in the required positions on %s", (page) => {
    const source = readSource(`client/public/${page}`);

    expect(source).toContain("<head>\n    <!-- Google Tag Manager -->");
    expect(source).toContain(
      "<body>\n    <!-- Google Tag Manager (noscript) -->",
    );
    expect(source.match(/GTM-W32XD49H/g)).toHaveLength(2);
  });

  it("excludes private app, demo, and preview entry points", () => {
    const excludedPages = [
      "_app.html",
      "empieza.html",
      "crece.html",
      "domina.html",
      "preview-empieza.html",
      "preview-crece.html",
      "preview-domina.html",
    ];

    excludedPages.forEach((page) => {
      expect(readSource(`client/${page}`)).not.toContain("GTM-W32XD49H");
    });
  });
});
