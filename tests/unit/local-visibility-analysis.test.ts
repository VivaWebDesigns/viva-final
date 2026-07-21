import { describe, expect, it } from "vitest";
import {
  parseVisibilityScanText,
  visibilityScreenshotAnalysisSchema,
} from "../../server/features/local-visibility/analysis";

describe("local visibility screenshot analysis", () => {
  it("validates the extraction contract", () => {
    const result = visibilityScreenshotAnalysisSchema.parse({
      reportImageIndex: 0,
      heatmapImageIndex: 1,
      fields: {
        businessName: "The Shower Glass",
        address: "Charlotte, NC",
        rating: "5.0",
        reviewCount: "40",
        searchPhrase: "frameless shower glass near me",
        market: "Charlotte, NC",
        averagePosition: "3.96",
        gridSize: "7 × 7",
        radius: "8.0",
      },
      lowConfidenceFields: ["market"],
    });

    expect(result.fields.averagePosition).toBe("3.96");
    expect(result.lowConfidenceFields).toEqual(["market"]);
  });

  it("parses the visible Local Falcon summary fields and uses ARP", () => {
    const result = parseVisibilityScanText(`
      Scan Report
      Searching "frameless shower glass near me" on Google Maps for:
      The Shower Glass
      8334 Pineville-Matthews Rd Ste 103/185, Charlotte, NC 28226
      5.0 ★★★★★ (40)
      ARP 3.96   ATRP 7.25   SoLV 48.98
      Searched using a 7 x 7 grid with a 8.0mi radius covering 256.00mi2
    `);

    expect(result.fields).toMatchObject({
      businessName: "The Shower Glass",
      rating: "5.0",
      reviewCount: "40",
      market: "Charlotte, NC",
      averagePosition: "3.96",
      gridSize: "7 × 7",
      radius: "8.0",
    });
  });
});
