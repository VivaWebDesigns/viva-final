import { Router } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as taskStorage from "./storage";
import { addLeadNote } from "../crm/storage";
import { addActivity, bulkAssignOpportunitiesByLeadIds, getStages, moveOpportunity } from "../pipeline/storage";
import { db } from "../../db";
import { crmLeads, pipelineOpportunities, followupTasks, automationExecutionLogs, clientNotes, type FollowupTask } from "@shared/schema";

const router = Router();

function scopedTaskOwnerId(req: { authUser?: { id?: string; role?: string } }): string | undefined {
  return req.authUser?.role === "sales_rep" ? req.authUser.id : undefined;
}

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
  taskType: z.string().optional().nullable(),
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

router.get("/due-today", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const ownerId = scopedTaskOwnerId(req);
    const [dueTodayTasks, overdueTasks, upcomingTasks] = await Promise.all([
      taskStorage.getTasksDueToday(ownerId),
      taskStorage.getOverdueTasks(ownerId),
      taskStorage.getUpcomingTasks(ownerId),
    ]);
    res.json({ dueToday: dueTodayTasks, overdue: overdueTasks, upcoming: upcomingTasks });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/completed-history", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const tasks = await taskStorage.getCompletedTaskHistory(limit, scopedTaskOwnerId(req));
    res.json(tasks);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ message });
  }
});

router.get("/for-opportunity/:id", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksForOpportunity(req.params.id as string, scopedTaskOwnerId(req));
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/for-lead/:id", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksForLead(req.params.id as string, scopedTaskOwnerId(req));
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

    // Before creating / rescheduling, auto-complete all currently-open tasks for this opportunity
    if (validated.opportunityId) {
      try {
        const closed = await db.update(followupTasks)
          .set({ completed: true, completedAt: new Date() })
          .where(and(
            eq(followupTasks.opportunityId, validated.opportunityId),
            eq(followupTasks.completed, false),
          ))
          .returning({ id: followupTasks.id });
        if (closed.length > 0) {
          console.log(`[tasks] Auto-completed ${closed.length} open task(s) before creating new task for opportunity ${validated.opportunityId}`);
        }
      } catch (err) {
        console.error("[tasks] Failed to auto-complete existing tasks:", err);
      }
    }

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
  "Payment received", "Still waiting", "Won't pay",
] as const;

const OUTCOME_VALUE_TO_KEY: Record<string, string> = {
  "No answer":        "noAnswer",
  "Left voicemail":   "leftVoicemail",
  "Spoke with lead":  "spokeWithLead",
  "Interested":       "interested",
  "Uncertain":        "uncertain",
  "Not interested":   "notInterested",
  "Bad number":       "badNumber",
  "Appointment set":  "appointmentSet",
  "Payment received": "paymentReceived",
  "Still waiting":    "stillWaiting",
  "Won't pay":        "wontPay",
};

const OUTCOME_STAGE_SLUG: Partial<Record<string, string>> = {
  "Not interested": "closed-lost",
  "Bad number":     "closed-lost",
  "Appointment set":"demo-scheduled",
};

const RECYCLE_FAILED_CONTACT_THRESHOLD = 3;
const AUTO_FOLLOWUP_OUTCOMES = new Set(["No answer", "Left voicemail"]);
const CONTACT_STREAK_RESET_OUTCOMES = new Set<string>(
  ALLOWED_OUTCOMES.filter((outcome) => !AUTO_FOLLOWUP_OUTCOMES.has(outcome)),
);

const completeTaskSchema = z.object({
  outcome: z.enum(ALLOWED_OUTCOMES).optional(),
  completionNote: z.string().optional(),
  demoDate: z.string().optional(),
}).optional();

async function resolveTaskLeadId(task: Pick<FollowupTask, "leadId" | "opportunityId">): Promise<string | null> {
  if (task.leadId) return task.leadId;
  if (!task.opportunityId) return null;

  const [opportunity] = await db
    .select({ leadId: pipelineOpportunities.leadId })
    .from(pipelineOpportunities)
    .where(eq(pipelineOpportunities.id, task.opportunityId))
    .limit(1);
  return opportunity?.leadId ?? null;
}

async function applyLeadContactOutcome(
  task: Pick<FollowupTask, "leadId" | "opportunityId">,
  outcome: string | undefined,
  actorId: string | null,
  ipAddress: string | undefined,
): Promise<{ leadId: string | null; recycled: boolean; recycleCount: number }> {
  if (!outcome || (!AUTO_FOLLOWUP_OUTCOMES.has(outcome) && !CONTACT_STREAK_RESET_OUTCOMES.has(outcome))) {
    return { leadId: null, recycled: false, recycleCount: 0 };
  }

  const leadId = await resolveTaskLeadId(task);
  if (!leadId) return { leadId: null, recycled: false, recycleCount: 0 };

  const [lead] = await db
    .select({
      title: crmLeads.title,
      unansweredCallStreak: crmLeads.unansweredCallStreak,
      recycleCount: crmLeads.recycleCount,
    })
    .from(crmLeads)
    .where(eq(crmLeads.id, leadId))
    .limit(1);
  if (!lead) return { leadId, recycled: false, recycleCount: 0 };

  if (AUTO_FOLLOWUP_OUTCOMES.has(outcome)) {
    const nextStreak = lead.unansweredCallStreak + 1;
    if (nextStreak < RECYCLE_FAILED_CONTACT_THRESHOLD) {
      await db
        .update(crmLeads)
        .set({ unansweredCallStreak: nextStreak, updatedAt: new Date() })
        .where(eq(crmLeads.id, leadId));
      return { leadId, recycled: false, recycleCount: lead.recycleCount };
    }

    const recycledAt = new Date();
    const nextRecycleCount = lead.recycleCount + 1;
    const [updatedLead] = await db
      .update(crmLeads)
      .set({
        assignedTo: null,
        unansweredCallStreak: 0,
        recycleCount: nextRecycleCount,
        lastRecycledAt: recycledAt,
        updatedAt: recycledAt,
      })
      .where(eq(crmLeads.id, leadId))
      .returning({ recycleCount: crmLeads.recycleCount });

    await Promise.all([
      bulkAssignOpportunitiesByLeadIds([leadId], null),
      taskStorage.syncOpenTaskOwnershipForLeadIds([leadId], null),
    ]);

    const recycleCount = updatedLead?.recycleCount ?? nextRecycleCount;
    await logAudit({
      userId: actorId ?? undefined,
      action: "update",
      entity: "crm_lead",
      entityId: leadId,
      metadata: {
        action: "auto_recycled",
        title: lead.title,
        outcome,
        failedContactThreshold: RECYCLE_FAILED_CONTACT_THRESHOLD,
        recycleCount,
      },
      ipAddress,
    });
    addLeadNote({
      leadId,
      userId: actorId,
      type: "system",
      content: `Lead recycled after ${RECYCLE_FAILED_CONTACT_THRESHOLD} failed contact attempts.`,
      metadata: {
        event: "lead_recycled",
        outcome,
        failedContactThreshold: RECYCLE_FAILED_CONTACT_THRESHOLD,
        recycleCount,
      },
    }).catch(() => {});

    return { leadId, recycled: true, recycleCount };
  }

  if (lead.unansweredCallStreak > 0) {
    await db
      .update(crmLeads)
      .set({ unansweredCallStreak: 0, updatedAt: new Date() })
      .where(eq(crmLeads.id, leadId));
  }

  return { leadId, recycled: false, recycleCount: lead.recycleCount };
}

router.put("/:id/complete", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const body = completeTaskSchema.parse(req.body);
    const existingTask = await taskStorage.getTaskById(req.params.id as string);
    if (!existingTask) return res.status(404).json({ message: "Task not found" });
    if (existingTask.completed) return res.json(existingTask);

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

    if (body?.completionNote) {
      const companyId = await resolveCompanyId(task.companyId, task.leadId, task.opportunityId);
      if (companyId) {
        try {
          await db.insert(clientNotes).values({
            companyId,
            userId: actorId,
            type: "call",
            content: body.completionNote,
            isPinned: false,
          });
        } catch (err: unknown) {
          console.error("[tasks/complete] client note creation failed:", err);
        }
      }
    }

    const recycleResult = await applyLeadContactOutcome(task, body?.outcome, actorId, req.ip);

    if (body?.outcome && task.opportunityId) {
      const targetSlug = OUTCOME_STAGE_SLUG[body.outcome];
      if (targetSlug) {
        const stages = await getStages();
        const stage = stages.find(s => s.slug === targetSlug);
        if (stage) await moveOpportunity(task.opportunityId!, stage.id, actorId ?? undefined).catch(() => {});
      }

      if (body.outcome === "Appointment set") {
        let demoTaskDue: Date;
        if (body.demoDate && /^\d{4}-\d{2}-\d{2}$/.test(body.demoDate)) {
          demoTaskDue = new Date(body.demoDate + "T00:00:00Z");
        } else {
          demoTaskDue = new Date();
          demoTaskDue.setUTCDate(demoTaskDue.getUTCDate() + 1);
          demoTaskDue.setUTCHours(0, 0, 0, 0);
        }
        try {
          const demoTask = await taskStorage.createTask({
            title: "Record demo outcome",
            taskType: "demo_outcome",
            dueDate: demoTaskDue,
            completed: false,
            assignedTo: task.assignedTo,
            opportunityId: task.opportunityId,
            leadId: task.leadId,
            contactId: task.contactId,
            companyId: task.companyId,
            createdBy: actorId,
          });
          const demoTaskContent = `Demo outcome task created: ${demoTask.title}`;
          const demoTaskMeta = { event: "demo_outcome_task_created", taskTitle: demoTask.title };
          if (demoTask.leadId) addLeadNote({ leadId: demoTask.leadId, userId: actorId, type: "task", content: demoTaskContent, metadata: demoTaskMeta }).catch(() => {});
          else if (demoTask.opportunityId) addActivity({ opportunityId: demoTask.opportunityId, userId: actorId, type: "task", content: demoTaskContent, metadata: demoTaskMeta }).catch(() => {});
        } catch (err: unknown) {
          console.error("[tasks/complete] demo_outcome task creation failed:", err);
        }
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
            assignedTo: recycleResult.recycled ? null : task.assignedTo,
            opportunityId: task.opportunityId,
            leadId: task.leadId ?? recycleResult.leadId,
            contactId: task.contactId,
            companyId: task.companyId,
            createdBy: actorId,
          });
          const scheduleContent = `Follow-up scheduled: ${newTask.title}`;
          const scheduleMeta = { event: "follow_up_scheduled", taskTitle: newTask.title };
          if (newTask.leadId) addLeadNote({ leadId: newTask.leadId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
          else if (newTask.opportunityId) addActivity({ opportunityId: newTask.opportunityId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
        } catch (err: unknown) {
          console.error("[tasks/complete] auto-follow-up creation failed:", err);
        }
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
    if (validated.completed === true) data.completedAt = new Date();
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
    const taskId = req.params.id as string;
    // Clear any automation execution log references before deleting (FK constraint)
    await db.update(automationExecutionLogs)
      .set({ generatedTaskId: null })
      .where(eq(automationExecutionLogs.generatedTaskId, taskId));
    await taskStorage.deleteTask(taskId);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "followup_task",
      entityId: taskId,
      ipAddress: req.ip,
    });
    res.json({ message: "Task deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
