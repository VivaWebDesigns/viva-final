import { db } from "../../db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  crmLeadNotes, followupTasks, pipelineActivities,
  pipelineOpportunities, pipelineStages, stageAutomationTemplates,
} from "@shared/schema";
import {
  REPORT_INITIAL_TASK_NOTES, REPORT_INITIAL_TASK_TITLE,
  REPORT_OUTREACH_TASKS, REPORT_PERSONAL_FOLLOWUP_NOTES,
  REPORT_PERSONAL_FOLLOWUP_TITLE, reportBusinessDate,
} from "@shared/reportOutreach";
import { ensureReportEmailedStage, getReportOutreachStates, type ReportOutreachState } from "../crm/reportOutreach";

const TAG = "[backfill:task-company-id]";

export async function backfillTaskCompanyIds(): Promise<void> {
  const updated1 = await db.execute(sql`
    UPDATE followup_tasks ft
    SET company_id = l.company_id
    FROM crm_leads l
    WHERE ft.lead_id = l.id
      AND ft.company_id IS NULL
      AND l.company_id IS NOT NULL
  `);
  const count1 = updated1.rowCount ?? 0;
  if (count1 > 0) console.log(`${TAG} backfilled ${count1} tasks from leads`);

  const updated2 = await db.execute(sql`
    UPDATE followup_tasks ft
    SET company_id = o.company_id
    FROM pipeline_opportunities o
    WHERE ft.opportunity_id = o.id
      AND ft.company_id IS NULL
      AND o.company_id IS NOT NULL
  `);
  const count2 = updated2.rowCount ?? 0;
  if (count2 > 0) console.log(`${TAG} backfilled ${count2} tasks from opportunities`);

  if (count1 === 0 && count2 === 0) {
    console.log(`${TAG} no tasks needed backfill`);
  }
}

const EMAIL_FIRST_TAG = "[backfill:email-first-outreach]";
const LEGACY_TITLE = "Contact lead";

export type EmailFirstAction =
  | { kind: "skip" }
  | { kind: "convert_initial" }
  | { kind: "move_and_schedule"; taskType: "report_email_followup" | "report_email_review" | "report_personal_followup"; title: string; notes: string; dueDate: Date };

export function planEmailFirstAction(state: ReportOutreachState, now = new Date()): EmailFirstAction {
  if (state.reportOutreachDisposition && state.reportOutreachDisposition !== "active") return { kind: "skip" };
  if (state.reportEmailCount === 0) return { kind: "convert_initial" };
  if (state.reportViewCount > 0 || state.reportCtaClickCount > 0) {
    return {
      kind: "move_and_schedule",
      taskType: "report_personal_followup",
      title: REPORT_PERSONAL_FOLLOWUP_TITLE,
      notes: REPORT_PERSONAL_FOLLOWUP_NOTES,
      dueDate: reportBusinessDate(now, 0),
    };
  }
  if (state.reportEmailCount === 1) {
    return {
      kind: "move_and_schedule",
      taskType: "report_email_followup",
      title: "Send second visibility report email",
      notes: "Check your inbox first. If there is no reply, open this lead and use Email Report to send email 2 of 2. Successful sending completes this task automatically. Do not resend after an opt-out or bounce.",
      dueDate: reportBusinessDate(state.lastReportEmailedAt ?? now, 7),
    };
  }
  return {
    kind: "move_and_schedule",
    taskType: "report_email_review",
    title: "Check report reply — close as No Response if unanswered",
    notes: "Check your inbox before completing. If unanswered after five business days, choose No response to pause outreach. Do not send another report email.",
    dueDate: reportBusinessDate(state.lastReportEmailedAt ?? now, 5),
  };
}

/**
 * One-time, idempotent reconciliation for the switch from call-first to report-email-first outreach.
 * Runs before the workflow worker starts and only touches the exact legacy New Lead automation/task.
 */
export async function reconcileEmailFirstOutreach(): Promise<Record<string, number>> {
  return db.transaction(async (tx) => {
    const now = new Date();
    let templatesUpdated = 0;
    let templatesCreated = 0;
    let initialTasksConverted = 0;
    let historicalLeadsMoved = 0;
    let legacyTasksCompleted = 0;
    let nextTasksCreated = 0;

    const templates = await tx.select().from(stageAutomationTemplates)
      .where(eq(stageAutomationTemplates.triggerStageSlug, "new-lead"));
    const currentTemplate = templates.find((template) => template.title === REPORT_INITIAL_TASK_TITLE);
    const legacyTemplates = templates.filter((template) => template.title === LEGACY_TITLE && template.taskType === "call");

    if (currentTemplate) {
      if (!currentTemplate.isActive || currentTemplate.description !== REPORT_INITIAL_TASK_NOTES || currentTemplate.taskType !== "email") {
        await tx.update(stageAutomationTemplates).set({
          description: REPORT_INITIAL_TASK_NOTES, taskType: "email", dueOffsetDays: 0,
          priority: "high", isActive: true, updatedAt: now,
        }).where(eq(stageAutomationTemplates.id, currentTemplate.id));
        templatesUpdated++;
      }
      if (legacyTemplates.length) {
        await tx.update(stageAutomationTemplates).set({ isActive: false, updatedAt: now })
          .where(inArray(stageAutomationTemplates.id, legacyTemplates.map((template) => template.id)));
        templatesUpdated += legacyTemplates.length;
      }
    } else if (legacyTemplates.length) {
      const [primary, ...duplicates] = legacyTemplates;
      await tx.update(stageAutomationTemplates).set({
        title: REPORT_INITIAL_TASK_TITLE, description: REPORT_INITIAL_TASK_NOTES,
        taskType: "email", dueOffsetDays: 0, priority: "high", isActive: true, updatedAt: now,
      }).where(eq(stageAutomationTemplates.id, primary.id));
      templatesUpdated++;
      if (duplicates.length) {
        await tx.update(stageAutomationTemplates).set({ isActive: false, updatedAt: now })
          .where(inArray(stageAutomationTemplates.id, duplicates.map((template) => template.id)));
        templatesUpdated += duplicates.length;
      }
    } else {
      await tx.insert(stageAutomationTemplates).values({
        triggerStageSlug: "new-lead", title: REPORT_INITIAL_TASK_TITLE,
        description: REPORT_INITIAL_TASK_NOTES, dueOffsetDays: 0, priority: "high",
        taskType: "email", sortOrder: 0, isActive: true,
      });
      templatesCreated++;
    }

    const candidates = await tx.select({
      taskId: followupTasks.id,
      assignedTo: followupTasks.assignedTo,
      opportunityId: pipelineOpportunities.id,
      leadId: pipelineOpportunities.leadId,
      contactId: pipelineOpportunities.contactId,
      companyId: pipelineOpportunities.companyId,
    }).from(followupTasks)
      .innerJoin(pipelineOpportunities, eq(followupTasks.opportunityId, pipelineOpportunities.id))
      .innerJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
      .where(and(
        eq(followupTasks.completed, false), eq(followupTasks.title, LEGACY_TITLE),
        eq(followupTasks.taskType, "call"), eq(pipelineOpportunities.status, "open"),
        eq(pipelineStages.slug, "new-lead"),
      ));

    const leadIds = [...new Set(candidates.map((candidate) => candidate.leadId).filter(Boolean) as string[])];
    const states = await getReportOutreachStates(leadIds, tx);
    const byOpportunity = new Map<string, typeof candidates>();
    for (const candidate of candidates) {
      const group = byOpportunity.get(candidate.opportunityId) ?? [];
      group.push(candidate);
      byOpportunity.set(candidate.opportunityId, group);
    }

    let reportStage: Awaited<ReturnType<typeof ensureReportEmailedStage>> | null = null;
    for (const group of byOpportunity.values()) {
      const primary = group[0];
      if (!primary.leadId) continue;
      const state = states.get(primary.leadId)!;
      const action = planEmailFirstAction(state, now);
      if (action.kind === "skip") continue;

      const taskIds = group.map((candidate) => candidate.taskId);
      if (action.kind === "convert_initial") {
        await tx.update(followupTasks).set({
          title: REPORT_INITIAL_TASK_TITLE, notes: REPORT_INITIAL_TASK_NOTES, taskType: "email",
        }).where(eq(followupTasks.id, primary.taskId));
        initialTasksConverted++;
        if (taskIds.length > 1) {
          await tx.update(followupTasks).set({ completed: true, completedAt: now })
            .where(inArray(followupTasks.id, taskIds.slice(1)));
          legacyTasksCompleted += taskIds.length - 1;
        }
        continue;
      }

      await tx.update(followupTasks).set({ completed: true, completedAt: now })
        .where(inArray(followupTasks.id, taskIds));
      legacyTasksCompleted += taskIds.length;
      reportStage ??= await ensureReportEmailedStage(tx);
      await tx.update(pipelineOpportunities).set({
        stageId: reportStage.id, stageEnteredAt: now, updatedAt: now,
      }).where(eq(pipelineOpportunities.id, primary.opportunityId));
      historicalLeadsMoved++;

      await tx.insert(pipelineActivities).values({
        opportunityId: primary.opportunityId, type: "stage_change",
        content: "Historical report outreach reconciled: New Lead → Report Emailed",
        metadata: { event: "report_outreach_reconciled", fromStageSlug: "new-lead", toStageSlug: "report-emailed" },
      });
      await tx.insert(crmLeadNotes).values({
        leadId: primary.leadId, type: "system", createdAt: sql`clock_timestamp()`,
        content: `Email-first outreach reconciliation: ${state.reportEmailCount} historical report email(s); moved to Report Emailed and scheduled ${action.title}.`,
        metadata: { event: "report_outreach_reconciled", reportEmailCount: state.reportEmailCount, reportOutreachDisposition: "active" },
      });

      const [existingNextTask] = await tx.select({ id: followupTasks.id }).from(followupTasks)
        .where(and(eq(followupTasks.leadId, primary.leadId), eq(followupTasks.completed, false),
          inArray(followupTasks.taskType, [...REPORT_OUTREACH_TASKS]))).limit(1);
      if (!existingNextTask) {
        await tx.insert(followupTasks).values({
          title: action.title, notes: action.notes, taskType: action.taskType,
          dueDate: action.dueDate, leadId: primary.leadId,
          opportunityId: primary.opportunityId, companyId: primary.companyId,
          contactId: primary.contactId, assignedTo: primary.assignedTo,
        });
        nextTasksCreated++;
      }
    }

    const result = { templatesUpdated, templatesCreated, initialTasksConverted, historicalLeadsMoved, legacyTasksCompleted, nextTasksCreated };
    console.log(`${EMAIL_FIRST_TAG} ${JSON.stringify(result)}`);
    return result;
  });
}
