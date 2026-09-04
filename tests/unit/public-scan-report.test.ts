import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import {
  buildScanReportLandingPage,
  createAnonymousScanReportToken,
  createScanReportToken,
  hashScanReportToken,
  isLikelyAutomatedUserAgent,
  scanReportLandingUrl,
} from "../../server/public-scan-report";

describe("public scan report access", () => {
  it("creates opaque delivery tokens and stores only a one-way hash", () => {
    const token = createScanReportToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashScanReportToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashScanReportToken(token)).not.toContain(token);
  });

  it("creates a stable report-level token without a delivery or recipient identifier", () => {
    const previous = process.env.SCAN_REPORT_SHARE_SECRET;
    process.env.SCAN_REPORT_SHARE_SECRET = "unit-test-report-sharing-secret";

    const first = createAnonymousScanReportToken("report-one");
    const repeated = createAnonymousScanReportToken("report-one");
    const other = createAnonymousScanReportToken("report-two");

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repeated).toBe(first);
    expect(other).not.toBe(first);

    if (previous === undefined) delete process.env.SCAN_REPORT_SHARE_SECRET;
    else process.env.SCAN_REPORT_SHARE_SECRET = previous;
  });

  it("uses a clean report URL without email-campaign parameters", () => {
    const token = "a".repeat(43);
    const url = new URL(scanReportLandingUrl(token));

    expect(url.origin).toBe("https://vivawebdesigns.com");
    expect(url.pathname).toBe(`/scan-report/${token}`);
    expect(url.search).toBe("");
  });

  it("renders a noindex report page with first-party engaged-view and click tracking", () => {
    const html = buildScanReportLandingPage({
      token: "a".repeat(43),
      imageUrl: "https://reports.vivawebdesigns.com/scans/report/image.png",
      businessName: "Acme <Roofing>",
    });

    expect(html).toContain('<meta name="robots" content="noindex,nofollow,noarchive">');
    expect(html).toContain('history.replaceState(null,"","/scan-report/view")');
    expect(html).not.toContain("G-8NL7JMJ7MT");
    expect(html).not.toContain("googletagmanager.com");
    expect(html).not.toContain("gtag(");
    expect(html).toContain('data-cta="schedule_call"');
    expect(html).toContain('data-cta="email_matt"');
    expect(html).toContain('data-cta="view_results"');
    expect(html).toContain('data-cta="another_scan"');
    expect(html).toContain('href="https://vivawebdesigns.com/contact#contact-form"');
    expect(html).toContain("Send Matt a Message");
    expect(html).not.toContain("mailto:matt@vivawebdesigns.com");
    expect(html).toContain('href="https://vivawebdesigns.com/scan#scan-request"');
    expect(html).toContain("Want to Check Another Service for Free?");
    expect(html).toContain("No cost, no obligation, and no sales call required.");
    expect(html).toContain("Check Another Service");
    expect(html).toContain("Acme &lt;Roofing&gt;");
    expect(html).not.toContain("Engaged views and action selections may be recorded in our CRM");
    expect(html).not.toContain("This page does not load Google Analytics");
    expect(html).toContain('Charlotte, North Carolina &middot; <a href="/privacy-policy">Privacy Policy</a>');
    expect(html).not.toContain("utm_");
    expect(html).toContain(`/scan-report/${"a".repeat(43)}/events/view`);
    expect(html).toContain(`/scan-report/${"a".repeat(43)}/events/cta`);
    expect(html).toContain("setTimeout(recordEngagedView,4000)");
    expect(html).toContain("event.isTrusted");
    expect(html).not.toContain("/go/");
    expect(html).not.toContain("deliveryId");
    expect(html).not.toContain("lead_id");
    expect(html).not.toContain("recipient");
  });

  it("recognizes common automated link-scanner user agents", () => {
    expect(isLikelyAutomatedUserAgent("Proofpoint URL Defense Scanner")).toBe(true);
    expect(isLikelyAutomatedUserAgent("Mozilla/5.0 Chrome/140 Safari/537.36")).toBe(false);
  });
});
