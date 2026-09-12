import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { assertSafePublicUrl, normalizePublicUrl, UnsafeUrlError } from "./url-safety";
import { SCAN_LIMITS } from "./constants";
import { countActiveScans, countRecentScans, createScan, deleteCompanyScans, getScan, listScanCompanies, listScans, requestCancellation, retryScan } from "./repository";
import { normalizeTechnicalSeoResult } from "@shared/technicalSeoScoring";

const router = Router();
router.use(requireRole("admin", "developer"));

router.post("/scans", async (req, res) => {
  try {
    const input = z.object({
      url: z.string().trim().min(1).max(2048),
      businessName: z.string().trim().min(1).max(160),
      trade: z.string().trim().min(1).max(160),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(1).max(100),
      address: z.string().trim().max(240).optional().default(""),
      phone: z.string().trim().max(40).optional().default(""),
      googleBusinessUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).optional().default(""),
      targetServices: z.array(z.string().trim().min(1).max(100)).max(12).optional().default([]),
      serviceAreas: z.array(z.string().trim().min(1).max(100)).max(20).optional().default([]),
    }).parse(req.body);
    const { url, ...auditContext } = input;
    const normalizedUrl = normalizePublicUrl(url);
    await assertSafePublicUrl(normalizedUrl);
    const active = await countActiveScans(req.authUser!.id);
    if (active >= SCAN_LIMITS.maxActiveScansPerUser) return res.status(429).json({ message: `You may have at most ${SCAN_LIMITS.maxActiveScansPerUser} active scans.` });
    const recent = await countRecentScans(req.authUser!.id, new Date(Date.now() - 10 * 60 * 1000));
    if (recent >= SCAN_LIMITS.maxScansPerTenMinutes) return res.status(429).json({ message: `You may start at most ${SCAN_LIMITS.maxScansPerTenMinutes} scans every 10 minutes.` });
    const scan = await createScan(url, normalizedUrl, req.authUser!.id, auditContext);
    return res.status(202).json(scan);
  } catch (error) {
    if (error instanceof UnsafeUrlError) return res.status(400).json({ message: error.message });
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid URL" });
    return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to create scan" });
  }
});

router.get("/scans", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  res.json({ scans: await listScans(limit) });
});

router.get("/scan-companies", async (_req, res) => {
  res.json({ companies: await listScanCompanies() });
});

router.delete("/scan-companies", async (req, res) => {
  try {
    const { businessName } = z.object({ businessName: z.string().trim().min(1).max(160) }).parse(req.body);
    const result = await deleteCompanyScans(businessName);
    if (result.activeCount > 0) return res.status(409).json({ message: "Wait for this company's active scans to finish or cancel them before deleting its history." });
    if (result.deletedCount === 0) return res.status(404).json({ message: "No scan history was found for this company." });
    return res.json({ businessName, deletedCount: result.deletedCount });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid company name" });
    return res.status(500).json({ message: error instanceof Error ? error.message : "Unable to delete scan history" });
  }
});

router.get("/scans/:id", async (req, res) => {
  const scan = await getScan(req.params.id);
  if (!scan) return res.status(404).json({ message: "Scan not found" });
  res.json(scan.result ? { ...scan, result: normalizeTechnicalSeoResult(scan.result) } : scan);
});

router.post("/scans/:id/cancel", async (req, res) => {
  const scan = await requestCancellation(req.params.id);
  if (!scan) return res.status(404).json({ message: "Active scan not found" });
  res.json(scan);
});

router.post("/scans/:id/retry", async (req, res) => {
  const scan = await retryScan(req.params.id);
  if (!scan) return res.status(409).json({ message: "Only failed or cancelled scans can be retried" });
  res.json(scan);
});

export default router;
