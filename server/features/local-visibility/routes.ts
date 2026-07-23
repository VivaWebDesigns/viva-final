import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import sharp from "sharp";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { requireRole } from "../auth/middleware";
import { analyzeVisibilityScreenshots } from "./analysis";
import { db } from "../../db";
import { crmLeads, localFalconImportBatches, localFalconProspectProfiles } from "@shared/schema";
import { deleteFile, getFileBuffer, getSignedDownloadUrl, uploadFile } from "../../services/storage";
import {
  getLocalFalconMapPresentation,
} from "@shared/localVisibility";

const router = Router();
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 2, fileSize: MAX_SCREENSHOT_BYTES },
  fileFilter: (_req, file, callback) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new Error("Only PNG, JPG, and WebP screenshots are supported."));
  },
});

router.get(
  "/prospects",
  requireRole("admin", "developer", "sales_rep"),
  async (req, res) => {
    try {
      const ownership = req.authUser?.role === "sales_rep" ? eq(crmLeads.assignedTo, req.authUser.id) : undefined;
      const where = ownership
        ? and(isNotNull(localFalconProspectProfiles.heatmapStorageKey), ownership)
        : isNotNull(localFalconProspectProfiles.heatmapStorageKey);
      const rows = await db.select({
        leadId: crmLeads.id,
        businessName: localFalconProspectProfiles.companyName,
        city: localFalconProspectProfiles.city,
        state: localFalconProspectProfiles.state,
        keyword: localFalconProspectProfiles.scanKeyword,
        scanDate: localFalconProspectProfiles.scanDate,
      }).from(localFalconProspectProfiles)
        .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
        .where(where)
        .orderBy(desc(localFalconProspectProfiles.createdAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },
);

router.get(
  "/prospects/:leadId/snapshot-file",
  requireRole("admin", "developer", "sales_rep"),
  async (req, res) => {
    try {
      const [record] = await db.select({
        snapshotStorageKey: localFalconProspectProfiles.snapshotStorageKey,
        assignedTo: crmLeads.assignedTo,
      }).from(localFalconProspectProfiles)
        .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
        .where(eq(localFalconProspectProfiles.leadId, req.params.leadId as string))
        .limit(1);
      if (!record?.snapshotStorageKey) return res.status(404).json({ message: "Finished snapshot not found" });
      if (req.authUser?.role === "sales_rep" && record.assignedTo !== req.authUser.id) {
        return res.status(403).json({ message: "This prospect is not assigned to you" });
      }
      const file = await getFileBuffer(record.snapshotStorageKey);
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Length", String(file.buffer.byteLength));
      res.setHeader("Cache-Control", "private, max-age=300");
      res.setHeader("Content-Disposition", `inline; filename="${req.params.leadId}-local-visibility-snapshot.png"`);
      res.send(file.buffer);
    } catch (error: any) {
      res.status(error?.statusCode ?? 500).json({ message: error.message });
    }
  },
);

router.get(
  "/prospects/:leadId",
  requireRole("admin", "developer", "sales_rep"),
  async (req, res) => {
    try {
      const [record] = await db.select({
        profile: localFalconProspectProfiles,
        batch: localFalconImportBatches,
        assignedTo: crmLeads.assignedTo,
      }).from(localFalconProspectProfiles)
        .innerJoin(localFalconImportBatches, eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id))
        .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
        .where(eq(localFalconProspectProfiles.leadId, req.params.leadId as string))
        .limit(1);
      if (!record) return res.status(404).json({ message: "Local Falcon prospect not found" });
      if (req.authUser?.role === "sales_rep" && record.assignedTo !== req.authUser.id) {
        return res.status(403).json({ message: "This prospect is not assigned to you" });
      }
      if (!record.profile.heatmapStorageKey) return res.status(409).json({ message: "This prospect has no heatmap evidence" });
      const heatmapImageUrl = await getSignedDownloadUrl(record.profile.heatmapStorageKey);
      const snapshotImageUrl = record.profile.snapshotStorageKey
        ? await getSignedDownloadUrl(record.profile.snapshotStorageKey)
        : null;
      const address = [record.profile.address, record.profile.city, record.profile.state, record.profile.zip]
        .filter(Boolean).join(", ").replace(/, ([A-Z]{2}), /, ", $1 ");
      res.json({
        leadId: req.params.leadId as string,
        reportUrl: record.profile.reportUrl,
        snapshotImageUrl,
        snapshotGeneratedAt: record.profile.snapshotGeneratedAt,
        mapPresentation: getLocalFalconMapPresentation(!!record.profile.heatmapSourceUrl),
        data: {
          businessName: record.profile.companyName ?? "",
          address,
          rating: record.profile.rating,
          reviewCount: String(record.profile.reviewCount),
          searchPhrase: record.profile.scanKeyword,
          market: `${record.batch.marketCity}, ${record.batch.marketState}`,
          averagePosition: record.profile.arp,
          gridSize: record.batch.gridSize ?? "7 × 7",
          radius: record.batch.radiusMiles ?? "2.5",
          heatmapImageUrl,
        },
      });
    } catch (error: any) {
      res.status(error?.statusCode ?? 500).json({ message: error.message });
    }
  },
);

router.post(
  "/prospects/:leadId/snapshot",
  requireRole("admin", "developer"),
  upload.single("snapshot"),
  async (req, res) => {
    let uploadedKey: string | null = null;
    try {
      const snapshot = req.file;
      if (!snapshot || snapshot.mimetype !== "image/png") {
        return res.status(400).json({ message: "Upload the finished report as a PNG." });
      }
      const metadata = await sharp(snapshot.buffer).metadata();
      if (metadata.width !== 1080 || metadata.height !== 1920) {
        return res.status(400).json({ message: "The finished snapshot must be 1080 × 1920." });
      }
      const [record] = await db.select({
        id: localFalconProspectProfiles.id,
        previousKey: localFalconProspectProfiles.snapshotStorageKey,
      }).from(localFalconProspectProfiles)
        .where(eq(localFalconProspectProfiles.leadId, req.params.leadId as string))
        .limit(1);
      if (!record) return res.status(404).json({ message: "Local Falcon prospect not found" });

      const stored = await uploadFile(
        snapshot.buffer,
        `${req.params.leadId}-local-visibility-snapshot.png`,
        "image/png",
        "local-visibility-snapshots",
      );
      uploadedKey = stored.key;
      const generatedAt = new Date();
      await db.update(localFalconProspectProfiles).set({
        snapshotStorageKey: stored.key,
        snapshotOriginalName: stored.originalName,
        snapshotMimeType: stored.mimeType,
        snapshotSizeBytes: stored.sizeBytes,
        snapshotSha256: crypto.createHash("sha256").update(snapshot.buffer).digest("hex"),
        snapshotGeneratedAt: generatedAt,
      }).where(eq(localFalconProspectProfiles.id, record.id));
      if (record.previousKey && record.previousKey !== stored.key) {
        await deleteFile(record.previousKey).catch(() => undefined);
      }
      uploadedKey = null;
      res.json({
        snapshotImageUrl: await getSignedDownloadUrl(stored.key),
        snapshotGeneratedAt: generatedAt,
      });
    } catch (error: any) {
      if (uploadedKey) await deleteFile(uploadedKey).catch(() => undefined);
      res.status(error?.statusCode ?? 500).json({ message: error.message });
    }
  },
);

router.post(
  "/analyze-screenshots",
  requireRole("admin", "developer"),
  upload.array("screenshots", 2),
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length !== 2) {
        return res.status(400).json({ message: "Paste or upload exactly two screenshots." });
      }

      const result = await analyzeVisibilityScreenshots(
        [
          { buffer: files[0].buffer, mimeType: files[0].mimetype },
          { buffer: files[1].buffer, mimeType: files[1].mimetype },
        ],
        req.authUser!.id,
      );

      return res.json(result);
    } catch (error) {
      const localStatusCode = error instanceof Error && "statusCode" in error
        ? Number((error as Error & { statusCode?: number }).statusCode) || 0
        : 0;
      if (localStatusCode) {
        return res.status(localStatusCode).json({ message: (error as Error).message });
      }
      console.error("[local-visibility] screenshot analysis failed", error);
      return res.status(502).json({ message: "Screenshot analysis is temporarily unavailable. Please try again." });
    }
  },
);

router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Each screenshot must be 10 MB or smaller." : error.message });
  }
  if (error instanceof Error) return res.status(400).json({ message: error.message });
  return next(error);
});

export default router;
