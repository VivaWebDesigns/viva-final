import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { getOverdueSummary } from "./overdue";
import { getJobsByStatus, getAllRecentJobs, requeueJob } from "./queue";

const router = Router();

router.get("/overdue-summary", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const summary = await getOverdueSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// ── Workflow Job Admin Endpoints ──────────────────────────────────────

/**
 * GET /api/workflow/jobs
 * List workflow jobs. Optionally filter by status query param.
 * Returns recent jobs (newest first) up to limit=100.
 */
router.get("/jobs", requireRole("admin", "developer"), async (req, res) => {
  try {
    const { status } = req.query as { status?: string };
    const validStatuses = ["pending", "processing", "completed", "failed", "retry_scheduled"];

    if (status && validStatuses.includes(status)) {
      const jobs = await getJobsByStatus(status as any, 100);
      return res.json({ jobs, total: jobs.length, status });
    }

    const jobs = await getAllRecentJobs(100);
    return res.json({ jobs, total: jobs.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/workflow/jobs/failed
 * List dead-letter jobs for support triage.
 */
router.get("/jobs/failed", requireRole("admin", "developer"), async (req, res) => {
  try {
    const jobs = await getJobsByStatus("failed", 100);
    res.json({ jobs, total: jobs.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/workflow/jobs/:id/retry
 * Manually requeue a dead-letter or failed job back to pending.
 */
router.post("/jobs/:id/retry", requireRole("admin", "developer"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const job = await requeueJob(id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json({ message: "Job requeued", job });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
