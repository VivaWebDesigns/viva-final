import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("client/src/features/business-analytics/AnalyticsPage.tsx", "utf8");
const router = readFileSync("client/src/AdminRouter.tsx", "utf8");
const serverRoutes = readFileSync("server/features/business-analytics/routes.ts", "utf8");

describe("business analytics admin contract", () => {
  it("provides a dedicated protected Analytics page", () => {
    expect(router).toContain('path="/admin/analytics"');
    expect(router).toContain("<AnalyticsPage />");
    expect(page).toContain("Confirmed leads");
    expect(page).toContain("Scan report CTA activity");
    expect(page).toContain("Top landing pages");
  });

  it("keeps Google credentials server-side", () => {
    expect(page).not.toContain("client_secret");
    expect(page).not.toContain("refresh_token");
    expect(serverRoutes).toContain('requireRole("admin")');
    expect(serverRoutes).toContain("encryptGoogleToken");
  });

  it("supports location selection and cached review synchronization", () => {
    expect(page).toContain("Google Business Profile reviews");
    expect(serverRoutes).toContain('/business/location');
    expect(serverRoutes).toContain('/business/sync');
    expect(serverRoutes).toContain('/business/reviews');
  });
});

