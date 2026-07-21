import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  cropHeatmapAroundGrid,
  detectHeatmapCrop,
} from "../../server/features/local-visibility/heatmap";

const fixturePath = path.resolve(
  process.cwd(),
  "tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png",
);

describe("local visibility heatmap cropping", () => {
  it("finds the complete 7 × 7 grid and removes excess map area", async () => {
    const source = await readFile(fixturePath);
    const sourceMetadata = await sharp(source).metadata();
    const crop = await detectHeatmapCrop(source);

    expect(crop).not.toBeNull();
    expect(crop?.detectedMarkerCount).toBe(49);
    expect(crop?.left).toBeGreaterThan(40);
    expect(crop?.top).toBeGreaterThan(30);
    expect(crop?.width).toBeLessThan(sourceMetadata.width! * 0.9);
    expect(crop?.height).toBeLessThan(sourceMetadata.height! * 0.9);
  });

  it("returns a report-shaped crop with all markers retained", async () => {
    const source = await readFile(fixturePath);
    const result = await cropHeatmapAroundGrid(source);

    expect(result).not.toBeNull();
    expect(result?.crop.detectedMarkerCount).toBe(49);

    const outputMetadata = await sharp(result!.buffer).metadata();
    expect(outputMetadata.format).toBe("png");
    expect(outputMetadata.width! / outputMetadata.height!).toBeCloseTo(1000 / 960, 2);
  });
});
