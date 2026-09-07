import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("client/src/features/business-analytics/AnalyticsPage.tsx", "utf8");
const outreachPage = readFileSync("client/src/features/business-analytics/EmailOutreachAnalyticsPage.tsx", "utf8");
const router = readFileSync("client/src/AdminRouter.tsx", "utf8");
const serverRoutes = readFileSync("server/features/business-analytics/routes.ts", "utf8");
const storage = readFileSync("server/features/business-analytics/storage.ts", "utf8");
const googleApi = readFileSync("server/features/business-analytics/googleApi.ts", "utf8");
const googleAuth = readFileSync("server/features/business-analytics/googleAuth.ts", "utf8");
const publicSiteScript = readFileSync("client/public/js/site.js", "utf8");
const websiteActivity = readFileSync("server/features/business-analytics/websiteActivity.ts", "utf8");
const schema = readFileSync("shared/schema.ts", "utf8");
const serverIndex = readFileSync("server/index.ts", "utf8");

describe("business analytics admin contract", () => {
  it("provides a dedicated protected Analytics page", () => {
    expect(router).toContain('path="/admin/analytics"');
    expect(router).toContain("<AnalyticsPage />");
    expect(page).toContain("Confirmed leads");
    expect(page).not.toContain("Scan report CTA activity");
    expect(page).not.toContain("Report views");
    expect(page).toContain("Website Monitor");
    expect(page).toContain("Since Sep 4");
    expect(page).toContain('const MONITORING_START_DATE = "2026-09-04"');
    expect(page).toContain("Credible traffic is treated as outreach-influenced");
    expect(page).toContain("One timeline for outreach and website activity");
    expect(page).toContain("What happened");
    expect(page).toContain("Email sends and anonymous website journeys in chronological order");
    expect(page).toContain("Anonymous session · approximately");
    expect(page).toContain("Historical context from Google Analytics");
    expect(page).toContain("individual journeys cannot be reconstructed");
    expect(page).toContain('value === 1 ? "1 day"');
    expect(page).toContain('setRangeMode("custom")');
    expect(page).toContain('activeTab === "engagement"');
    expect(page).toContain("Average session duration");
    expect(page).toContain("Today’s engagement data may still be processing in Google Analytics.");
    expect(page).toContain('activeTab === "devices"');
    expect(page).toContain('activeTab === "geography"');
    expect(page).toContain('activeTab === "flow"');
    expect(page).toContain("Return path → first website page → engagement → confirmed lead");
    expect(googleApi).toContain('dimensions: ["pagePathPlusQueryString"]');
    expect(googleApi).toContain('dimensions: ["eventName"]');
    expect(googleApi).toContain('"userEngagementDuration"');
    expect(serverRoutes).toContain("getReportSendTrend");
    expect(storage).toContain("at time zone ${timeZone}");
    expect(publicSiteScript).toContain('recordWebsiteAction("phone_click"');
    expect(publicSiteScript).toContain('recordWebsiteAction("schedule_click"');
    expect(publicSiteScript).toContain('recordWebsiteAction("scan_interest"');
    expect(publicSiteScript).toContain('recordWebsiteAction("results_interest"');
    expect(publicSiteScript).toContain('queueActivity("page_view")');
    expect(publicSiteScript).toContain('queueActivity("form_submit"');
    expect(publicSiteScript).toContain('queueActivity("deep_scroll"');
    expect(publicSiteScript).toContain("window.sessionStorage");
    expect(publicSiteScript).not.toContain("document.cookie");
    expect(serverRoutes).toContain('router.post("/website-activity/collect"');
    expect(serverRoutes).toContain('router.get("/website-activity"');
    expect(websiteActivity).toContain("WEBSITE_ACTIVITY_RETENTION_DAYS = 90");
    expect(websiteActivity).not.toContain("ipAddress:");
    expect(schema).toContain('pgTable("website_activity_sessions"');
    expect(schema).toContain('pgTable("website_activity_events"');
    expect(serverIndex).toContain('path === "/api/business-analytics/website-activity/collect"');
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
