import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { unzipSync } from "fflate";
import { parseLocalFalconPayload, type LocalFalconPayload } from "./localFalconImport";

export const LOCAL_FALCON_PACKAGE_MAX_BYTES = 50 * 1024 * 1024;
export const LOCAL_FALCON_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;

export interface IncomingPackageFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface ValidatedHeatmap {
  buffer: Buffer;
  manifestPath: string;
  originalName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  sha256: string;
  previewDataUrl: string;
}

export interface ParsedLocalFalconPackage {
  payload: LocalFalconPayload;
  heatmapsByPath: Map<string, ValidatedHeatmap>;
  heatmapsByPlaceId: Map<string, ValidatedHeatmap>;
}

function normalizeEntryPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function isIgnoredEntry(value: string): boolean {
  const normalized = normalizeEntryPath(value);
  return normalized.startsWith("__MACOSX/") || normalized.split("/").some((part) => part === ".DS_Store" || part.startsWith("._"));
}

function detectImageMime(buffer: Buffer): ValidatedHeatmap["mimeType"] | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

async function validateHeatmap(buffer: Buffer, manifestPath: string): Promise<ValidatedHeatmap> {
  if (buffer.byteLength === 0) throw new Error(`${manifestPath} is empty`);
  if (buffer.byteLength > LOCAL_FALCON_IMAGE_MAX_BYTES) throw new Error(`${manifestPath} exceeds the 10 MB image limit`);
  const mimeType = detectImageMime(buffer);
  if (!mimeType) throw new Error(`${manifestPath} is not a valid PNG, JPG, or WebP image`);

  try {
    await sharp(buffer).metadata();
  } catch {
    throw new Error(`${manifestPath} could not be decoded as an image`);
  }

  const preview = await sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  return {
    buffer,
    manifestPath,
    originalName: path.posix.basename(manifestPath),
    mimeType,
    sizeBytes: buffer.byteLength,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    previewDataUrl: `data:image/webp;base64,${preview.toString("base64")}`,
  };
}

function readZip(primary: IncomingPackageFile): { manifestText: string; images: Map<string, Buffer> } {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(primary.buffer));
  } catch {
    throw new Error("The ZIP package could not be opened");
  }

  let uncompressedBytes = 0;
  const images = new Map<string, Buffer>();
  let manifestText: string | null = null;
  for (const [rawName, bytes] of Object.entries(entries)) {
    const name = normalizeEntryPath(rawName);
    if (!name || name.endsWith("/") || isIgnoredEntry(name)) continue;
    uncompressedBytes += bytes.byteLength;
    if (uncompressedBytes > MAX_UNCOMPRESSED_BYTES) throw new Error("The ZIP expands beyond the 100 MB safety limit");
    if (name === "batch.json") {
      manifestText = Buffer.from(bytes).toString("utf8");
      continue;
    }
    if (name.startsWith("heatmaps/")) {
      images.set(name, Buffer.from(bytes));
      continue;
    }
    throw new Error(`Unexpected ZIP entry: ${name}. Only batch.json and heatmaps/ are allowed`);
  }
  if (!manifestText) throw new Error("The ZIP must contain batch.json at its root");
  return { manifestText, images };
}

function readDirectJson(primary: IncomingPackageFile, supplementalImages: IncomingPackageFile[]) {
  const images = new Map<string, Buffer>();
  for (const image of supplementalImages) {
    const name = path.basename(image.originalName);
    const manifestPath = `heatmaps/${name}`;
    if (images.has(manifestPath)) throw new Error(`Duplicate heatmap filename: ${name}`);
    images.set(manifestPath, image.buffer);
  }
  return { manifestText: primary.buffer.toString("utf8"), images };
}

export async function parseLocalFalconPackage(
  primary: IncomingPackageFile,
  supplementalImages: IncomingPackageFile[] = [],
): Promise<ParsedLocalFalconPackage> {
  if (primary.buffer.byteLength > LOCAL_FALCON_PACKAGE_MAX_BYTES) throw new Error("The package exceeds the 50 MB limit");
  const isZip = primary.originalName.toLowerCase().endsWith(".zip") || primary.mimeType.includes("zip");
  const isJson = primary.originalName.toLowerCase().endsWith(".json") || primary.mimeType.includes("json");
  if (!isZip && !isJson) throw new Error("Upload a .zip package or canonical .json manifest");
  if (isZip && supplementalImages.length) throw new Error("A ZIP package already contains its heatmaps; remove the separate image files");

  const { manifestText, images } = isZip ? readZip(primary) : readDirectJson(primary, supplementalImages);
  const payload = parseLocalFalconPayload(manifestText);
  const referencedPaths = new Set(payload.prospects.map((prospect) => normalizeEntryPath(prospect.heatmap_file)));

  for (const referenced of referencedPaths) {
    if (!images.has(referenced)) throw new Error(`Missing heatmap referenced by batch.json: ${referenced}`);
  }
  for (const imagePath of images.keys()) {
    if (!referencedPaths.has(imagePath)) throw new Error(`Unreferenced heatmap in package: ${imagePath}`);
  }

  const heatmapsByPath = new Map<string, ValidatedHeatmap>();
  for (const [imagePath, buffer] of images.entries()) {
    heatmapsByPath.set(imagePath, await validateHeatmap(buffer, imagePath));
  }
  const heatmapsByPlaceId = new Map<string, ValidatedHeatmap>();
  for (const prospect of payload.prospects) {
    heatmapsByPlaceId.set(prospect.place_id, heatmapsByPath.get(normalizeEntryPath(prospect.heatmap_file))!);
  }

  return { payload, heatmapsByPath, heatmapsByPlaceId };
}
