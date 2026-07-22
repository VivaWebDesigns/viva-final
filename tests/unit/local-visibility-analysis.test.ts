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
      heatmapImageDataUrl: null,
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

  it("extracts reviews independently and never substitutes SoLV for ARP", () => {
    const result = parseVisibilityScanText(
      `
        Scan Report
        Searching "control access near me" on Google Maps for:
        Carolina Custom Automation
        2012 SC-160 STE. 106, Fort Mill, SC 29708
        5.0 ★★★★★ (19)
        Searched using a 7 x 7 grid with a 2.5mi radius covering 25.00mi2
      `,
      "ATRP 1.71 SoLV 89.80",
      "ARP 1.71",
    );

    expect(result.fields).toMatchObject({
      businessName: "Carolina Custom Automation",
      rating: "5.0",
      reviewCount: "19",
      averagePosition: "1.71",
      gridSize: "7 × 7",
      radius: "2.5",
    });
  });

  it("preserves both ARP decimal digits when OCR spaces them apart", () => {
    const result = parseVisibilityScanText(
      "Scan Report\nCarolina Custom Automation",
      "ARP 3.0 8   ATRP 5.12   SoLV 64.20",
    );

    expect(result.fields.averagePosition).toBe("3.08");
  });

  it("leaves average position blank when only SoLV is visible", () => {
    const result = parseVisibilityScanText(
      "Scan Report\nCarolina Custom Automation\nSoLV 89.80",
      "SoLV 89.80",
    );

    expect(result.fields.averagePosition).toBeNull();
  });

  it("rejects a partial integer from the dedicated ARP crop", () => {
    const result = parseVisibilityScanText(
      "Scan Report\nCarolina Custom Automation\nSoLV 89.80",
      "ATRP 1.71 SoLV 89.80",
      "7",
    );

    expect(result.fields.averagePosition).toBeNull();
  });
});
