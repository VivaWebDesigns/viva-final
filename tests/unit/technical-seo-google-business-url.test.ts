import { describe, expect, it } from "vitest";
import { extractGoogleBusinessIdentifier } from "../../server/features/technical-seo/dataforseo-audit";

describe("technical SEO Google Business Profile URL identifiers", () => {
  it("extracts a decimal CID from a maps URL", () => {
    expect(extractGoogleBusinessIdentifier("https://www.google.com/maps?cid=194604053573767737")).toBe("cid:194604053573767737");
  });

  it("extracts a Place ID from a maps URL", () => {
    expect(extractGoogleBusinessIdentifier("https://www.google.com/maps/search/?api=1&query=Acme&query_place_id=ChIJQWDl0CIeQUARxks3icF8U8A")).toBe("place_id:ChIJQWDl0CIeQUARxks3icF8U8A");
  });

  it("converts a maps feature hex CID to decimal", () => {
    expect(extractGoogleBusinessIdentifier("https://www.google.com/maps/place/Acme/data=!4m2!3m1!1s0x123:0x1a")).toBe("cid:26");
  });

  it("rejects identifiers on non-Google hosts", () => {
    expect(extractGoogleBusinessIdentifier("https://example.com/maps?cid=194604053573767737")).toBeNull();
  });

  it("accepts a CID after a g.page redirect", () => {
    expect(extractGoogleBusinessIdentifier("https://g.page/maps?cid=194604053573767737")).toBe("cid:194604053573767737");
  });
});
