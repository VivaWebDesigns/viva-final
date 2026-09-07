import { describe, expect, it } from "vitest";
import {
  approximateLocation,
  cleanPublicPath,
  deviceCategory,
  isAutomatedUserAgent,
  sourceLabel,
  websiteActivityBatchSchema,
  websiteSessionQuality,
} from "../../server/features/business-analytics/websiteActivity";

describe("anonymous website activity", () => {
  it("keeps only a clean public path and coarse request-header location", () => {
    expect(cleanPublicPath("/results?email=private@example.com#case-study")).toBe("/results");
    expect(approximateLocation({
      "cf-ipcity": "Charlotte",
      "cf-region": "North%20Carolina",
      "cf-ipcountry": "US",
      "x-forwarded-for": "203.0.113.10",
    })).toEqual({ city: "Charlotte", region: "North Carolina", country: "US" });
  });

  it("describes return paths without identifying a visitor", () => {
    expect(sourceLabel(null)).toBe("Direct");
    expect(sourceLabel("www.vivawebdesigns.com")).toBe("Direct");
    expect(sourceLabel("www.google.com")).toBe("Google search");
    expect(sourceLabel("example.com")).toBe("example.com");
  });

  it("classifies device and recognizable automation without storing a user agent", () => {
    expect(deviceCategory("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile")).toBe("mobile");
    expect(deviceCategory("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("desktop");
    expect(isAutomatedUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isAutomatedUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });

  it("separates meaningful, brief, automated, and internal sessions", () => {
    expect(websiteSessionQuality({ pageViewCount: 1, activeSeconds: 9, actionCount: 0, isAutomated: false, isInternal: false })).toBe("brief");
    expect(websiteSessionQuality({ pageViewCount: 1, activeSeconds: 10, actionCount: 0, isAutomated: false, isInternal: false })).toBe("meaningful");
    expect(websiteSessionQuality({ pageViewCount: 2, activeSeconds: 0, actionCount: 0, isAutomated: false, isInternal: false })).toBe("meaningful");
    expect(websiteSessionQuality({ pageViewCount: 1, activeSeconds: 0, actionCount: 1, isAutomated: false, isInternal: false })).toBe("meaningful");
    expect(websiteSessionQuality({ pageViewCount: 4, activeSeconds: 60, actionCount: 2, isAutomated: true, isInternal: false })).toBe("automated");
    expect(websiteSessionQuality({ pageViewCount: 4, activeSeconds: 60, actionCount: 2, isAutomated: false, isInternal: true })).toBe("internal");
  });

  it("accepts only bounded anonymous batches", () => {
    const parsed = websiteActivityBatchSchema.parse({
      sessionId: "7fd37cad-bd96-4caa-9554-e0a503f1a6cc",
      referrerHost: null,
      events: [{
        id: "ca4f8ea1-073d-4f7e-8c87-2965516e5264",
        type: "page_view",
        path: "/",
        occurredAt: "2026-09-07T19:00:00.000Z",
      }],
    });
    expect(parsed.events).toHaveLength(1);
    expect(() => websiteActivityBatchSchema.parse({ ...parsed, identity: "lead@example.com" })).toThrow();
  });
});
