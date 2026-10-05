import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { listInstantlyRedrawQueue, prepareInstantlyEnrollment, previewInstantlyEnrollment } from "./enrollment";

const router = Router();

// Read-only: who would be staged and why others are left out.
router.get("/enrollment/preview", requireRole("admin"), async (_req, res) => {
  try {
    res.json(await previewInstantlyEnrollment());
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Read-only: the reports whose snapshots the bulk redraw page regenerates.
router.get("/enrollment/redraw-queue", requireRole("admin"), async (_req, res) => {
  try {
    res.json(await listInstantlyRedrawQueue());
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Publishes images and stages leads as "ready". Does not contact Instantly.
router.post("/enrollment/prepare", requireRole("admin"), async (req, res) => {
  try {
    const result = await prepareInstantlyEnrollment();
    await logAudit({
      userId: req.authUser!.id,
      action: "instantly_enrollment_prepared",
      entity: "instantly_enrollment",
      entityId: "batch",
      metadata: { prepared: result.prepared, failed: result.failed.length, excluded: result.excludedCount },
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

export default router;
