import { Router } from "express";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as taskStorage from "./storage";
import { isReportOutreachTask, REPORT_OUTREACH_FILTERS, REPORT_OUTREACH_TASKS } from "@shared/reportOutreach";
import { completeReportOutreachTask } from "../crm/reportOutreach";
import { stopInstantlyEnrollment } from "../instantly/enrollment";
import { addLeadNote } from "../crm/storage";
import { addActivity, bulkAssignOpportunitiesByLeadIds, getStages, moveOpportunity } from "../pipeline/storage";
import { db } from "../../db";
import { crmLeads, pipelineOpportunities, followupTasks, automationExecutionLogs, clientNotes, user, type FollowupTask } from "@shared/schema";
import { CALL_BACK_TASK_TITLE, CALL_OUTCOME_STAGE, CALL_TASK_TYPE, DISCOVERY_CALL_TASK_TITLE, isCallTask, isSetterWorkingStage } from "@shared/callPipeline";

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
    const parsedFilters = z.object({
      tagIds: z.union([z.string().min(1), z.array(z.string().min(1)).max(100)]).optional(),
      reportOutreach: z.enum(REPORT_OUTREACH_FILTERS).optional(),
    }).safeParse({ tagIds: req.query.tagIds, reportOutreach: req.query.reportOutreach });
    if (!parsedFilters.success) return res.status(400).json({ message: "Invalid lead filters" });
    const filters = {
      tagIds: typeof parsedFilters.data.tagIds === "string" ? [parsedFilters.data.tagIds] : parsedFilters.data.tagIds,
      reportOutreach: parsedFilters.data.reportOutreach,
    };
    const [dueTodayTasks, overdueTasks, upcomingTasks] = await Promise.all([
      taskStorage.getTasksDueToday(ownerId, filters),
      taskStorage.getOverdueTasks(ownerId, filters),
      taskStorage.getUpcomingTasks(ownerId, filters),
    ]);
    res.json({ dueToday: dueTodayTasks, overdue: overdueTasks, upcoming: upcomingTasks });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/completed-history", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const parsedFilters = z.object({
      tagIds: z.union([z.string().min(1), z.array(z.string().min(1)).max(100)]).optional(),
      reportOutreach: z.enum(REPORT_OUTREACH_FILTERS).optional(),
    }).safeParse({ tagIds: req.query.tagIds, reportOutreach: req.query.reportOutreach });
    if (!parsedFilters.success) return res.status(400).json({ message: "Invalid lead filters" });
    const tasks = await taskStorage.getCompletedTaskHistory(limit, scopedTaskOwnerId(req), {
      tagIds: typeof parsedFilters.data.tagIds === "string" ? [parsedFilters.data.tagIds] : parsedFilters.data.tagIds,
      reportOutreach: parsedFilters.data.reportOutreach,
    });
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
            sql`coalesce(${followupTasks.taskType}, '') not in (${sql.join(REPORT_OUTREACH_TASKS.map(type => sql`${type}`), sql`, `)})`,
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

const HUNG_UP_OUTCOME = "Hung up";

const ALLOWED_OUTCOMES = [
  "No answer", "Left voicemail", "Spoke with lead", HUNG_UP_OUTCOME,
  "Interested", "Uncertain", "Not interested",
  "Bad number", "Wrong number", "Appointment set", "Call back",
  "Payment received", "Still waiting", "Won't pay",
  "No response", "Opted out", "Email bounced",
] as const;

const OUTCOME_VALUE_TO_KEY: Record<string, string> = {
  "No answer":        "noAnswer",
  "Left voicemail":   "leftVoicemail",
  "Spoke with lead":  "spokeWithLead",
  "Hung up":          "hungUp",
  "Interested":       "interested",
  "Uncertain":        "uncertain",
  "Not interested":   "notInterested",
  "Bad number":       "badNumber",
  "Wrong number":     "wrongNumber",
  "Call back":        "callBack",
  "Appointment set":  "appointmentSet",
  "Payment received": "paymentReceived",
  "Still waiting":    "stillWaiting",
  "Won't pay":        "wontPay",
};

const OUTCOME_STAGE_SLUG: Partial<Record<string, string>> = {
  "Not interested": "closed-lost",
  "Bad number":     "closed-lost",
  "Wrong number":   "closed-lost",
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
  demoTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  demoTimezone: z.string().optional(),
  callBackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  callBackTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  callBackTimezone: z.string().optional(),
}).optional();

/** The task's deal, falling back to the lead's open deal for tasks created without one. */
async function resolveTaskOpportunity(task: Pick<FollowupTask, "leadId" | "opportunityId">) {
  const condition = task.opportunityId
    ? eq(pipelineOpportunities.id, task.opportunityId)
    : task.leadId ? and(eq(pipelineOpportunities.leadId, task.leadId), eq(pipelineOpportunities.status, "open")) : null;
  if (!condition) return null;
  const [opportunity] = await db.select({ id: pipelineOpportunities.id, stageId: pipelineOpportunities.stageId })
    .from(pipelineOpportunities).where(condition).limit(1);
  return opportunity ?? null;
}

/** Discovery calls go to the admin who runs them (the earliest admin account). */
async function discoveryCallOwnerId(): Promise<string | null> {
  const [admin] = await db.select({ id: user.id }).from(user).where(eq(user.role, "admin")).orderBy(user.createdAt).limit(1);
  return admin?.id ?? null;
}

type LeadContactOutcomeResult = {
  leadId: string | null;
  recycled: boolean;
  recycleCount: number;
  hungUp: boolean;
  hungUpCount: number;
};

function emptyLeadContactOutcomeResult(): LeadContactOutcomeResult {
  return { leadId: null, recycled: false, recycleCount: 0, hungUp: false, hungUpCount: 0 };
}

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
): Promise<LeadContactOutcomeResult> {
  if (!outcome || (!AUTO_FOLLOWUP_OUTCOMES.has(outcome) && !CONTACT_STREAK_RESET_OUTCOMES.has(outcome))) {
    return emptyLeadContactOutcomeResult();
  }

  const leadId = await resolveTaskLeadId(task);
  if (!leadId) return emptyLeadContactOutcomeResult();

  const [lead] = await db
    .select({
      title: crmLeads.title,
      assignedTo: crmLeads.assignedTo,
      unansweredCallStreak: crmLeads.unansweredCallStreak,
      recycleCount: crmLeads.recycleCount,
      hungUpCount: crmLeads.hungUpCount,
    })
    .from(crmLeads)
    .where(eq(crmLeads.id, leadId))
    .limit(1);
  if (!lead) return { leadId, recycled: false, recycleCount: 0, hungUp: false, hungUpCount: 0 };

  if (outcome === HUNG_UP_OUTCOME) {
    const hungUpAt = new Date();
    const nextHungUpCount = lead.hungUpCount + 1;
    const [updatedLead] = await db
      .update(crmLeads)
      .set({
        assignedTo: null,
        unansweredCallStreak: 0,
        hungUpCount: nextHungUpCount,
        lastHungUpAt: hungUpAt,
        lastUnassignedFrom: lead.assignedTo,
        lastUnassignedReason: "hung_up",
        updatedAt: hungUpAt,
      })
      .where(eq(crmLeads.id, leadId))
      .returning({ hungUpCount: crmLeads.hungUpCount });

    await Promise.all([
      bulkAssignOpportunitiesByLeadIds([leadId], null),
      taskStorage.syncOpenTaskOwnershipForLeadIds([leadId], null),
    ]);

    const hungUpCount = updatedLead?.hungUpCount ?? nextHungUpCount;
    await logAudit({
      userId: actorId ?? undefined,
      action: "update",
      entity: "crm_lead",
      entityId: leadId,
      metadata: {
        action: "hung_up_unassigned",
        title: lead.title,
        outcome,
        previousAssigneeId: lead.assignedTo,
        hungUpCount,
      },
      ipAddress,
    });
    addLeadNote({
      leadId,
      userId: actorId,
      type: "system",
      content: "Lead marked as hung up and unassigned for reassignment.",
      metadata: {
        event: "lead_hung_up_unassigned",
        outcome,
        previousAssigneeId: lead.assignedTo,
        hungUpCount,
      },
    }).catch(() => {});

    return { leadId, recycled: false, recycleCount: lead.recycleCount, hungUp: true, hungUpCount };
  }

  if (AUTO_FOLLOWUP_OUTCOMES.has(outcome)) {
    const nextStreak = lead.unansweredCallStreak + 1;
    if (nextStreak < RECYCLE_FAILED_CONTACT_THRESHOLD) {
      await db
        .update(crmLeads)
        .set({ unansweredCallStreak: nextStreak, updatedAt: new Date() })
        .where(eq(crmLeads.id, leadId));
      return { leadId, recycled: false, recycleCount: lead.recycleCount, hungUp: false, hungUpCount: lead.hungUpCount };
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
        lastUnassignedFrom: lead.assignedTo,
        lastUnassignedReason: "recycled",
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
        previousAssigneeId: lead.assignedTo,
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
        previousAssigneeId: lead.assignedTo,
        failedContactThreshold: RECYCLE_FAILED_CONTACT_THRESHOLD,
        recycleCount,
      },
    }).catch(() => {});

    return { leadId, recycled: true, recycleCount, hungUp: false, hungUpCount: lead.hungUpCount };
  }

  if (lead.unansweredCallStreak > 0) {
    await db
      .update(crmLeads)
      .set({ unansweredCallStreak: 0, updatedAt: new Date() })
      .where(eq(crmLeads.id, leadId));
  }

  return { leadId, recycled: false, recycleCount: lead.recycleCount, hungUp: false, hungUpCount: lead.hungUpCount };
}

router.put("/:id/complete", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const body = completeTaskSchema.parse(req.body);
    const existingTask = await taskStorage.getTaskById(req.params.id as string);
    if (!existingTask) return res.status(404).json({ message: "Task not found" });
    if (isReportOutreachTask(existingTask.taskType)) {
      if (req.authUser?.role === "sales_rep" && existingTask.assignedTo !== req.authUser.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      const completed = await completeReportOutreachTask(existingTask, body ?? {}, req.authUser!.id);
      // Any recorded outcome means a person has taken over; Instantly must not keep emailing.
      if (existingTask.leadId) await stopInstantlyEnrollment(existingTask.leadId, `Report outcome: ${body?.outcome}`);
      await logAudit({ userId: req.authUser!.id, action: "update", entity: "followup_task", entityId: completed.id,
        metadata: { action: "completed", outcome: body?.outcome }, ipAddress: req.ip });
      return res.json(completed);
    }
    if (["No response", "Opted out", "Email bounced"].includes(body?.outcome ?? "")) {
      return res.status(400).json({ message: "Use the report outreach task to record this outcome." });
    }
    if (existingTask.completed) return res.json(existingTask);

    const callTask = isCallTask(existingTask.taskType);
    const taskOpportunity = await resolveTaskOpportunity(existingTask);
    const stages = taskOpportunity ? await getStages() : [];
    const currentStageSlug = stages.find(s => s.id === taskOpportunity?.stageId)?.slug ?? null;
    if (req.authUser?.role === "sales_rep" && taskOpportunity && !isSetterWorkingStage(currentStageSlug)) {
      return res.status(403).json({ message: "This lead is past Call Scheduled. Only an admin can update it now." });
    }
    if (callTask) {
      if (!body?.outcome || !CALL_OUTCOME_STAGE[body.outcome]) return res.status(400).json({ message: "Choose what happened on the call." });
      if (body.outcome === "Appointment set" && !(body.demoDate && /^\d{4}-\d{2}-\d{2}$/.test(body.demoDate) && body.demoTime)) {
        return res.status(400).json({ message: "Pick the date and time of the discovery call." });
      }
      if (body.outcome === "Call back" && !(body.callBackDate && body.callBackTime)) {
        return res.status(400).json({ message: "Pick when to call back." });
      }
    }

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

    const leadOutcomeResult = await applyLeadContactOutcome(task, body?.outcome, actorId, req.ip);

    if (body?.outcome && taskOpportunity) {
      const targetSlug = callTask ? CALL_OUTCOME_STAGE[body.outcome] : OUTCOME_STAGE_SLUG[body.outcome];
      const stage = targetSlug ? stages.find(s => s.slug === targetSlug) : undefined;
      if (stage && stage.id !== taskOpportunity.stageId) {
        await moveOpportunity(taskOpportunity.id, stage.id, actorId ?? undefined).catch(() => {});
      }

      if (body.outcome === "Call back" && body.callBackDate) {
        try {
          const callBackTask = await taskStorage.createTask({
            title: CALL_BACK_TASK_TITLE,
            taskType: CALL_TASK_TYPE,
            dueDate: new Date(body.callBackDate + "T00:00:00Z"),
            followUpTime: body.callBackTime ?? null,
            followUpTimezone: body.callBackTimezone ?? null,
            completed: false,
            assignedTo: task.assignedTo,
            opportunityId: taskOpportunity.id,
            leadId: task.leadId,
            contactId: task.contactId,
            companyId: task.companyId,
            createdBy: actorId,
          });
          const callBackContent = `Follow-up scheduled: ${callBackTask.title}`;
          const callBackMeta = { event: "follow_up_scheduled", taskTitle: callBackTask.title };
          if (callBackTask.leadId) addLeadNote({ leadId: callBackTask.leadId, userId: actorId, type: "task", content: callBackContent, metadata: callBackMeta }).catch(() => {});
          else addActivity({ opportunityId: taskOpportunity.id, userId: actorId, type: "task", content: callBackContent, metadata: callBackMeta }).catch(() => {});
        } catch (err: unknown) {
          console.error("[tasks/complete] call-back task creation failed:", err);
        }
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
          // The admin runs the discovery call; its demo_outcome type opens the call-completed prompt.
          const demoTask = await taskStorage.createTask({
            title: DISCOVERY_CALL_TASK_TITLE,
            taskType: "demo_outcome",
            dueDate: demoTaskDue,
            followUpTime: body.demoTime ?? null,
            followUpTimezone: body.demoTimezone ?? null,
            completed: false,
            assignedTo: (await discoveryCallOwnerId()) ?? task.assignedTo,
            opportunityId: taskOpportunity.id,
            leadId: task.leadId,
            contactId: task.contactId,
            companyId: task.companyId,
            createdBy: actorId,
          });
          const demoTaskContent = `Discovery call scheduled: ${demoTask.title}`;
          const demoTaskMeta = { event: "demo_outcome_task_created", taskTitle: demoTask.title };
          if (demoTask.leadId) addLeadNote({ leadId: demoTask.leadId, userId: actorId, type: "task", content: demoTaskContent, metadata: demoTaskMeta }).catch(() => {});
          else if (demoTask.opportunityId) addActivity({ opportunityId: demoTask.opportunityId, userId: actorId, type: "task", content: demoTaskContent, metadata: demoTaskMeta }).catch(() => {});
        } catch (err: unknown) {
          console.error("[tasks/complete] demo_outcome task creation failed:", err);
        }
      }
    }

    if (body?.outcome && AUTO_FOLLOWUP_OUTCOMES.has(body.outcome)) {
      // Leftover email tasks must not block the next call.
      const hasExisting = await taskStorage.getActiveTaskForContext(task.leadId, task.opportunityId, callTask ? CALL_TASK_TYPE : undefined);
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
            assignedTo: leadOutcomeResult.recycled ? null : task.assignedTo,
            opportunityId: task.opportunityId,
            leadId: task.leadId ?? leadOutcomeResult.leadId,
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

    if (body?.outcome === HUNG_UP_OUTCOME && leadOutcomeResult.hungUp) {
      const hasExisting = await taskStorage.getActiveTaskForContext(
        task.leadId ?? leadOutcomeResult.leadId,
        task.opportunityId,
        task.taskType,
      );
      if (!hasExisting) {
        const reassignmentDue = new Date();
        reassignmentDue.setUTCHours(0, 0, 0, 0);
        try {
          const newTask = await taskStorage.createTask({
            title: task.title,
            taskType: task.taskType,
            dueDate: reassignmentDue,
            completed: false,
            assignedTo: null,
            opportunityId: task.opportunityId,
            leadId: task.leadId ?? leadOutcomeResult.leadId,
            contactId: task.contactId,
            companyId: task.companyId,
            createdBy: actorId,
          });
          const scheduleContent = `Unassigned follow-up scheduled: ${newTask.title}`;
          const scheduleMeta = { event: "hung_up_follow_up_scheduled", taskTitle: newTask.title };
          if (newTask.leadId) addLeadNote({ leadId: newTask.leadId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
          else if (newTask.opportunityId) addActivity({ opportunityId: newTask.opportunityId, userId: actorId, type: "task", content: scheduleContent, metadata: scheduleMeta }).catch(() => {});
        } catch (err: unknown) {
          console.error("[tasks/complete] hung-up follow-up creation failed:", err);
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
    if (validated.completed !== undefined) {
      const existing = await taskStorage.getTaskById(req.params.id as string);
      if (isReportOutreachTask(existing?.taskType)) return res.status(400).json({ message: "Use the report outreach outcome form to complete this task." });
    }
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
