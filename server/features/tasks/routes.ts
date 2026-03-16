import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as taskStorage from "./storage";
import { addLeadNote } from "../crm/storage";
import { addActivity } from "../pipeline/storage";

const router = Router();

function parseDueDate(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(raw + "T00:00:00Z");
  }
  return new Date(raw);
}

const createTaskSchema = z.object({
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  dueDate: z.string().min(1),
  followUpTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  followUpTimezone: z.string().optional().nullable(),
  opportunityId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().min(1).optional(),
  followUpTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  followUpTimezone: z.string().optional().nullable(),
  completed: z.boolean().optional(),
}).strict();

router.get("/due-today", requireRole("admin", "sales_rep", "developer"), async (_req, res) => {
  try {
    const [dueTodayTasks, overdueTasks] = await Promise.all([
      taskStorage.getTasksDueToday(),
      taskStorage.getOverdueTasks(),
    ]);
    res.json({ dueToday: dueTodayTasks, overdue: overdueTasks });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/for-opportunity/:id", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksForOpportunity(req.params.id as string);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/for-lead/:id", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksForLead(req.params.id as string);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const validated = createTaskSchema.parse(req.body);
    const parsedDueDate = parseDueDate(validated.dueDate);
    const actorId = req.authUser?.id ?? null;

    const existing = await taskStorage.getActiveTaskForContext(validated.leadId, validated.opportunityId);

    if (existing) {
      const task = await taskStorage.updateTask(existing.id, {
        title: validated.title,
        dueDate: parsedDueDate,
        followUpTime: validated.followUpTime ?? null,
        followUpTimezone: validated.followUpTimezone ?? null,
        notes: validated.notes ?? null,
      });
      await logAudit({
        userId: req.authUser?.id,
        action: "update",
        entity: "followup_task",
        entityId: task.id,
        metadata: { action: "rescheduled", title: task.title, dueDate: task.dueDate },
        ipAddress: req.ip,
      });
      const rescheduleContent = `Follow-up rescheduled: ${task.title}`;
      if (task.leadId) addLeadNote({ leadId: task.leadId, userId: actorId, type: "task", content: rescheduleContent }).catch(() => {});
      else if (task.opportunityId) addActivity({ opportunityId: task.opportunityId, userId: actorId, type: "task", content: rescheduleContent }).catch(() => {});
      return res.status(200).json(task);
    }

    const task = await taskStorage.createTask({
      ...validated,
      dueDate: parsedDueDate,
      createdBy: req.authUser?.id,
      completed: false,
    });
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "followup_task",
      entityId: task.id,
      metadata: { title: task.title, dueDate: task.dueDate },
      ipAddress: req.ip,
    });
    const scheduleContent = `Follow-up scheduled: ${task.title}`;
    if (task.leadId) addLeadNote({ leadId: task.leadId, userId: actorId, type: "task", content: scheduleContent }).catch(() => {});
    else if (task.opportunityId) addActivity({ opportunityId: task.opportunityId, userId: actorId, type: "task", content: scheduleContent }).catch(() => {});

    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

const ALLOWED_OUTCOMES = [
  "No answer", "Left voicemail", "Spoke with lead", "Interested",
  "Not interested", "Bad number", "Appointment set", "Duplicate lead",
] as const;

const completeTaskSchema = z.object({
  outcome: z.enum(ALLOWED_OUTCOMES).optional(),
  completionNote: z.string().optional(),
}).optional();

router.put("/:id/complete", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const body = completeTaskSchema.parse(req.body);
    const task = await taskStorage.completeTask(req.params.id as string, body ?? undefined);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "followup_task",
      entityId: task.id,
      metadata: { action: "completed", title: task.title, outcome: body?.outcome },
      ipAddress: req.ip,
    });

    const actorId = req.authUser?.id ?? null;
    const parts = [`Task completed: ${task.title}`];
    if (body?.outcome) parts.push(`Outcome: ${body.outcome}`);
    if (body?.completionNote) parts.push(`Note: ${body.completionNote}`);
    const completionContent = parts.join(" · ");
    if (task.leadId) addLeadNote({ leadId: task.leadId, userId: actorId, type: "task", content: completionContent }).catch(() => {});
    else if (task.opportunityId) addActivity({ opportunityId: task.opportunityId, userId: actorId, type: "task", content: completionContent }).catch(() => {});

    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const validated = updateTaskSchema.parse(req.body);
    const data: Record<string, unknown> = { ...validated };
    if (validated.dueDate) data.dueDate = parseDueDate(validated.dueDate);
    if (validated.completed === false) data.completedAt = null;
    const task = await taskStorage.updateTask(req.params.id as string, data as any);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "followup_task",
      entityId: task.id,
      metadata: { title: task.title },
      ipAddress: req.ip,
    });
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    await taskStorage.deleteTask(req.params.id as string);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "followup_task",
      entityId: req.params.id as string,
      ipAddress: req.ip,
    });
    res.json({ message: "Task deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
