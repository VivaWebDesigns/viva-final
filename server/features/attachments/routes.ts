import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/middleware";
import { db } from "../../db";
import { attachments } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as storageService from "../../services/storage";

const router = Router();

router.use(requireAuth, (req, res, next) => {
  if (req.authUser?.role === "extension_worker") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: storageService.MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (storageService.ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided" });
    const { entityType, entityId, folder } = req.body;

    const result = await storageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder || "uploads"
    );

    const [attachment] = await db.insert(attachments).values({
      key: result.key,
      url: result.url,
      originalName: result.originalName,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      uploaderUserId: req.authUser?.id ?? null,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    }).returning();

    res.status(201).json(attachment);
  } catch (err: any) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "File too large. Maximum size is 10MB." });
    }
    res.status(400).json({ message: err.message });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) return res.status(400).json({ message: "entityType and entityId are required" });
    const rows = await db.select().from(attachments)
      .where(and(eq(attachments.entityType, entityType as string), eq(attachments.entityId, entityId as string)));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const [att] = await db.select().from(attachments).where(eq(attachments.id, req.params.id as string));
    if (!att) return res.status(404).json({ message: "Attachment not found" });
    if (att.uploaderUserId !== req.authUser?.id && req.authUser?.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }
    await storageService.deleteFile(att.key);
    await db.delete(attachments).where(eq(attachments.id, att.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/status", requireAuth, (_req, res) => {
  res.json({ configured: storageService.isConfigured(), allowedTypes: storageService.ALLOWED_TYPES, maxSizeBytes: storageService.MAX_FILE_SIZE_BYTES });
});

export default router;
