import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { notifyStageChange, notifyOpportunityAssignment } from "../notifications/triggers";
import * as pipelineStorage from "./storage";
import { insertPipelineStageSchema, insertPipelineOpportunitySchema, insertPipelineActivitySchema, OPPORTUNITY_STATUSES, type InsertPipelineOpportunity } from "@shared/schema";
import { z } from "zod";

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  isClosed: z.boolean().optional(),
}).strict();

const updateOpportunitySchema = z.object({
  title: z.string().min(1).optional(),
  value: z.string().nullable().optional(),
  stageId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  expectedCloseDate: z.string().nullable().optional(),
  nextActionDate: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const router = Router();

router.get("/stages", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  const stages = await pipelineStorage.getStages();
  res.json(stages);
});

router.post("/stages", requireRole("admin", "developer"), async (req, res) => {
  try {
    const data = insertPipelineStageSchema.parse(req.body);
    const stage = await pipelineStorage.createStage(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "pipeline_stage",
      entityId: stage.id,
      metadata: { name: stage.name },
      ipAddress: req.ip,
    });
    res.status(201).json(stage);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/stages/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const existing = await pipelineStorage.getStageById(id);
    if (!existing) return res.status(404).json({ message: "Stage not found" });
    const validated = updateStageSchema.parse(req.body);
    const stage = await pipelineStorage.updateStage(id, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "pipeline_stage",
      entityId: stage.id,
      metadata: { name: stage.name },
      ipAddress: req.ip,
    });
    res.json(stage);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/stages/:id", requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const existing = await pipelineStorage.getStageById(id);
    if (!existing) return res.status(404).json({ message: "Stage not found" });
    await pipelineStorage.clearStageFromOpportunities(id);
    await pipelineStorage.deleteStage(id);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "pipeline_stage",
      entityId: id,
      metadata: { name: existing.name },
      ipAddress: req.ip,
    });
    res.json({ message: "Stage deleted" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/opportunities", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { search, stageId, assignedTo, status, page, limit } = req.query;
    const result = await pipelineStorage.getOpportunities({
      search: search as string | undefined,
      stageId: stageId as string | undefined,
      assignedTo: assignedTo as string | undefined,
      status: status as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/opportunities/board", requireRole("admin", "sales_rep"), async (_req, res) => {
  try {
    const result = await pipelineStorage.getOpportunitiesByStage();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/opportunities/stats", requireRole("admin", "sales_rep"), async (_req, res) => {
  try {
    const stats = await pipelineStorage.getPipelineStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/opportunities", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertPipelineOpportunitySchema.parse(req.body);
    const opportunity = await pipelineStorage.createOpportunity(data);
    await pipelineStorage.addActivity({
      opportunityId: opportunity.id,
      userId: req.authUser?.id || null,
      type: "system",
      content: "Opportunity created",
    });
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "pipeline_opportunity",
      entityId: opportunity.id,
      metadata: { title: opportunity.title },
      ipAddress: req.ip,
    });
    res.status(201).json(opportunity);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/opportunities/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  const opp = await pipelineStorage.getOpportunityById(req.params.id as string);
  if (!opp) return res.status(404).json({ message: "Opportunity not found" });
  res.json(opp);
});

router.put("/opportunities/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const existing = await pipelineStorage.getOpportunityById(id);
    if (!existing) return res.status(404).json({ message: "Opportunity not found" });
    const validated = updateOpportunitySchema.parse(req.body);
    const opp = await pipelineStorage.updateOpportunity(id, validated as Partial<InsertPipelineOpportunity>);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "pipeline_opportunity",
      entityId: opp.id,
      metadata: { title: opp.title },
      ipAddress: req.ip,
    });
    if (validated.assignedTo && validated.assignedTo !== existing.assignedTo) {
      try { notifyOpportunityAssignment({ id: opp.id, title: opp.title }, validated.assignedTo); } catch (_) {}
    }
    res.json(opp);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/opportunities/:id/stage", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { stageId } = req.body;
    if (!stageId) return res.status(400).json({ message: "stageId is required" });
    const result = await pipelineStorage.moveOpportunity(id, stageId, req.authUser?.id);
    await logAudit({
      userId: req.authUser?.id,
      action: "stage_change",
      entity: "pipeline_opportunity",
      entityId: id,
      // PipelineActivity.metadata is untyped jsonb (unknown); logAudit expects Json.
      // Both are the same jsonb column at runtime — this cast is safe.
      metadata: result.activity.metadata as Record<string, unknown> | null | undefined,
      ipAddress: req.ip,
    });
    const meta = result.activity.metadata as Record<string, unknown> | null | undefined;
    if (meta?.fromStage && meta?.toStage) {
      try { notifyStageChange({ id, title: result.opportunity.title, ownerId: result.opportunity.assignedTo }, meta.fromStage as string, meta.toStage as string); } catch (_) {}
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/opportunities/:id/activities", requireRole("admin", "sales_rep"), async (req, res) => {
  const activities = await pipelineStorage.getActivities(req.params.id as string);
  res.json(activities);
});

router.post("/opportunities/:id/activities", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const existing = await pipelineStorage.getOpportunityById(id);
    if (!existing) return res.status(404).json({ message: "Opportunity not found" });
    const data = insertPipelineActivitySchema.parse({
      ...req.body,
      opportunityId: id,
      userId: req.authUser?.id || null,
    });
    const activity = await pipelineStorage.addActivity(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "pipeline_activity",
      entityId: activity.id,
      metadata: { opportunityId: id, type: activity.type },
      ipAddress: req.ip,
    });
    res.status(201).json(activity);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/convert-lead/:leadId", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { leadId } = req.params as Record<string, string>;
    const { stageId, ...extraData } = req.body;
    if (!stageId) return res.status(400).json({ message: "stageId is required" });
    const targetStage = await pipelineStorage.getStageById(stageId);
    if (!targetStage) return res.status(400).json({ message: "Invalid stage" });
    if (targetStage.isClosed) return res.status(400).json({ message: "Cannot convert to a closed stage" });
    const opportunity = await pipelineStorage.convertLeadToOpportunity(
      leadId, stageId, req.authUser?.id, extraData
    );
    await logAudit({
      userId: req.authUser?.id,
      action: "convert_lead",
      entity: "pipeline_opportunity",
      entityId: opportunity.id,
      metadata: { leadId, title: opportunity.title },
      ipAddress: req.ip,
    });
    res.status(201).json(opportunity);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
