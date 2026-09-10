import { describe, expect, it } from "vitest";
import { isRetryablePageSpeedStatus } from "../../server/features/technical-seo/pagespeed";

describe("technical SEO PageSpeed retries", () => {
  it("retries quota and transient server responses", () => {
    for (const status of [429, 500, 502, 503, 504]) expect(isRetryablePageSpeedStatus(status)).toBe(true);
  });

  it("does not retry permanent client responses", () => {
    for (const status of [400, 401, 403, 404]) expect(isRetryablePageSpeedStatus(status)).toBe(false);
  });
});
