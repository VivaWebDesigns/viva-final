import { db } from "../../db";
import {
  followupTasks,
  automationExecutionLogs,
  type StageAutomationTemplate,
  type AutomationExecStatus,
  AUTOMATION_TRIGGER_STAGES,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import * as automationStorage from "./storage";
import { getActiveTaskForContext } from "../tasks/storage";

interface TriggerContext {
  opportunityId: string;
  leadId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  assignedTo?: string | null;
  stageSlug: string;
  stageEnteredAt?: Date;
  actorId?: string | null;
  rerunOnEntry?: boolean;
}

interface TriggerResult {
  stageSlug: string;
  templatesFound: number;
  tasksCreated: number;
  tasksSkipped: number;
  errors: number;
}

const SUPPORTED_SLUGS = new Set(AUTOMATION_TRIGGER_STAGES as readonly string[]);

export async function executeStageAutomations(ctx: TriggerContext): Promise<TriggerResult> {
  const result: TriggerResult = {
    stageSlug: ctx.stageSlug,
    templatesFound: 0,
    tasksCreated: 0,
    tasksSkipped: 0,
    errors: 0,
  };

  if (!SUPPORTED_SLUGS.has(ctx.stageSlug)) {
    return result;
  }

  let templates: StageAutomationTemplate[];
  try {
    templates = await automationStorage.getActiveTemplatesForStage(ctx.stageSlug);
  } catch (err) {
    console.error(`[automations] Failed to fetch templates for stage ${ctx.stageSlug}:`, err);
    return result;
  }

  result.templatesFound = templates.length;
  if (templates.length === 0) return result;

  if (ctx.rerunOnEntry) {
    await automationStorage.clearExecutionLogsForStage(ctx.opportunityId, ctx.stageSlug);
  }

  const entryDate = ctx.stageEnteredAt ?? new Date();

  for (const tpl of templates) {
    try {
      const isDuplicate = await checkDuplicate(ctx.opportunityId, tpl.id, ctx.stageSlug);
      if (isDuplicate) {
        result.tasksSkipped++;
        await logExecution({
          opportunityId: ctx.opportunityId,
          leadId: ctx.leadId ?? null,
          triggerStageSlug: ctx.stageSlug,
          templateId: tpl.id,
          generatedTaskId: null,
          status: "skipped",
          details: "Duplicate: open automation task already exists for this opportunity, template, and stage.",
        });
        continue;
      }

      const existingOpenTask = await getActiveTaskForContext(ctx.leadId, ctx.opportunityId, tpl.taskType);
      if (existingOpenTask) {
        result.tasksSkipped++;
        await logExecution({
          opportunityId: ctx.opportunityId,
          leadId: ctx.leadId ?? null,
          triggerStageSlug: ctx.stageSlug,
          templateId: tpl.id,
          generatedTaskId: null,
          status: "skipped",
          details: `Skipped: open task "${existingOpenTask.title}" already exists for this opportunity.`,
        });
        continue;
      }

      const dueDate = new Date(entryDate);
      dueDate.setDate(dueDate.getDate() + tpl.dueOffsetDays);

      const [task] = await db.insert(followupTasks).values({
        title: tpl.title,
        notes: tpl.description,
        taskType: tpl.taskType,
        dueDate,
        completed: false,
        assignedTo: ctx.assignedTo ?? null,
        opportunityId: ctx.opportunityId,
        leadId: ctx.leadId ?? null,
        contactId: ctx.contactId ?? null,
        companyId: ctx.companyId ?? null,
        createdBy: ctx.actorId ?? null,
      }).returning();

      result.tasksCreated++;

      await logExecution({
        opportunityId: ctx.opportunityId,
        leadId: ctx.leadId ?? null,
        triggerStageSlug: ctx.stageSlug,
        templateId: tpl.id,
        generatedTaskId: task.id,
        status: "success",
        details: null,
      });
    } catch (err) {
      result.errors++;
      console.error(`[automations] Failed to generate task from template ${tpl.id}:`, err);
      try {
        await logExecution({
          opportunityId: ctx.opportunityId,
          leadId: ctx.leadId ?? null,
          triggerStageSlug: ctx.stageSlug,
          templateId: tpl.id,
          generatedTaskId: null,
          status: "failed",
          details: err instanceof Error ? err.message : String(err),
        });
      } catch (_) {}
    }
  }

  if (result.tasksCreated > 0) {
    console.log(
      `[automations] Stage "${ctx.stageSlug}" → created ${result.tasksCreated} tasks, skipped ${result.tasksSkipped}, errors ${result.errors} for opportunity ${ctx.opportunityId}`
    );
  }

  return result;
}

async function checkDuplicate(
  opportunityId: string,
  templateId: string,
  stageSlug: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: automationExecutionLogs.id })
    .from(automationExecutionLogs)
    .where(
      and(
        eq(automationExecutionLogs.opportunityId, opportunityId),
        eq(automationExecutionLogs.templateId, templateId),
        eq(automationExecutionLogs.triggerStageSlug, stageSlug),
        eq(automationExecutionLogs.status, "success"),
      )
    )
    .limit(1);
  return existing.length > 0;
}

async function logExecution(data: {
  opportunityId: string;
  leadId: string | null;
  triggerStageSlug: string;
  templateId: string;
  generatedTaskId: string | null;
  status: AutomationExecStatus;
  details: string | null;
}): Promise<void> {
  await automationStorage.createExecutionLog(data);
}
