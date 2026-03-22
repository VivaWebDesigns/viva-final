import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { AUTOMATION_TRIGGER_STAGES, AUTOMATION_PRIORITIES } from "@shared/schema";
import * as automationStorage from "./storage";

const router = Router();

const triggerStageEnum = z.enum(AUTOMATION_TRIGGER_STAGES as unknown as [string, ...string[]]);
const priorityEnum = z.enum(AUTOMATION_PRIORITIES as unknown as [string, ...string[]]);

const createTemplateSchema = z.object({
  triggerStageSlug: triggerStageEnum,
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  dueOffsetDays: z.number().int().min(0).default(0),
  priority: priorityEnum.default("medium"),
  taskType: z.string().min(1).default("follow_up"),
  isActive: z.boolean().default(true),
});

const updateTemplateSchema = z.object({
  triggerStageSlug: triggerStageEnum.optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueOffsetDays: z.number().int().min(0).optional(),
  priority: priorityEnum.optional(),
  taskType: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const reorderSchema = z.object({
  stageSlug: triggerStageEnum,
  orderedIds: z.array(z.string().min(1)),
});

router.get("/templates", requireRole("admin"), async (_req, res) => {
  try {
    const templates = await automationStorage.listTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/templates/stage/:slug", requireRole("admin"), async (req, res) => {
  try {
    const templates = await automationStorage.listTemplatesByStage(req.params.slug);
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/templates/reorder", requireRole("admin"), async (req, res) => {
  try {
    const validated = reorderSchema.parse(req.body);
    await automationStorage.reorderTemplates(validated.stageSlug, validated.orderedIds);
    res.json({ message: "Templates reordered" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/templates/:id", requireRole("admin"), async (req, res) => {
  try {
    const template = await automationStorage.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/templates", requireRole("admin"), async (req, res) => {
  try {
    const validated = createTemplateSchema.parse(req.body);
    const maxSort = await automationStorage.getMaxSortOrder(validated.triggerStageSlug);
    const template = await automationStorage.createTemplate({
      ...validated,
      sortOrder: maxSort + 1,
      createdBy: req.authUser?.id ?? null,
      updatedBy: req.authUser?.id ?? null,
    });
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "stage_automation_template",
      entityId: template.id,
      metadata: { title: template.title, triggerStageSlug: template.triggerStageSlug },
      ipAddress: req.ip,
    });
    res.status(201).json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/templates/:id", requireRole("admin"), async (req, res) => {
  try {
    const existing = await automationStorage.getTemplateById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    const validated = updateTemplateSchema.parse(req.body);
    const template = await automationStorage.updateTemplate(req.params.id, {
      ...validated,
      updatedBy: req.authUser?.id ?? null,
    });
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "stage_automation_template",
      entityId: template.id,
      metadata: { title: template.title, changes: validated },
      ipAddress: req.ip,
    });
    res.json(template);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/templates/:id", requireRole("admin"), async (req, res) => {
  try {
    const existing = await automationStorage.getTemplateById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    await automationStorage.deleteTemplate(req.params.id);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "stage_automation_template",
      entityId: req.params.id,
      metadata: { title: existing.title, triggerStageSlug: existing.triggerStageSlug },
      ipAddress: req.ip,
    });
    res.json({ message: "Template deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/execution-logs", requireRole("admin"), async (req, res) => {
  try {
    const rawLimit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const limit = rawLimit && !isNaN(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : undefined;
    const logs = await automationStorage.getExecutionLogs({
      leadId: req.query.leadId as string | undefined,
      opportunityId: req.query.opportunityId as string | undefined,
      triggerStageSlug: req.query.stageSlug as string | undefined,
      status: req.query.status as string | undefined,
      since: req.query.since ? new Date(req.query.since as string) : undefined,
      until: req.query.until ? new Date(req.query.until as string) : undefined,
      limit,
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/stats/stage-counts", requireRole("admin"), async (_req, res) => {
  try {
    const counts = await automationStorage.getTemplateStageCounts();
    res.json(counts);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
