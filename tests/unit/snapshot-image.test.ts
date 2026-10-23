import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { isSnapshotUpload, publishableSnapshot, snapshotFileName, toSnapshotJpeg } from "../../server/features/local-visibility/snapshotImage";

async function png(width = 108, height = 192) {
  return sharp({ create: { width, height, channels: 4, background: { r: 20, g: 120, b: 200, alpha: 0.5 } } }).png().toBuffer();
}

describe("snapshot images", () => {
  it("converts PNG uploads to JPEG at the same size, flattened onto white", async () => {
    const jpeg = await toSnapshotJpeg(await png());
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([108, 192]);
    expect(meta.hasAlpha).toBe(false);
  });

  it("publishes stored JPEGs as-is and converts older PNGs", async () => {
    const jpeg = await toSnapshotJpeg(await png());
    expect(await publishableSnapshot({ buffer: jpeg, mimeType: "image/jpeg" })).toBe(jpeg);
    const fromPng = await publishableSnapshot({ buffer: await png(), mimeType: "image/png" });
    expect((await sharp(fromPng).metadata()).format).toBe("jpeg");
  });

  it("accepts PNG or JPEG uploads and names files .jpg", () => {
    expect(isSnapshotUpload("image/png")).toBe(true);
    expect(isSnapshotUpload("image/jpeg")).toBe(true);
    expect(isSnapshotUpload("image/webp")).toBe(false);
    expect(snapshotFileName("abc")).toBe("abc-local-visibility-snapshot.jpg");
  });
});
