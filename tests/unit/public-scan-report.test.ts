import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import {
  buildScanReportLandingPage,
  createScanReportToken,
  hashScanReportToken,
  isLikelyAutomatedUserAgent,
  scanReportLandingUrl,
} from "../../server/public-scan-report";

describe("public scan report tracking", () => {
  it("creates opaque delivery tokens and stores only a one-way hash", () => {
    const token = createScanReportToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashScanReportToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashScanReportToken(token)).not.toContain(token);
  });

  it("attributes the initial report visit to the CRM email campaign", () => {
    const token = "a".repeat(43);
    const url = new URL(scanReportLandingUrl(token));

    expect(url.origin).toBe("https://vivawebdesigns.com");
    expect(url.pathname).toBe(`/scan-report/${token}`);
    expect(url.searchParams.get("utm_source")).toBe("crm");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("scan_report");
  });

  it("renders a noindex report page with sanitized GA location and tracked CTAs", () => {
    const token = "b".repeat(43);
    const html = buildScanReportLandingPage({
      token,
      imageUrl: "https://reports.vivawebdesigns.com/scans/report/image.png",
      businessName: "Acme <Roofing>",
    });

    expect(html).toContain('<meta name="robots" content="noindex,nofollow,noarchive">');
    expect(html).toContain('history.replaceState(null,"","/scan-report/view"+location.search)');
    expect(html).toContain("G-8NL7JMJ7MT");
    expect(html).toContain('"scan_report_view"');
    expect(html).toContain('"scan_report_cta_click"');
    expect(html).toContain('data-cta="schedule_call"');
    expect(html).toContain('data-cta="email_matt"');
    expect(html).toContain('data-cta="view_results"');
    expect(html).toContain("Acme &lt;Roofing&gt;");
    expect(html).not.toContain("lead_id");
    expect(html).not.toContain("recipient");
  });

  it("flags common email-security and crawler user agents", () => {
    expect(isLikelyAutomatedUserAgent("Proofpoint URL Defense")).toBe(true);
    expect(isLikelyAutomatedUserAgent("Mozilla/5.0 Googlebot/2.1")).toBe(true);
    expect(isLikelyAutomatedUserAgent("Mozilla/5.0 Safari/605.1.15")).toBe(false);
  });
});
