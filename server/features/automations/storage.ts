import { db } from "../../db";
import {
  stageAutomationTemplates,
  automationExecutionLogs,
  pipelineOpportunities,
  followupTasks,
  type InsertStageAutomationTemplate,
  type StageAutomationTemplate,
  type InsertAutomationExecutionLog,
  type AutomationExecutionLog,
} from "@shared/schema";
import { eq, and, asc, desc, gte, lte, count } from "drizzle-orm";

export async function listTemplates(): Promise<StageAutomationTemplate[]> {
  return db
    .select()
    .from(stageAutomationTemplates)
    .orderBy(asc(stageAutomationTemplates.triggerStageSlug), asc(stageAutomationTemplates.sortOrder));
}

export async function listTemplatesByStage(stageSlug: string): Promise<StageAutomationTemplate[]> {
  return db
    .select()
    .from(stageAutomationTemplates)
    .where(eq(stageAutomationTemplates.triggerStageSlug, stageSlug))
    .orderBy(asc(stageAutomationTemplates.sortOrder));
}

export async function getActiveTemplatesForStage(stageSlug: string): Promise<StageAutomationTemplate[]> {
  return db
    .select()
    .from(stageAutomationTemplates)
    .where(
      and(
        eq(stageAutomationTemplates.triggerStageSlug, stageSlug),
        eq(stageAutomationTemplates.isActive, true),
      )
    )
    .orderBy(asc(stageAutomationTemplates.sortOrder));
}

export async function getTemplateById(id: string): Promise<StageAutomationTemplate | null> {
  const [result] = await db
    .select()
    .from(stageAutomationTemplates)
    .where(eq(stageAutomationTemplates.id, id));
  return result ?? null;
}

export async function createTemplate(data: InsertStageAutomationTemplate): Promise<StageAutomationTemplate> {
  const [result] = await db.insert(stageAutomationTemplates).values(data).returning();
  return result;
}

export async function updateTemplate(
  id: string,
  data: Partial<InsertStageAutomationTemplate>,
): Promise<StageAutomationTemplate> {
  const [result] = await db
    .update(stageAutomationTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(stageAutomationTemplates.id, id))
    .returning();
  return result;
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.delete(stageAutomationTemplates).where(eq(stageAutomationTemplates.id, id));
}

export async function reorderTemplates(
  stageSlug: string,
  orderedIds: string[],
): Promise<void> {
  const existing = await db
    .select({ id: stageAutomationTemplates.id })
    .from(stageAutomationTemplates)
    .where(eq(stageAutomationTemplates.triggerStageSlug, stageSlug));

  const existingIds = new Set(existing.map((t) => t.id));
  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new Error(`Template ${id} does not belong to stage ${stageSlug}`);
    }
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(stageAutomationTemplates)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(
          and(
            eq(stageAutomationTemplates.id, orderedIds[i]),
            eq(stageAutomationTemplates.triggerStageSlug, stageSlug),
          )
        );
    }
  });
}

export async function getMaxSortOrder(stageSlug: string): Promise<number> {
  const templates = await db
    .select({ sortOrder: stageAutomationTemplates.sortOrder })
    .from(stageAutomationTemplates)
    .where(eq(stageAutomationTemplates.triggerStageSlug, stageSlug))
    .orderBy(desc(stageAutomationTemplates.sortOrder))
    .limit(1);
  return templates.length > 0 ? templates[0].sortOrder : -1;
}

export async function createExecutionLog(data: InsertAutomationExecutionLog): Promise<AutomationExecutionLog> {
  const [result] = await db.insert(automationExecutionLogs).values(data).returning();
  return result;
}

export interface EnrichedExecutionLog extends AutomationExecutionLog {
  templateTitle: string | null;
  opportunityTitle: string | null;
  generatedTaskTitle: string | null;
}

export async function getExecutionLogs(filters: {
  leadId?: string;
  opportunityId?: string;
  triggerStageSlug?: string;
  status?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}): Promise<EnrichedExecutionLog[]> {
  const conditions = [];
  if (filters.leadId) conditions.push(eq(automationExecutionLogs.leadId, filters.leadId));
  if (filters.opportunityId) conditions.push(eq(automationExecutionLogs.opportunityId, filters.opportunityId));
  if (filters.triggerStageSlug) conditions.push(eq(automationExecutionLogs.triggerStageSlug, filters.triggerStageSlug));
  if (filters.status) conditions.push(eq(automationExecutionLogs.status, filters.status));
  if (filters.since) conditions.push(gte(automationExecutionLogs.createdAt, filters.since));
  if (filters.until) conditions.push(lte(automationExecutionLogs.createdAt, filters.until));

  const rows = await db
    .select({
      log: automationExecutionLogs,
      templateTitle: stageAutomationTemplates.title,
      opportunityTitle: pipelineOpportunities.title,
      generatedTaskTitle: followupTasks.title,
    })
    .from(automationExecutionLogs)
    .leftJoin(stageAutomationTemplates, eq(automationExecutionLogs.templateId, stageAutomationTemplates.id))
    .leftJoin(pipelineOpportunities, eq(automationExecutionLogs.opportunityId, pipelineOpportunities.id))
    .leftJoin(followupTasks, eq(automationExecutionLogs.generatedTaskId, followupTasks.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(automationExecutionLogs.createdAt))
    .limit(filters.limit ?? 100);

  return rows.map((r) => ({
    ...r.log,
    templateTitle: r.templateTitle ?? null,
    opportunityTitle: r.opportunityTitle ?? null,
    generatedTaskTitle: r.generatedTaskTitle ?? null,
  }));
}

export async function getTemplateStageCounts(): Promise<Record<string, { total: number; active: number }>> {
  const rows = await db
    .select({
      stage: stageAutomationTemplates.triggerStageSlug,
      isActive: stageAutomationTemplates.isActive,
      cnt: count(),
    })
    .from(stageAutomationTemplates)
    .groupBy(stageAutomationTemplates.triggerStageSlug, stageAutomationTemplates.isActive);

  const result: Record<string, { total: number; active: number }> = {};
  for (const row of rows) {
    if (!result[row.stage]) result[row.stage] = { total: 0, active: 0 };
    result[row.stage].total += Number(row.cnt);
    if (row.isActive) result[row.stage].active += Number(row.cnt);
  }
  return result;
}
