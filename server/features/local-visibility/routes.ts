import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { requireRole } from "../auth/middleware";
import { analyzeVisibilityScreenshots } from "./analysis";

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
