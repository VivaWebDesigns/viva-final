import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { AUTOMATION_TRIGGER_STAGES, AUTOMATION_PRIORITIES, AUTOMATION_EXEC_STATUSES } from "@shared/schema";
import * as automationStorage from "./storage";

const VALID_STATUSES = new Set(AUTOMATION_EXEC_STATUSES as readonly string[]);
const VALID_STAGE_SLUGS = new Set(AUTOMATION_TRIGGER_STAGES as readonly string[]);

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
    const slug = req.params.slug as string;
    const templates = await automationStorage.listTemplatesByStage(slug);
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
    const id = req.params.id as string;
    const template = await automationStorage.getTemplateById(id);
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
    const id = req.params.id as string;
    const existing = await automationStorage.getTemplateById(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    const validated = updateTemplateSchema.parse(req.body);
    const template = await automationStorage.updateTemplate(id, {
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
    const id = req.params.id as string;
    const existing = await automationStorage.getTemplateById(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    await automationStorage.deleteTemplate(id);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "stage_automation_template",
      entityId: id,
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
    const rawStatus = req.query.status as string | undefined;
    const rawStage = req.query.stageSlug as string | undefined;
    const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
    const triggerStageSlug = rawStage && VALID_STAGE_SLUGS.has(rawStage) ? rawStage : undefined;
    const sinceDate = req.query.since ? new Date(req.query.since as string) : undefined;
    const untilDate = req.query.until ? new Date(req.query.until as string) : undefined;

    const logs = await automationStorage.getExecutionLogs({
      leadId: req.query.leadId as string | undefined,
      opportunityId: req.query.opportunityId as string | undefined,
      triggerStageSlug,
      status,
      since: sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate : undefined,
      until: untilDate && !isNaN(untilDate.getTime()) ? untilDate : undefined,
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
