import sharp from "sharp";

// Scans are stored and published as JPEG: about 220 KB instead of 1.7 MB as PNG.
// Twilio held 1.7 MB PNG picture texts for 5–9 minutes; the JPEG went out in 5 seconds.
export const SNAPSHOT_MIME_TYPE = "image/jpeg";
const SNAPSHOT_JPEG_QUALITY = 82;

/** Browsers render the snapshot as PNG; either PNG or JPEG uploads are accepted and stored as JPEG. */
export function isSnapshotUpload(mimeType: string | undefined) {
  return mimeType === "image/png" || mimeType === "image/jpeg";
}

export function snapshotFileName(id: string) {
  return `${id}-local-visibility-snapshot.jpg`;
}

export async function toSnapshotJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: SNAPSHOT_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

/** Older scans may still be PNG; anything published leaves as JPEG. */
export async function publishableSnapshot(file: { buffer: Buffer; mimeType: string }) {
  return file.mimeType === SNAPSHOT_MIME_TYPE ? file.buffer : toSnapshotJpeg(file.buffer);
}
