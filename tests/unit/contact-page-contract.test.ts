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
  it("keeps the general contact form concise and offers optional SMS consent", () => {
    expect(contactHtml).toContain('action="/contact-submit"');
    expect(contactHtml).toContain('name="name"');
    expect(contactHtml).toContain('name="business" autocomplete="organization" required');
    expect(contactHtml).toContain('name="email"');
    expect(contactHtml).toContain('name="phone"');
    expect(contactHtml).toContain('name="message"');
    expect(contactHtml).toContain('name="smsConsent" type="checkbox" value="yes"');
    expect(contactHtml).toContain("Consent is not a condition of purchase.");
    expect(contactHtml).toContain('href="/privacy-policy"');
    expect(contactHtml).not.toMatch(/name="smsConsent"[^>]+required/);

    expect(contactHtml).not.toContain('name="website"');
    expect(contactHtml).not.toContain('name="city"');
    expect(contactHtml).not.toContain('name="trade"');
  });

  it("records SMS consent only when it is affirmatively checked", () => {
    const contactHandler = routesSource
      .split('app.post("/contact-submit"')[1]
      .split('app.post("/api/contacts"')[0];

    expect(contactHandler).toContain('req.body.smsConsent === "yes"');
    expect(contactHandler).toContain('smsConsentRecord(smsConsented, "contact_form")');
    expect(contactHandler).toContain("Please enter a phone number or uncheck SMS consent.");
  });

  it("requires a company name for public contact submissions", () => {
    expect(routesSource).toContain(
      'business: z.string().trim().min(1, "Company name is required")',
    );
    expect(routesSource).toContain("contactSubmitSchema.parse(req.body)");
    expect(routesSource).toContain("<strong>Company</strong>");
  });

  it("redirects general contact submissions to their own confirmation page", () => {
    const contactHandler = routesSource
      .split('app.post("/contact-submit"')[1]
      .split('app.post("/api/contacts"')[0];

    expect(contactHandler).toContain('res.redirect(303, "/contact-thanks")');
    expect(contactHandler).toContain(
      "res.redirect(303, `/contact-thanks?lead_type=contact&lead_event_id=${leadEventId}`)",
    );
    expect(contactHandler).not.toContain('res.redirect(303, "/thanks")');
  });

  it("keeps contact and scan confirmation messages distinct", () => {
    expect(contactThanksHtml).toContain("Your message has been sent");
    expect(contactThanksHtml).not.toContain("Your scan is on the way");
    expect(scanThanksHtml).toContain("Your scan is on the way");
    expect(scanThanksHtml).toContain('href="/results">See Client Results');
    expect(scanThanksHtml).not.toContain('href="/scan">Get Your Free Visibility Scan');
  });

  it("keeps the contact card location concise", () => {
    expect(contactHtml).toContain("<dt>Based in</dt><dd>Charlotte, NC</dd>");
  });

  it("offers the Calendly Google Meet booking option", () => {
    const calendlyUrl = "https://calendly.com/vivawebdesigns/new-meeting";
    const calendlyLinks = contactHtml.match(
      new RegExp(`href="${calendlyUrl}"`, "g"),
    );

    expect(calendlyLinks).toHaveLength(3);
    expect(contactHtml).toContain("Book a Google Meet");
    expect(contactHtml).toContain("Google Visibility Review");
    expect(contactHtml).toContain("Review the weak spots on your heat map");
    expect(contactHtml).toContain("Book My Video Call");
    expect(contactHtml).toContain("matt-visibility-review-20260828-v4.webp?v=20260828-upright-v4");
    expect(contactHtml).toContain('target="_blank" rel="noopener noreferrer"');
  });
});
