import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import {
  DEFAULT_SCAN_REPORT_PREHEADER,
  buildGmailComposeUrl,
  buildManualGmailBody,
  buildManualGmailHtml,
  buildScanReportEmailHtml,
  scanReportSenderEmail,
} from "../../server/features/crm/scanReportEmail";

describe("scan report email template", () => {
  it("uses one plain report link below a non-clickable image and omits the branded banner", () => {
    const html = buildScanReportEmailHtml({
      message: "Hi Ana,\nSee your results.",
      imageUrl: "https://reports.vivawebdesigns.com/scans/report/abc.png",
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: "Acme Roofing",
      replyTo: "matt@vivawebdesigns.com",
      preheader: DEFAULT_SCAN_REPORT_PREHEADER,
    });

    expect(html).toContain(DEFAULT_SCAN_REPORT_PREHEADER);
    expect(html).toContain("display:none!important;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent");
    expect(html).toContain(`${DEFAULT_SCAN_REPORT_PREHEADER}&#847; &zwnj; &nbsp;`);
    expect(html).toContain("Hi Ana,<br />See your results.");
    expect(html).toContain('width="600"');
    expect(html).toContain('href="https://vivawebdesigns.com/scan-report/secure-token"');
    expect(html.match(/https:\/\/vivawebdesigns\.com\/scan-report\/secure-token/g)).toHaveLength(1);
    expect(html).toContain(">Learn more</a>");
    expect(html).not.toContain('<a href="https://vivawebdesigns.com/scan-report/secure-token" target="_blank" style="text-decoration:none;">');
    expect(html).not.toContain('background:#0f766e;color:#ffffff;padding:22px 28px');
    expect(html).toContain('src="https://reports.vivawebdesigns.com/scans/report/abc.png"');
    expect(html).toContain("227 W 4th St, 1st Floor #3127, Charlotte, NC 28202");
    expect(html).toContain("If you’d rather not receive another email from me, just reply “no thanks.”");
    expect(html).not.toContain("/email/unsubscribe/");
    expect(html).not.toContain("mailto:");
  });

  it("places the scan after the first two message paragraphs by default", () => {
    const imageUrl = "https://reports.vivawebdesigns.com/scans/report/abc.png";
    const html = buildScanReportEmailHtml({
      message: "I’m Matt with Viva Web Designs.\n\nI came across Inspect-A-Deck and ran a scan.\n\nI found some significant visibility gaps.",
      imageUrl,
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: "Inspect-A-Deck",
      replyTo: "matt@vivawebdesigns.com",
    });

    expect(html.indexOf("I came across Inspect-A-Deck")).toBeLessThan(html.indexOf(imageUrl));
    expect(html.indexOf(imageUrl)).toBeLessThan(html.indexOf("I found some significant visibility gaps"));
  });

  it("omits a greeting from both English outreach messages", async () => {
    const source = await import("node:fs/promises").then(fs => fs.readFile("server/features/crm/scanReportEmail.ts", "utf8"));
    expect(source).toContain(': `I’m Matt with Viva Web Designs here in Charlotte.');
    expect(source).not.toContain(': `Hi,\\n\\nI’m Matt with Viva Web Designs here in Charlotte.');
    expect(source).toContain(': `Following up on the visibility report I sent for {{business_name}}.');
    expect(source).not.toContain(': `Hi${greeting},\\n\\nFollowing up on the visibility report');
  });

  it("can place the scan after the full message when explicitly selected", () => {
    const imageUrl = "https://reports.vivawebdesigns.com/scans/report/abc.png";
    const html = buildScanReportEmailHtml({
      message: "Hi Mike,\n\nI’m Matt with Viva Web Designs.\n\nI came across Inspect-A-Deck and ran a scan.\n\nI found some significant visibility gaps.",
      imageUrl,
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: "Inspect-A-Deck",
      replyTo: "matt@vivawebdesigns.com",
      imagePlacement: "after_message",
    });

    expect(html.indexOf("I found some significant visibility gaps")).toBeLessThan(html.indexOf(imageUrl));
  });

  it("escapes editable CRM content before placing it in HTML", () => {
    const html = buildScanReportEmailHtml({
      message: '<script>alert("x")</script>',
      imageUrl: "https://vivawebdesigns.com/report.png",
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: 'Acme <Roofing> "LLC"',
      replyTo: "matt@vivawebdesigns.com",
      preheader: "Your <scan>",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Acme &lt;Roofing&gt; &quot;LLC&quot;");
    expect(html).toContain("Your &lt;scan&gt;");
  });

  it("uses a dedicated scan-report sender when configured", () => {
    const previous = process.env.SCAN_REPORT_EMAIL_FROM;
    process.env.SCAN_REPORT_EMAIL_FROM = "reports@vivawebdesigns.com";
    expect(scanReportSenderEmail()).toBe("reports@vivawebdesigns.com");
    if (previous === undefined) delete process.env.SCAN_REPORT_EMAIL_FROM;
    else process.env.SCAN_REPORT_EMAIL_FROM = previous;
  });

  it("builds the plain manual Gmail message used for prospect outreach", () => {
    const body = buildManualGmailBody(
      "I’m Matt with Viva Web Designs.\n\nI ran a scan for Acme Roofing.",
      "https://vivawebdesigns.com/scan-report/secure-token",
    );

    expect(body).toContain("I’m Matt with Viva Web Designs.");
    expect(body).toContain("Learn more: https://vivawebdesigns.com/scan-report/secure-token");
    expect(body).toContain("227 W 4th St, 1st Floor #3127, Charlotte, NC 28202");
    expect(body).toContain("reply “no thanks.”");
    expect(body).not.toContain("<!doctype html>");
    expect(body).not.toContain("background:");
  });

  it("builds a formatted Gmail message with a clean linked phrase", () => {
    const html = buildManualGmailHtml(
      "I’m Matt with Viva Web Designs.\n\nI ran a scan for Acme Roofing.",
      "https://vivawebdesigns.com/scan-report/secure-token",
    );

    expect(html).toContain('<a href="https://vivawebdesigns.com/scan-report/secure-token">Learn more</a>');
    expect(html).not.toContain("Learn more: https://");
    expect(html).not.toContain("<!doctype html>");
  });

  it("opens the prepared message in the real Workspace account", () => {
    const url = new URL(buildGmailComposeUrl({
      recipient: "prospect@example.com",
      subject: "Google Maps issues",
      body: "Plain Gmail message",
    }));

    expect(url.origin).toBe("https://mail.google.com");
    expect(url.searchParams.get("authuser")).toBe("matt@vivawebdesigns.com");
    expect(url.searchParams.get("to")).toBe("prospect@example.com");
    expect(url.searchParams.get("su")).toBe("Google Maps issues");
    expect(url.searchParams.get("body")).toBe("Plain Gmail message");
  });
});
