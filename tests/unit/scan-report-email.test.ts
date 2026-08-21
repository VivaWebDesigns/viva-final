import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import { buildScanReportEmailHtml, scanReportSenderEmail } from "../../server/features/crm/scanReportEmail";

describe("scan report email template", () => {
  it("renders the hosted report, fallback link, postal address, and opt-out", () => {
    const html = buildScanReportEmailHtml({
      message: "Hi Ana,\nSee your results.",
      imageUrl: "https://reports.vivawebdesigns.com/scans/report/abc.png",
      businessName: "Acme Roofing",
      replyTo: "matt@vivawebdesigns.com",
      preheader: "Your Google Maps scan",
    });

    expect(html).toContain("Your Google Maps scan");
    expect(html).toContain("Hi Ana,<br />See your results.");
    expect(html).toContain('width="600"');
    expect(html).toContain("View the full report");
    expect(html).toContain("1628 Redcoat Dr, Charlotte, NC 28211");
    expect(html).toContain("Unsubscribe");
  });

  it("can place the scan after the first three message paragraphs", () => {
    const imageUrl = "https://reports.vivawebdesigns.com/scans/report/abc.png";
    const html = buildScanReportEmailHtml({
      message: "Hi Mike,\n\nI’m Matt with Viva Web Designs.\n\nI came across Inspect-A-Deck and ran a scan.\n\nI found some significant visibility gaps.",
      imageUrl,
      businessName: "Inspect-A-Deck",
      replyTo: "matt@vivawebdesigns.com",
      imagePlacement: "after_intro",
    });

    expect(html.indexOf("I came across Inspect-A-Deck")).toBeLessThan(html.indexOf(imageUrl));
    expect(html.indexOf(imageUrl)).toBeLessThan(html.indexOf("I found some significant visibility gaps"));
  });

  it("escapes editable CRM content before placing it in HTML", () => {
    const html = buildScanReportEmailHtml({
      message: '<script>alert("x")</script>',
      imageUrl: "https://vivawebdesigns.com/report.png",
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
});
