import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("client/src/features/business-analytics/AnalyticsPage.tsx", "utf8");
const outreachPage = readFileSync("client/src/features/business-analytics/EmailOutreachAnalyticsPage.tsx", "utf8");
const router = readFileSync("client/src/AdminRouter.tsx", "utf8");
const serverRoutes = readFileSync("server/features/business-analytics/routes.ts", "utf8");
const storage = readFileSync("server/features/business-analytics/storage.ts", "utf8");
const googleAuth = readFileSync("server/features/business-analytics/googleAuth.ts", "utf8");

describe("business analytics admin contract", () => {
  it("provides a dedicated protected Analytics page", () => {
    expect(router).toContain('path="/admin/analytics"');
    expect(router).toContain("<AnalyticsPage />");
    expect(page).toContain("Confirmed leads");
    expect(page).not.toContain("Scan report CTA activity");
    expect(page).not.toContain("Report views");
    expect(page).toContain("Traffic Flow");
    expect(page).toContain('value === 1 ? "1 day"');
    expect(page).toContain('setRangeMode("custom")');
    expect(page).toContain('activeTab === "engagement"');
    expect(page).toContain('activeTab === "devices"');
    expect(page).toContain('activeTab === "geography"');
    expect(page).toContain('activeTab === "flow"');
    expect(page).toContain("Channel → landing page → engagement → confirmed lead");
  });

  it("provides template-level report outreach analytics without requiring GA4", () => {
    expect(router).toContain('path="/admin/analytics/email-outreach"');
    expect(router).toContain("<EmailOutreachAnalyticsPage />");
    expect(page).toContain('href="/admin/analytics/email-outreach"');
    expect(page).toContain("View Email Outreach");
    expect(outreachPage).toContain("Template comparison");
    expect(outreachPage).toContain("Every edited send stays with the template letter you selected.");
    expect(outreachPage).toContain("Appointments");
    expect(serverRoutes).toContain('router.get("/report-outreach"');
    expect(storage).toContain("getReportOutreachAnalytics");
    expect(storage).toContain("reportOutreachDisposition");
    expect(storage).toContain("isNotNull(scanReportDeliveries.templateKey)");
  });

  it("keeps Google credentials server-side", () => {
    expect(page).not.toContain("client_secret");
    expect(page).not.toContain("refresh_token");
    expect(serverRoutes).toContain('requireRole("admin")');
    expect(serverRoutes).toContain("encryptGoogleToken");
  });

  it("keeps Business Profile capability disabled by default behind a feature flag", () => {
    expect(page).toContain("Google Business Profile reviews");
    expect(page).toContain("businessProfileEnabled &&");
    expect(serverRoutes).toContain("googleBusinessProfileEnabled");
    expect(googleAuth).toContain('process.env.GOOGLE_BUSINESS_PROFILE_ENABLED === "true"');
    expect(serverRoutes).toContain('/business/location');
    expect(serverRoutes).toContain('/business/sync');
    expect(serverRoutes).toContain('/business/reviews');
  });
});
