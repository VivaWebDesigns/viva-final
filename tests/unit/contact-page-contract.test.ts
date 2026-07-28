import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "../..");
const contactHtml = fs.readFileSync(
  path.join(projectRoot, "client/public/contact.html"),
  "utf8",
);
const contactThanksHtml = fs.readFileSync(
  path.join(projectRoot, "client/public/contact-thanks.html"),
  "utf8",
);
const scanThanksHtml = fs.readFileSync(
  path.join(projectRoot, "client/public/thanks.html"),
  "utf8",
);
const routesSource = fs.readFileSync(
  path.join(projectRoot, "server/routes.ts"),
  "utf8",
);

describe("public contact form contract", () => {
  it("keeps the general contact form to four visible fields", () => {
    expect(contactHtml).toContain('action="/contact-submit"');
    expect(contactHtml).toContain('name="name"');
    expect(contactHtml).toContain('name="email"');
    expect(contactHtml).toContain('name="phone"');
    expect(contactHtml).toContain('name="message"');

    expect(contactHtml).not.toContain('name="business"');
    expect(contactHtml).not.toContain('name="website"');
    expect(contactHtml).not.toContain('name="city"');
    expect(contactHtml).not.toContain('name="trade"');
  });

  it("redirects general contact submissions to their own confirmation page", () => {
    const contactHandler = routesSource
      .split('app.post("/contact-submit"')[1]
      .split('app.post("/api/contacts"')[0];

    expect(contactHandler.match(/res\.redirect\(303, "\/contact-thanks"\)/g)).toHaveLength(2);
    expect(contactHandler).not.toContain('res.redirect(303, "/thanks")');
  });

  it("keeps contact and scan confirmation messages distinct", () => {
    expect(contactThanksHtml).toContain("Your message has been sent");
    expect(contactThanksHtml).not.toContain("Your scan is on the way");
    expect(scanThanksHtml).toContain("Your scan is on the way");
  });
});
