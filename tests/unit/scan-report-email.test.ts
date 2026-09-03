import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import {
  DEFAULT_SCAN_REPORT_PREHEADER,
  buildScanReportEmailHtml,
  scanReportSenderEmail,
} from "../../server/features/crm/scanReportEmail";

describe("scan report email template", () => {
  it("uses the report image as the only HTML report link and omits the bottom button", () => {
    const html = buildScanReportEmailHtml({
      message: "Hi Ana,\nSee your results.",
      imageUrl: "https://reports.vivawebdesigns.com/scans/report/abc.png",
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: "Acme Roofing",
      replyTo: "matt@vivawebdesigns.com",
      unsubscribeUrl: "https://vivawebdesigns.com/email/unsubscribe/secure-token",
      preheader: DEFAULT_SCAN_REPORT_PREHEADER,
    });

    expect(html).toContain(DEFAULT_SCAN_REPORT_PREHEADER);
    expect(html).toContain("display:none!important;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent");
    expect(html).toContain(`${DEFAULT_SCAN_REPORT_PREHEADER}&#847; &zwnj; &nbsp;`);
    expect(html).toContain("Hi Ana,<br />See your results.");
    expect(html).toContain('width="600"');
    expect(html).toContain('href="https://vivawebdesigns.com/scan-report/secure-token"');
    expect(html.match(/https:\/\/vivawebdesigns\.com\/scan-report\/secure-token/g)).toHaveLength(1);
    expect(html).not.toContain("View the full report");
    expect(html).toContain('src="https://reports.vivawebdesigns.com/scans/report/abc.png"');
    expect(html).toContain("227 W 4th St<br />1st Floor #3127<br />Charlotte, NC 28202");
    expect(html).toContain("Unsubscribe");
    expect(html).toContain('href="https://vivawebdesigns.com/email/unsubscribe/secure-token"');
    expect(html).not.toContain("mailto:");
  });

  it("places the scan after the first three message paragraphs by default", () => {
    const imageUrl = "https://reports.vivawebdesigns.com/scans/report/abc.png";
    const html = buildScanReportEmailHtml({
      message: "Hi Mike,\n\nI’m Matt with Viva Web Designs.\n\nI came across Inspect-A-Deck and ran a scan.\n\nI found some significant visibility gaps.",
      imageUrl,
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: "Inspect-A-Deck",
      replyTo: "matt@vivawebdesigns.com",
      unsubscribeUrl: "https://vivawebdesigns.com/email/unsubscribe/secure-token",
    });

    expect(html.indexOf("I came across Inspect-A-Deck")).toBeLessThan(html.indexOf(imageUrl));
    expect(html.indexOf(imageUrl)).toBeLessThan(html.indexOf("I found some significant visibility gaps"));
  });

  it("can place the scan after the full message when explicitly selected", () => {
    const imageUrl = "https://reports.vivawebdesigns.com/scans/report/abc.png";
    const html = buildScanReportEmailHtml({
      message: "Hi Mike,\n\nI’m Matt with Viva Web Designs.\n\nI came across Inspect-A-Deck and ran a scan.\n\nI found some significant visibility gaps.",
      imageUrl,
      landingUrl: "https://vivawebdesigns.com/scan-report/secure-token",
      businessName: "Inspect-A-Deck",
      replyTo: "matt@vivawebdesigns.com",
      unsubscribeUrl: "https://vivawebdesigns.com/email/unsubscribe/secure-token",
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
      unsubscribeUrl: "https://vivawebdesigns.com/email/unsubscribe/secure-token",
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
});
