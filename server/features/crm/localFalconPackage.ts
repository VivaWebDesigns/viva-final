import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { unzipSync } from "fflate";
import {
  parseLocalFalconPayload,
  isDeliverableProspect,
  type DeliverableProspectInput,
  type LocalFalconPayload,
} from "./localFalconImport";

export const LOCAL_FALCON_PACKAGE_MAX_BYTES = 50 * 1024 * 1024;
export const LOCAL_FALCON_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
const LOCAL_FALCON_IMAGE_ORIGIN = "https://lf-static-v2.localfalcon.com";
const LOCAL_FALCON_IMAGE_TIMEOUT_MS = 30_000;
const LOCAL_FALCON_IMAGE_MAX_ATTEMPTS = 3;
const LOCAL_FALCON_IMAGE_CONCURRENCY = 3;
const LOCAL_FALCON_RETRY_DELAYS_MS = [500, 1_500];
const VERIFIED_HEATMAP_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const VERIFIED_HEATMAP_CACHE_MAX_BYTES = 512 * 1024 * 1024;

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

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
  sourceUrl?: string;
}

export interface LocalFalconImageFailure {
  placeId: string;
  companyName: string;
  reportKey: string;
  reason: string;
}

export class LocalFalconImageFetchError extends Error {
  readonly code = "LOCAL_FALCON_IMAGE_FETCH_FAILED";

  constructor(readonly failures: LocalFalconImageFailure[]) {
    const label = failures.length === 1 ? "map" : "maps";
    super(`Local Falcon could not retrieve ${failures.length} official ${label}. Add the fallback image${failures.length === 1 ? "" : "s"} shown below, then review again.`);
    this.name = "LocalFalconImageFetchError";
  }
}

class LocalFalconFetchAttemptError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "LocalFalconFetchAttemptError";
  }
}

export interface ParsedLocalFalconPackage {
  payload: LocalFalconPayload;
  heatmapsByPath: Map<string, ValidatedHeatmap>;
  heatmapsByPlaceId: Map<string, ValidatedHeatmap>;
  sourceMode: "local_falcon" | "zip" | "fallback";
}

export interface VerifiedHeatmapAssetRef {
  manifestSha256: string;
  reportKey: string;
  heatmapSha256: string;
}

interface VerifiedHeatmapCacheEntry {
  placeId: string;
  expiresAt: number;
  heatmap: ValidatedHeatmap;
}

const verifiedHeatmapCache = new Map<string, VerifiedHeatmapCacheEntry>();
let verifiedHeatmapCacheBytes = 0;

function verifiedHeatmapCacheKey(reference: VerifiedHeatmapAssetRef): string {
  return `${reference.manifestSha256}:${reference.reportKey}:${reference.heatmapSha256}`;
}

function removeVerifiedHeatmapCacheEntry(key: string): void {
  const entry = verifiedHeatmapCache.get(key);
  if (!entry) return;
  verifiedHeatmapCacheBytes -= entry.heatmap.sizeBytes;
  verifiedHeatmapCache.delete(key);
}

function pruneVerifiedHeatmapCache(now = Date.now()): void {
  for (const [key, entry] of verifiedHeatmapCache) {
    if (entry.expiresAt <= now) removeVerifiedHeatmapCacheEntry(key);
  }
  while (verifiedHeatmapCacheBytes > VERIFIED_HEATMAP_CACHE_MAX_BYTES) {
    const oldestKey = verifiedHeatmapCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    removeVerifiedHeatmapCacheEntry(oldestKey);
  }
}

export function localFalconManifestSha256(primary: IncomingPackageFile): string {
  const { manifestText } = primary.originalName.toLowerCase().endsWith(".zip")
    ? readZip(primary)
    : readDirectJson(primary, []);
  return crypto.createHash("sha256").update(manifestText).digest("hex");
}

export function cacheVerifiedHeatmap(
  manifestSha256: string,
  prospect: DeliverableProspectInput,
  heatmap: ValidatedHeatmap,
): VerifiedHeatmapAssetRef {
  pruneVerifiedHeatmapCache();
  const reference = {
    manifestSha256,
    reportKey: prospect.report_key,
    heatmapSha256: heatmap.sha256,
  };
  const key = verifiedHeatmapCacheKey(reference);
  removeVerifiedHeatmapCacheEntry(key);
  verifiedHeatmapCache.set(key, {
    placeId: prospect.place_id,
    expiresAt: Date.now() + VERIFIED_HEATMAP_CACHE_TTL_MS,
    heatmap,
  });
  verifiedHeatmapCacheBytes += heatmap.sizeBytes;
  pruneVerifiedHeatmapCache();
  return reference;
}

export function resolveVerifiedHeatmap(
  reference: VerifiedHeatmapAssetRef,
  expected: { manifestSha256: string; reportKey: string; placeId: string },
): ValidatedHeatmap {
  pruneVerifiedHeatmapCache();
  if (reference.manifestSha256 !== expected.manifestSha256 || reference.reportKey !== expected.reportKey) {
    throw new Error(`The verified map reference does not match ${expected.placeId}. Review the preview again.`);
  }
  const entry = verifiedHeatmapCache.get(verifiedHeatmapCacheKey(reference));
  if (!entry || entry.placeId !== expected.placeId || entry.expiresAt <= Date.now()) {
    throw new Error(`The verified map for ${expected.placeId} is missing or expired. Review the preview again.`);
  }
  const currentSha256 = crypto.createHash("sha256").update(entry.heatmap.buffer).digest("hex");
  if (currentSha256 !== reference.heatmapSha256 || currentSha256 !== entry.heatmap.sha256) {
    removeVerifiedHeatmapCacheEntry(verifiedHeatmapCacheKey(reference));
    throw new Error(`The verified map for ${expected.placeId} no longer matches its checksum. Review the preview again.`);
  }
  return entry.heatmap;
}

export function parseLocalFalconManifest(primary: IncomingPackageFile): LocalFalconPayload {
  const { manifestText } = primary.originalName.toLowerCase().endsWith(".zip")
    ? readZip(primary)
    : readDirectJson(primary, []);
  return parseLocalFalconPayload(manifestText);
}

export async function parseSingleLocalFalconHeatmap(
  primary: IncomingPackageFile,
  supplementalImages: IncomingPackageFile[],
  placeId: string,
  fetchImpl: FetchLike,
): Promise<{ payload: LocalFalconPayload; heatmap: ValidatedHeatmap }> {
  const source = primary.originalName.toLowerCase().endsWith(".zip")
    ? readZip(primary)
    : readDirectJson(primary, supplementalImages);
  const payload = parseLocalFalconPayload(source.manifestText);
  const prospect = payload.prospects.find((candidate) => candidate.place_id === placeId);
  if (!prospect) throw new Error(`Place ID ${placeId} is not present in batch.json`);
  if (!isDeliverableProspect(prospect)) throw new Error(`Place ID ${placeId} has no deliverable map`);

  const fallbackPath = fallbackPathForProspect(prospect, source.images);
  const images = new Map<string, Buffer>();
  if (fallbackPath) images.set(fallbackPath, source.images.get(fallbackPath)!);
  const singlePayload = { ...payload, prospects: [prospect] };
  const parsed = await parseJsonPackage(JSON.stringify(singlePayload), images, fetchImpl);
  const heatmap = parsed.heatmapsByPlaceId.get(placeId);
  if (!heatmap) throw new Error(`Heatmap missing for Place ID ${placeId}`);
  return { payload, heatmap };
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

async function validateHeatmap(
  buffer: Buffer,
  manifestPath: string,
  options: { originalName?: string; sourceUrl?: string; requireFullMap?: boolean } = {},
): Promise<ValidatedHeatmap> {
  if (buffer.byteLength === 0) throw new Error(`${manifestPath} is empty`);
  if (buffer.byteLength > LOCAL_FALCON_IMAGE_MAX_BYTES) throw new Error(`${manifestPath} exceeds the 10 MB image limit`);
  const mimeType = detectImageMime(buffer);
  if (!mimeType) throw new Error(`${manifestPath} is not a valid PNG, JPG, or WebP image`);

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error(`${manifestPath} could not be decoded as an image`);
  }
  if (
    options.requireFullMap &&
    (
      !metadata.width ||
      !metadata.height ||
      metadata.width < 500 ||
      metadata.height < 500 ||
      metadata.width / metadata.height < 0.75 ||
      metadata.width / metadata.height > 1.34
    )
  ) {
    throw new Error(`${manifestPath} is not a complete Local Falcon map image`);
  }

  const preview = await sharp(buffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  return {
    buffer,
    manifestPath,
    originalName: options.originalName ?? path.posix.basename(manifestPath),
    mimeType,
    sizeBytes: buffer.byteLength,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    previewDataUrl: `data:image/webp;base64,${preview.toString("base64")}`,
    sourceUrl: options.sourceUrl,
  };
}

function readZip(primary: IncomingPackageFile): {
  manifestText: string;
  images: Map<string, Buffer>;
} {
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

function readDirectJson(
  primary: IncomingPackageFile,
  supplementalImages: IncomingPackageFile[],
) {
  const images = new Map<string, Buffer>();
  for (const image of supplementalImages) {
    const name = path.basename(image.originalName);
    const fallbackPath = `heatmaps/${name}`;
    if (images.has(fallbackPath)) throw new Error(`Duplicate fallback image filename: ${name}`);
    images.set(fallbackPath, image.buffer);
  }
  return {
    manifestText: primary.buffer.toString("utf8"),
    images,
  };
}

function fallbackPathForProspect(prospect: DeliverableProspectInput, images: Map<string, Buffer>): string | null {
  if (prospect.heatmap_file) {
    const referenced = normalizeEntryPath(prospect.heatmap_file);
    if (images.has(referenced)) return referenced;
  }
  const expectedBase = prospect.place_id.toLowerCase();
  return [...images.keys()].find((imagePath) => {
    const parsed = path.posix.parse(imagePath);
    return parsed.name.toLowerCase() === expectedBase && [".png", ".jpg", ".jpeg", ".webp"].includes(parsed.ext.toLowerCase());
  }) ?? null;
}

async function readResponseWithLimit(response: Response): Promise<Buffer> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > LOCAL_FALCON_IMAGE_MAX_BYTES) {
    throw new Error("the image exceeds the 10 MB limit");
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > LOCAL_FALCON_IMAGE_MAX_BYTES) {
      await reader.cancel();
      throw new Error("the image exceeds the 10 MB limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function errorMessage(error: unknown, fallback = "network request failed"): string {
  return error instanceof Error ? error.message : fallback;
}

function logOfficialMapFailure(details: {
  prospect: DeliverableProspectInput;
  attempt: number;
  durationMs: number;
  error: LocalFalconFetchAttemptError;
  final: boolean;
}) {
  console.warn("[local-falcon:image-fetch]", JSON.stringify({
    reportKey: details.prospect.report_key,
    placeId: details.prospect.place_id,
    companyName: details.prospect.company_name,
    attempt: details.attempt,
    maxAttempts: LOCAL_FALCON_IMAGE_MAX_ATTEMPTS,
    durationMs: details.durationMs,
    httpStatus: details.error.status,
    retryable: details.error.retryable,
    outcome: details.final ? "failed" : "retrying",
    reason: details.error.message,
  }));
}

async function fetchOfficialMapAttempt(
  prospect: DeliverableProspectInput,
  fetchImpl: FetchLike,
): Promise<ValidatedHeatmap> {
  const sourceUrl = `${LOCAL_FALCON_IMAGE_ORIGIN}/image/${encodeURIComponent(prospect.report_key)}`;
  let response: Response;
  try {
    response = await fetchImpl(sourceUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(LOCAL_FALCON_IMAGE_TIMEOUT_MS),
      headers: { Accept: "image/png,image/jpeg,image/webp" },
    });
  } catch (error) {
    throw new LocalFalconFetchAttemptError(errorMessage(error), true);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new LocalFalconFetchAttemptError("Local Falcon returned an unexpected redirect", false, response.status);
  }
  if (!response.ok) {
    const retryable = [408, 425, 429].includes(response.status) || response.status >= 500;
    throw new LocalFalconFetchAttemptError(`Local Falcon returned HTTP ${response.status}`, retryable, response.status);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new LocalFalconFetchAttemptError(
      `Local Falcon returned ${contentType || "an unknown content type"} instead of an image`,
      false,
      response.status,
    );
  }

  let buffer: Buffer;
  try {
    buffer = await readResponseWithLimit(response);
  } catch (error) {
    const message = errorMessage(error, "Local Falcon image download failed");
    throw new LocalFalconFetchAttemptError(
      message,
      !message.includes("exceeds the 10 MB limit"),
      response.status,
    );
  }
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  try {
    return await validateHeatmap(buffer, `local-falcon/${prospect.place_id}.${extension}`, {
      originalName: `${prospect.place_id}.${extension}`,
      sourceUrl,
      requireFullMap: true,
    });
  } catch (error) {
    throw new LocalFalconFetchAttemptError(errorMessage(error, "Local Falcon image validation failed"), false, response.status);
  }
}

async function fetchOfficialMap(
  prospect: DeliverableProspectInput,
  fetchImpl: FetchLike,
): Promise<ValidatedHeatmap> {
  for (let attempt = 1; attempt <= LOCAL_FALCON_IMAGE_MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await fetchOfficialMapAttempt(prospect, fetchImpl);
    } catch (error) {
      const attemptError = error instanceof LocalFalconFetchAttemptError
        ? error
        : new LocalFalconFetchAttemptError(errorMessage(error, "Image retrieval failed"), false);
      const final = !attemptError.retryable || attempt === LOCAL_FALCON_IMAGE_MAX_ATTEMPTS;
      logOfficialMapFailure({
        prospect,
        attempt,
        durationMs: Date.now() - startedAt,
        error: attemptError,
        final,
      });
      if (final) throw new Error(attemptError.message);

      const delayMs = process.env.NODE_ENV === "test"
        ? 0
        : LOCAL_FALCON_RETRY_DELAYS_MS[attempt - 1] ?? LOCAL_FALCON_RETRY_DELAYS_MS.at(-1)!;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Image retrieval failed");
}

async function forEachWithConcurrency<T>(
  items: T[],
  concurrency: number,
  callback: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await callback(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

async function parseZipPackage(
  manifestText: string,
  images: Map<string, Buffer>,
): Promise<ParsedLocalFalconPackage> {
  const payload = parseLocalFalconPayload(manifestText);
  const referencedPaths = new Set<string>();
  for (const [index, prospect] of payload.prospects.entries()) {
    if (!isDeliverableProspect(prospect)) continue;
    if (!prospect.heatmap_file) throw new Error(`prospects.${index}.heatmap_file is required when using the ZIP fallback`);
    referencedPaths.add(normalizeEntryPath(prospect.heatmap_file));
  }
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
  for (const prospect of payload.prospects.filter(isDeliverableProspect)) {
    heatmapsByPlaceId.set(prospect.place_id, heatmapsByPath.get(normalizeEntryPath(prospect.heatmap_file!))!);
  }
  return { payload, heatmapsByPath, heatmapsByPlaceId, sourceMode: "zip" };
}

async function parseJsonPackage(
  manifestText: string,
  images: Map<string, Buffer>,
  fetchImpl: FetchLike,
): Promise<ParsedLocalFalconPackage> {
  const payload = parseLocalFalconPayload(manifestText);
  const heatmapsByPath = new Map<string, ValidatedHeatmap>();
  const heatmapsByPlaceId = new Map<string, ValidatedHeatmap>();
  const usedFallbackPaths = new Set<string>();
  const failures: LocalFalconImageFailure[] = [];

  await forEachWithConcurrency<DeliverableProspectInput>(
    payload.prospects.filter(isDeliverableProspect),
    LOCAL_FALCON_IMAGE_CONCURRENCY,
    async (prospect) => {
      const fallbackPath = fallbackPathForProspect(prospect, images);
      if (fallbackPath) {
        const heatmap = await validateHeatmap(images.get(fallbackPath)!, fallbackPath);
        heatmapsByPath.set(fallbackPath, heatmap);
        heatmapsByPlaceId.set(prospect.place_id, heatmap);
        usedFallbackPaths.add(fallbackPath);
        return;
      }

      try {
        const heatmap = await fetchOfficialMap(prospect, fetchImpl);
        heatmapsByPath.set(heatmap.manifestPath, heatmap);
        heatmapsByPlaceId.set(prospect.place_id, heatmap);
      } catch (error) {
        failures.push({
          placeId: prospect.place_id,
          companyName: prospect.company_name,
          reportKey: prospect.report_key,
          reason: error instanceof Error ? error.message : "Image retrieval failed",
        });
      }
    },
  );

  for (const imagePath of images.keys()) {
    if (!usedFallbackPaths.has(imagePath)) throw new Error(`Unreferenced fallback image: ${imagePath}`);
  }
  if (failures.length) throw new LocalFalconImageFetchError(failures);

  return {
    payload,
    heatmapsByPath,
    heatmapsByPlaceId,
    sourceMode: usedFallbackPaths.size ? "fallback" : "local_falcon",
  };
}

export async function parseLocalFalconPackage(
  primary: IncomingPackageFile,
  supplementalImages: IncomingPackageFile[] = [],
  fetchImpl: FetchLike = fetch,
): Promise<ParsedLocalFalconPackage> {
  if (primary.buffer.byteLength > LOCAL_FALCON_PACKAGE_MAX_BYTES) throw new Error("The package exceeds the 50 MB limit");
  const isZip = primary.originalName.toLowerCase().endsWith(".zip") || primary.mimeType.includes("zip");
  const isJson = primary.originalName.toLowerCase().endsWith(".json") || primary.mimeType.includes("json");
  if (!isZip && !isJson) throw new Error("Upload a .zip package or canonical .json manifest");
  if (isZip && supplementalImages.length) {
    throw new Error("A ZIP package already contains its heatmaps; remove the separate files");
  }

  if (isZip) {
    const { manifestText, images } = readZip(primary);
    if (images.size > 0) return parseZipPackage(manifestText, images);
    return parseJsonPackage(manifestText, images, fetchImpl);
  }
  const { manifestText, images } = readDirectJson(
    primary,
    supplementalImages,
  );
  return parseJsonPackage(manifestText, images, fetchImpl);
}
