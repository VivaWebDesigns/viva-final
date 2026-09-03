import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("client/src/features/business-analytics/AnalyticsPage.tsx", "utf8");
const router = readFileSync("client/src/AdminRouter.tsx", "utf8");
const serverRoutes = readFileSync("server/features/business-analytics/routes.ts", "utf8");
const googleAuth = readFileSync("server/features/business-analytics/googleAuth.ts", "utf8");

describe("business analytics admin contract", () => {
  it("provides a dedicated protected Analytics page", () => {
    expect(router).toContain('path="/admin/analytics"');
    expect(router).toContain("<AnalyticsPage />");
    expect(page).toContain("Confirmed leads");
    expect(page).not.toContain("Scan report CTA activity");
    expect(page).not.toContain("Report views");
    expect(page).toContain("Top landing pages");
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
