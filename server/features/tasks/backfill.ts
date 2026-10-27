import { db } from "../../db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  crmLeads, followupTasks, pipelineActivities,
  pipelineOpportunities, pipelineStages, stageAutomationTemplates,
} from "@shared/schema";
import { REPORT_INITIAL_TASK_TITLE, REPORT_OUTREACH_TASKS } from "@shared/reportOutreach";
import { CALL_PIPELINE_STAGES, CALL_TASK_TITLE, CALL_TASK_TYPE } from "@shared/callPipeline";

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


const CALL_FIRST_TAG = "[backfill:call-first-outreach]";


/**
 * One-time, idempotent switch from report-email-first to call-first outreach.
 * It runs only while the email-first New Lead automation is still active, then turns that automation off.
 */
export async function reconcileCallFirstOutreach(): Promise<Record<string, number>> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('call-first-outreach'))`);
    const result = { stagesUpdated: 0, opportunitiesMoved: 0, emailTasksClosed: 0, callTasksCreated: 0 };
    const [emailTemplate] = await tx.select().from(stageAutomationTemplates).where(and(
      eq(stageAutomationTemplates.triggerStageSlug, "new-lead"),
      eq(stageAutomationTemplates.title, REPORT_INITIAL_TASK_TITLE),
      eq(stageAutomationTemplates.isActive, true),
    )).limit(1);
    if (!emailTemplate) return result;
    const now = new Date();

    const existingStages = await tx.select().from(pipelineStages);
    for (const stage of CALL_PIPELINE_STAGES) {
      const existing = existingStages.find((row) => row.slug === stage.slug);
      if (existing) {
        await tx.update(pipelineStages).set({ name: stage.name, sortOrder: stage.sortOrder }).where(eq(pipelineStages.id, existing.id));
      } else {
        await tx.insert(pipelineStages).values(stage);
      }
      result.stagesUpdated++;
    }

    // Calls replace the email automations: New Lead gets a call task; Contacted no longer schedules a demo.
    await tx.update(stageAutomationTemplates).set({ isActive: false, updatedAt: now }).where(or(
      eq(stageAutomationTemplates.id, emailTemplate.id),
      and(eq(stageAutomationTemplates.triggerStageSlug, "contacted"), eq(stageAutomationTemplates.title, "Schedule demo")),
    ));
    const [callTemplate] = await tx.select({ id: stageAutomationTemplates.id }).from(stageAutomationTemplates).where(and(
      eq(stageAutomationTemplates.triggerStageSlug, "new-lead"), eq(stageAutomationTemplates.title, CALL_TASK_TITLE),
    )).limit(1);
    if (callTemplate) {
      await tx.update(stageAutomationTemplates).set({ taskType: CALL_TASK_TYPE, isActive: true, updatedAt: now })
        .where(eq(stageAutomationTemplates.id, callTemplate.id));
    } else {
      await tx.insert(stageAutomationTemplates).values({
        triggerStageSlug: "new-lead", title: CALL_TASK_TITLE, description: "Call the lead and record what happened.",
        dueOffsetDays: 0, priority: "high", taskType: CALL_TASK_TYPE, sortOrder: 0, isActive: true,
      });
    }

    const stages = await tx.select().from(pipelineStages);
    const stageId = (slug: string) => stages.find((stage) => stage.slug === slug)?.id;
    const newLeadId = stageId("new-lead")!;
    const reportEmailedId = stageId("report-emailed");
    if (reportEmailedId) {
      const moved = await tx.update(pipelineOpportunities).set({ stageId: newLeadId, stageEnteredAt: now, updatedAt: now })
        .where(and(eq(pipelineOpportunities.stageId, reportEmailedId), eq(pipelineOpportunities.status, "open")))
        .returning({ id: pipelineOpportunities.id });
      if (moved.length) {
        await tx.insert(pipelineActivities).values(moved.map(({ id }) => ({
          opportunityId: id, type: "stage_change",
          content: "Switched to cold calling: Report Emailed → New Lead",
          metadata: { event: "stage_change", fromStageSlug: "report-emailed", toStageSlug: "new-lead", source: "call_first_switch" },
        })));
      }
      result.opportunitiesMoved = moved.length;
    }

    const closed = await tx.update(followupTasks).set({ completed: true, completedAt: now }).where(and(
      eq(followupTasks.completed, false),
      or(eq(followupTasks.title, REPORT_INITIAL_TASK_TITLE), inArray(followupTasks.taskType, [...REPORT_OUTREACH_TASKS])),
    )).returning({ id: followupTasks.id });
    result.emailTasksClosed = closed.length;

    const needsCall = await tx.select({
      opportunityId: pipelineOpportunities.id,
      leadId: pipelineOpportunities.leadId,
      companyId: pipelineOpportunities.companyId,
      contactId: pipelineOpportunities.contactId,
      assignedTo: sql<string | null>`coalesce(${pipelineOpportunities.assignedTo}, ${crmLeads.assignedTo})`,
    }).from(pipelineOpportunities)
      .leftJoin(crmLeads, eq(pipelineOpportunities.leadId, crmLeads.id))
      .where(and(
        eq(pipelineOpportunities.stageId, newLeadId), eq(pipelineOpportunities.status, "open"),
        sql`not exists (select 1 from ${followupTasks} where ${followupTasks.opportunityId} = ${pipelineOpportunities.id}
          and ${followupTasks.completed} = false and ${followupTasks.taskType} = ${CALL_TASK_TYPE})`,
      ));
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    if (needsCall.length) {
      await tx.insert(followupTasks).values(needsCall.map((row) => ({
        title: CALL_TASK_TITLE, taskType: CALL_TASK_TYPE, dueDate: today, completed: false,
        opportunityId: row.opportunityId, leadId: row.leadId, companyId: row.companyId,
        contactId: row.contactId, assignedTo: row.assignedTo,
      })));
    }
    result.callTasksCreated = needsCall.length;

    console.log(`${CALL_FIRST_TAG} ${JSON.stringify(result)}`);
    return result;
  });
}
