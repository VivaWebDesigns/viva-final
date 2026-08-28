import { describe, expect, it } from "vitest";
import {
  LANDING_PAGE_DIMENSION_FILTER,
  LANDING_PAGE_METRIC_FILTER,
} from "../../server/features/business-analytics/googleApi";

describe("Google Analytics landing-page filters", () => {
  it("excludes GTM preview and unattributed landing-page values", () => {
    const serialized = JSON.stringify(LANDING_PAGE_DIMENSION_FILTER);

    expect(serialized).toContain("landingPagePlusQueryString");
    expect(serialized).toContain("gtm_debug");
    expect(serialized).toContain("(not set");
    expect(serialized).toContain("notExpression");
  });

  it("requires an actual page view", () => {
    expect(LANDING_PAGE_METRIC_FILTER).toEqual({
      filter: {
        fieldName: "screenPageViews",
        numericFilter: {
          operation: "GREATER_THAN",
          value: { int64Value: "0" },
        },
      },
    });
  });
});
