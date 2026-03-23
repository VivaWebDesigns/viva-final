import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as taskStorage from "./storage";
import { addLeadNote } from "../crm/storage";
import { addActivity, getStages, moveOpportunity } from "../pipeline/storage";
import { db } from "../../db";
import { crmLeads, pipelineOpportunities, followupTasks } from "@shared/schema";

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
  companyId: z.string().nullable().optional(),
});

async function resolveCompanyId(
  companyId: string | null | undefined,
  leadId: string | null | undefined,
  opportunityId: string | null | undefined,
): Promise<string | null> {
  if (companyId) return companyId;

  if (leadId) {
    const [lead] = await db
      .select({ companyId: crmLeads.companyId })
      .from(crmLeads)
      .where(eq(crmLeads.id, leadId))
      .limit(1);
    if (lead?.companyId) return lead.companyId;
  }

  if (opportunityId) {
    const [opp] = await db
      .select({ companyId: pipelineOpportunities.companyId })
      .from(pipelineOpportunities)
      .where(eq(pipelineOpportunities.id, opportunityId))
      .limit(1);
    if (opp?.companyId) return opp.companyId;
  }

  return null;
}

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
    const [dueTodayTasks, overdueTasks, upcomingTasks] = await Promise.all([
      taskStorage.getTasksDueToday(),
      taskStorage.getOverdueTasks(),
      taskStorage.getUpcomingTasks(),
    ]);
    res.json({ dueToday: dueTodayTasks, overdue: overdueTasks, upcoming: upcomingTasks });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/completed-history", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const tasks = await taskStorage.getCompletedTaskHistory(limit);
    res.json(tasks);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
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
      const rescheduleMeta = { event: "follow_up_rescheduled", taskTitle: task.title };
      if (task.leadId) addLeadNote({ leadId: task.leadId, userId: actorId, type: "task", content: rescheduleContent, metadata: rescheduleMeta }).catch(() => {});
      else if (task.opportunityId) addActivity({ opportunityId: task.opportunityId, userId: actorId, type: "task", content: rescheduleContent, metadata: rescheduleMeta }).catch(() => {});
      return res.status(200).json(task);
    }

    const resolvedCompanyId = await resolveCompanyId(validated.companyId, validated.leadId, validated.opportunityId);

    const task = await taskStorage.createTask({
      ...validated,
      companyId: resolvedCompanyId,
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
    const scheduleMeta = { event: "follow_up_scheduled", taskTitle: task.title };
    if (task.leadId) addLeadNote({ leadId: task.leadId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
    else if (task.opportunityId) addActivity({ opportunityId: task.opportunityId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});

    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

const ALLOWED_OUTCOMES = [
  "No answer", "Left voicemail", "Spoke with lead",
  "Interested", "Uncertain", "Not interested",
  "Bad number", "Appointment set",
] as const;

const OUTCOME_VALUE_TO_KEY: Record<string, string> = {
  "No answer":       "noAnswer",
  "Left voicemail":  "leftVoicemail",
  "Spoke with lead": "spokeWithLead",
  "Interested":      "interested",
  "Uncertain":       "uncertain",
  "Not interested":  "notInterested",
  "Bad number":      "badNumber",
  "Appointment set": "appointmentSet",
};

const OUTCOME_STAGE_SLUG: Partial<Record<string, string>> = {
  "Not interested": "closed-lost",
  "Bad number":     "closed-lost",
  "Appointment set":"demo-scheduled",
};

const AUTO_FOLLOWUP_OUTCOMES = new Set(["No answer", "Left voicemail"]);

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
    const completionMeta = {
      event: "task_completed",
      taskTitle: task.title,
      outcome: body?.outcome,
      outcomeKey: body?.outcome ? OUTCOME_VALUE_TO_KEY[body.outcome] : undefined,
      completionNote: body?.completionNote,
    };
    if (task.leadId) addLeadNote({ leadId: task.leadId, userId: actorId, type: "task", content: completionContent, metadata: completionMeta }).catch(() => {});
    else if (task.opportunityId) addActivity({ opportunityId: task.opportunityId, userId: actorId, type: "task", content: completionContent, metadata: completionMeta }).catch(() => {});

    if (body?.outcome && task.opportunityId) {
      const targetSlug = OUTCOME_STAGE_SLUG[body.outcome];
      if (targetSlug) {
        const stages = await getStages();
        const stage = stages.find(s => s.slug === targetSlug);
        if (stage) await moveOpportunity(task.opportunityId!, stage.id, actorId ?? undefined).catch(() => {});
      }
    }

    if (body?.outcome && AUTO_FOLLOWUP_OUTCOMES.has(body.outcome)) {
      const hasExisting = await taskStorage.getActiveTaskForContext(task.leadId, task.opportunityId);
      if (!hasExisting) {
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(0, 0, 0, 0);
        const followupTitle = task.title;
        try {
          const newTask = await taskStorage.createTask({
            title: followupTitle,
            taskType: task.taskType,
            dueDate: tomorrow,
            completed: false,
            assignedTo: task.assignedTo,
            opportunityId: task.opportunityId,
            leadId: task.leadId,
            contactId: task.contactId,
            companyId: task.companyId,
            createdBy: actorId,
          });
          const scheduleContent = `Follow-up scheduled: ${newTask.title}`;
          const scheduleMeta = { event: "follow_up_scheduled", taskTitle: newTask.title };
          if (newTask.leadId) addLeadNote({ leadId: newTask.leadId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
          else if (newTask.opportunityId) addActivity({ opportunityId: newTask.opportunityId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
        } catch (_) {}
      }
    }

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
