import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as onboardingStorage from "./storage";
import { ONBOARDING_STATUSES, ONBOARDING_NOTE_TYPES, CHECKLIST_CATEGORIES } from "@shared/schema";
import { z } from "zod";

const createRecordSchema = z.object({
  clientName: z.string().min(1),
  status: z.enum(ONBOARDING_STATUSES).optional(),
  opportunityId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  kickoffDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  checklistItems: z.array(z.object({
    category: z.enum(CHECKLIST_CATEGORIES),
    label: z.string(),
    description: z.string().optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().min(0),
    dueDate: z.string().nullable().optional(),
  })).optional(),
}).strict();

const updateRecordSchema = z.object({
  clientName: z.string().min(1).optional(),
  status: z.enum(ONBOARDING_STATUSES).optional(),
  assignedTo: z.string().nullable().optional(),
  kickoffDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const addNoteSchema = z.object({
  type: z.enum(ONBOARDING_NOTE_TYPES).optional(),
  content: z.string().min(1),
  metadata: z.record(z.any()).nullable().optional(),
}).strict();

const router = Router();

router.get("/records", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await onboardingStorage.getRecords({
      status: status as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/records/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const record = await onboardingStorage.getRecordById(req.params.id);
  if (!record) return res.status(404).json({ message: "Onboarding record not found" });
  const [checklist, progress] = await Promise.all([
    onboardingStorage.getChecklistItems(req.params.id),
    onboardingStorage.getProgress(req.params.id),
  ]);
  res.json({ ...record, checklist, progress });
});

router.post("/records", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const validated = createRecordSchema.parse(req.body);
    const { checklistItems, ...recordData } = validated;

    const record = await onboardingStorage.createRecord({
      ...recordData,
      kickoffDate: recordData.kickoffDate ? new Date(recordData.kickoffDate) : null,
      dueDate: recordData.dueDate ? new Date(recordData.dueDate) : null,
    });

    if (checklistItems && checklistItems.length > 0) {
      await onboardingStorage.createChecklistItemsBulk(
        record.id,
        checklistItems.map((item) => ({
          ...item,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
        }))
      );
    } else if (validated.templateId) {
      const template = await onboardingStorage.getTemplateById(validated.templateId);
      if (template && Array.isArray(template.items)) {
        await onboardingStorage.createChecklistItemsBulk(
          record.id,
          (template.items as any[]).map((item: any, idx: number) => ({
            category: item.category,
            label: item.label,
            description: item.description,
            isRequired: item.isRequired !== false,
            sortOrder: idx,
          }))
        );
      }
    }

    await onboardingStorage.addNote({
      onboardingId: record.id,
      userId: req.authUser?.id || null,
      type: "system",
      content: "Onboarding record created",
    });

    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "onboarding_record",
      entityId: record.id,
      details: { clientName: record.clientName },
    });

    res.status(201).json(record);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/records/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const existing = await onboardingStorage.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Onboarding record not found" });

    const validated = updateRecordSchema.parse(req.body);
    const updateData: any = { ...validated };
    if (validated.kickoffDate !== undefined) updateData.kickoffDate = validated.kickoffDate ? new Date(validated.kickoffDate) : null;
    if (validated.dueDate !== undefined) updateData.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    if (validated.completedAt !== undefined) updateData.completedAt = validated.completedAt ? new Date(validated.completedAt) : null;

    if (validated.status && validated.status !== existing.status) {
      if (validated.status === "completed" && !updateData.completedAt) {
        updateData.completedAt = new Date();
      }
      if (validated.status !== "completed") {
        updateData.completedAt = null;
      }

      await onboardingStorage.addNote({
        onboardingId: req.params.id,
        userId: req.authUser?.id || null,
        type: "status_change",
        content: `Status changed from "${existing.status}" to "${validated.status}"`,
        metadata: { from: existing.status, to: validated.status },
      });
    }

    const record = await onboardingStorage.updateRecord(req.params.id, updateData);

    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "onboarding_record",
      entityId: req.params.id,
      details: validated,
    });

    res.json(record);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/records/:id", requireRole("admin"), async (req, res) => {
  try {
    const existing = await onboardingStorage.getRecordById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Onboarding record not found" });

    await onboardingStorage.deleteRecord(req.params.id);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "onboarding_record",
      entityId: req.params.id,
      details: { clientName: existing.clientName },
    });

    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/records/:id/checklist", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const items = await onboardingStorage.getChecklistItems(req.params.id);
  res.json(items);
});

router.put("/records/:id/checklist/:itemId", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const item = await onboardingStorage.toggleChecklistItem(req.params.itemId, req.authUser?.id);

    await onboardingStorage.addNote({
      onboardingId: req.params.id,
      userId: req.authUser?.id || null,
      type: "checklist_update",
      content: `${item.isCompleted ? "Completed" : "Unchecked"}: "${item.label}"`,
      metadata: { itemId: item.id, label: item.label, completed: item.isCompleted },
    });

    res.json(item);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/records/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const notes = await onboardingStorage.getNotes(req.params.id);
  res.json(notes);
});

router.post("/records/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const validated = addNoteSchema.parse(req.body);
    const note = await onboardingStorage.addNote({
      onboardingId: req.params.id,
      userId: req.authUser?.id || null,
      type: validated.type || "note",
      content: validated.content,
      metadata: validated.metadata,
    });
    res.status(201).json(note);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/templates", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  const templates = await onboardingStorage.getTemplates();
  res.json(templates);
});

router.post("/convert-opportunity/:opportunityId", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { templateId, ...extraData } = req.body;

    const record = await onboardingStorage.convertOpportunityToOnboarding(
      opportunityId,
      templateId || null,
      req.authUser?.id,
      extraData
    );

    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "onboarding_record",
      entityId: record.id,
      details: { fromOpportunity: opportunityId, clientName: record.clientName },
    });

    res.status(201).json(record);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/stats", requireRole("admin", "developer", "sales_rep"), async (_req, res) => {
  try {
    const stats = await onboardingStorage.getOnboardingStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
