/**
 * Import competitor scans from a batch.json without a browser.
 *
 * Usage (from the repo root):
 *   npm run import:competitors -- path/to/batch.json            # dry run: renders the report images only
 *   npm run import:competitors -- path/to/batch.json --confirm  # uploads and imports
 *
 * Only competitor-only batches are accepted; lead batches still go through the
 * CRM Import window, where a setter and lead type are chosen. The report image
 * is drawn from the CRM's own template in headless Chromium, so it matches the
 * Import window exactly. Runs against production through scripts/with-railway-db.sh;
 * storage and Local Falcon credentials are read from Railway and never printed.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const PROJECT = "d861737f-dd6d-4e9d-9576-40bf63ad8c91";
const APP_SERVICE = "VivaWebDesigns.com";
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "tmp", "competitor-snapshots");

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const asIndex = args.indexOf("--as");
const importerEmail = asIndex >= 0 ? args[asIndex + 1] : "matt@vivawebdesigns.com";
const batchPath = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--as");
if (!batchPath) {
  console.error("Usage: npm run import:competitors -- path/to/batch.json [--confirm] [--as email]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run this through npm run import:competitors, which opens the Railway tunnel.");
  process.exit(1);
}

// Storage and Local Falcon credentials only; DATABASE_URL stays the tunnel's.
const appVariables = JSON.parse(execFileSync(
  "railway",
  ["variable", "list", "-p", PROJECT, "-e", "production", "-s", APP_SERVICE, "--json"],
  { encoding: "utf8" },
)) as Record<string, string>;
for (const [name, value] of Object.entries(appVariables)) {
  if (/^(R2_|CLOUDFLARE_R2_|REPORTS_)/.test(name) || name === "LOCAL_FALCON_API_KEY") process.env[name] = value;
}

const sharp = (await import("sharp")).default;
const { eq } = await import("drizzle-orm");
const { db } = await import("../server/db");
const { user } = await import("@shared/schema");
const { getLocalFalconMapPresentation } = await import("@shared/localVisibility");
const { hydrateReportAtrp } = await import("../server/features/local-visibility/metrics");
const { SNAPSHOT_MIME_TYPE, snapshotFileName, toSnapshotJpeg } = await import("../server/features/local-visibility/snapshotImage");
const storageService = await import("../server/services/storage");
const { logAudit } = await import("../server/features/audit/service");
const { parseLocalFalconPackage } = await import("../server/features/crm/localFalconPackage");
const {
  findBatchEntry,
  getProspectScanSpec,
  importLocalFalconPayload,
  isCompetitorScan,
  localFalconReportData,
  mappedScans,
  previewLocalFalconImport,
} = await import("../server/features/crm/localFalconImport");
type LocalFalconUploadedAsset = import("../server/features/crm/localFalconImport").LocalFalconUploadedAsset;

async function startRenderer() {
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const { chromium } = await import("playwright");
  const vite = await createServer({
    configFile: false,
    root: path.join(REPO_ROOT, "scripts", "report-snapshot"),
    publicDir: path.join(REPO_ROOT, "client", "public"),
    plugins: [react()],
    css: { postcss: {} },
    resolve: {
      alias: {
        "@": path.join(REPO_ROOT, "client", "src"),
        "@shared": path.join(REPO_ROOT, "shared"),
      },
    },
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  await vite.listen();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto(vite.resolvedUrls!.local[0]);
  await page.waitForFunction(() => typeof window.renderReport === "function");
  return {
    async render(data: unknown, map: unknown): Promise<Buffer> {
      const base64 = await page.evaluate(([reportData, mapPresentation]) =>
        window.renderReport(reportData as never, mapPresentation as never), [data, map] as const);
      return Buffer.from(base64, "base64");
    },
    async close() {
      await browser.close();
      await vite.close();
    },
  };
}

const uploadedKeys: string[] = [];
const renderer = await startRenderer();
try {
  const buffer = readFileSync(path.resolve(batchPath));
  const parsed = await parseLocalFalconPackage({ buffer, originalName: "batch.json", mimeType: "application/json" }, [], fetch);
  const { payload } = parsed;
  if (payload.prospects.length > 0) {
    throw new Error("This batch has lead prospects. Import leads with the CRM Import button; this command only imports competitor scans.");
  }
  await hydrateReportAtrp(mappedScans(payload));
  const preview = await previewLocalFalconImport(payload);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const snapshots = new Map<string, Buffer>();
  for (const row of preview.rows) {
    console.log(`${row.outcome.padEnd(10)} ${row.companyName} — ${row.reason ?? ""}`);
    if (row.outcome !== "competitor") continue;
    const scan = findBatchEntry(payload, row.placeId);
    const heatmap = parsed.heatmapsByPlaceId.get(row.placeId);
    if (!scan || !isCompetitorScan(scan) || !heatmap) throw new Error(`The official map for ${row.companyName} is missing.`);
    const png = await renderer.render(
      localFalconReportData(payload, scan, heatmap.previewDataUrl),
      getLocalFalconMapPresentation(!!heatmap.sourceUrl, getProspectScanSpec(payload, scan).radius_miles),
    );
    const metadata = await sharp(png).metadata();
    if (metadata.width !== 1080 || metadata.height !== 1920) {
      throw new Error(`The report image for ${row.companyName} is ${metadata.width} × ${metadata.height}, not 1080 × 1920.`);
    }
    const jpeg = await toSnapshotJpeg(png);
    const outputPath = path.join(OUTPUT_DIR, `${row.placeId}.jpg`);
    writeFileSync(outputPath, jpeg);
    snapshots.set(row.placeId, jpeg);
    console.log(`           report image: ${outputPath} (${Math.round(jpeg.byteLength / 1024)} KB)`);
  }

  if (!confirm) {
    console.log("\nDry run: nothing was uploaded or saved. Review the images, then rerun with --confirm.");
  } else {
    const [importer] = await db.select({ id: user.id }).from(user).where(eq(user.email, importerEmail)).limit(1);
    if (!importer) throw new Error(`No CRM user has the email ${importerEmail}.`);

    const assetsByPlaceId = new Map<string, LocalFalconUploadedAsset>();
    for (const [placeId, jpeg] of snapshots) {
      const heatmap = parsed.heatmapsByPlaceId.get(placeId)!;
      const heatmapUpload = await storageService.uploadFile(heatmap.buffer, heatmap.originalName, heatmap.mimeType, "local-falcon");
      uploadedKeys.push(heatmapUpload.key);
      const snapshotUpload = await storageService.uploadFile(jpeg, snapshotFileName(placeId), SNAPSHOT_MIME_TYPE, "local-visibility-snapshots");
      uploadedKeys.push(snapshotUpload.key);
      assetsByPlaceId.set(placeId, {
        key: heatmapUpload.key,
        originalName: heatmapUpload.originalName,
        mimeType: heatmapUpload.mimeType,
        sizeBytes: heatmapUpload.sizeBytes,
        sha256: heatmap.sha256,
        manifestPath: heatmap.manifestPath,
        sourceUrl: heatmap.sourceUrl,
        snapshot: {
          key: snapshotUpload.key,
          originalName: snapshotUpload.originalName,
          mimeType: snapshotUpload.mimeType,
          sizeBytes: snapshotUpload.sizeBytes,
          sha256: (await import("node:crypto")).createHash("sha256").update(jpeg).digest("hex"),
        },
      });
    }

    const result = await importLocalFalconPayload(payload, importer.id, "", null, new Set(), assetsByPlaceId);
    for (const competitor of result.importedCompetitors) {
      const asset = assetsByPlaceId.get(competitor.placeId);
      if (asset && !competitor.createdReport) {
        await storageService.deleteFile(asset.key).catch(() => undefined);
        await storageService.deleteFile(asset.snapshot.key).catch(() => undefined);
      }
    }
    uploadedKeys.length = 0;
    await logAudit({
      userId: importer.id,
      action: "import",
      entity: "local_falcon_batch",
      entityId: result.batchId,
      metadata: { via: "import-competitors", competitors: result.importedCompetitors },
    });
    for (const competitor of result.importedCompetitors) {
      console.log(`\n${competitor.createdReport ? "Saved" : "Already saved"} competitor report ${competitor.reportId}; linked to ${competitor.linkedReportCount} lead report(s).`);
    }
  }
} catch (error) {
  await Promise.all(uploadedKeys.map((key) => storageService.deleteFile(key).catch(() => undefined)));
  console.error(`\nImport failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await renderer.close();
  process.exit(process.exitCode ?? 0);
}
