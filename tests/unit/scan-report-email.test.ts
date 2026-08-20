import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import { buildScanReportEmailHtml, scanReportSenderEmail } from "../../server/features/crm/scanReportEmail";

describe("scan report email template", () => {
  it("renders the hosted report, fallback link, postal address, and opt-out", () => {
    const html = buildScanReportEmailHtml({
      message: "Hi Ana,\nSee your results.",
      imageUrl: "https://vivawebdesigns.com/api/local-visibility/public/email-assets/report/abc.png",
      businessName: "Acme Roofing",
      replyTo: "matt@vivawebdesigns.com",
    });

    expect(html).toContain("Hi Ana,<br />See your results.");
    expect(html).toContain('width="600"');
    expect(html).toContain("View the full report");
    expect(html).toContain("1628 Redcoat Dr, Charlotte, NC 28211");
    expect(html).toContain("Unsubscribe");
  });

  it("escapes editable CRM content before placing it in HTML", () => {
    const html = buildScanReportEmailHtml({
      message: '<script>alert("x")</script>',
      imageUrl: "https://vivawebdesigns.com/report.png",
      businessName: 'Acme <Roofing> "LLC"',
      replyTo: "matt@vivawebdesigns.com",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Acme &lt;Roofing&gt; &quot;LLC&quot;");
  });

  it("uses a dedicated scan-report sender when configured", () => {
    const previous = process.env.SCAN_REPORT_EMAIL_FROM;
    process.env.SCAN_REPORT_EMAIL_FROM = "reports@vivawebdesigns.com";
    expect(scanReportSenderEmail()).toBe("reports@vivawebdesigns.com");
    if (previous === undefined) delete process.env.SCAN_REPORT_EMAIL_FROM;
    else process.env.SCAN_REPORT_EMAIL_FROM = previous;
  });
});
