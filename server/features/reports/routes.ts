import { Router } from "express";
import { requireRole } from "../auth/middleware";
import * as reportService from "./service";

const router = Router();

function parseDateRange(query: any) {
  const { days, from, to } = query;
  if (days) {
    const d = parseInt(days as string);
    if (!isNaN(d) && d > 0) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - d);
      return { from: fromDate };
    }
  }
  const range: { from?: Date; to?: Date } = {};
  if (from) range.from = new Date(from as string);
  if (to) range.to = new Date(to as string);
  return (range.from || range.to) ? range : undefined;
}

router.get("/leads-by-source", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getLeadsBySource(parseDateRange(req.query));
  res.json(data);
});

router.get("/leads-by-status", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getLeadsByStatus(parseDateRange(req.query));
  res.json(data);
});

router.get("/lead-conversion", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getLeadConversionRate(parseDateRange(req.query));
  res.json(data);
});

router.get("/leads-trend", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const days = parseInt(req.query.days as string) || 30;
  const data = await reportService.getLeadsTrend(days);
  res.json(data);
});

router.get("/pipeline-breakdown", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getPipelineBreakdown(parseDateRange(req.query));
  res.json(data);
});

router.get("/won-lost", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getWonLostBreakdown(parseDateRange(req.query));
  res.json(data);
});

router.get("/onboarding-breakdown", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getOnboardingBreakdown(parseDateRange(req.query));
  res.json(data);
});

router.get("/notification-summary", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getNotificationSummary(parseDateRange(req.query));
  res.json(data);
});

router.get("/overview", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const data = await reportService.getOverview(parseDateRange(req.query));
  res.json(data);
});

export default router;
