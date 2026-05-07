import { db } from "../../db";
import {
  followupTasks, crmContacts, crmCompanies, crmLeads, automationExecutionLogs,
  pipelineOpportunities, pipelineStages,
  type InsertFollowupTask, type FollowupTask,
} from "@shared/schema";
import { eq, and, gte, lte, lt, desc, asc, inArray, isNull, or } from "drizzle-orm";

export interface TaskAutomationMeta {
  triggerStageSlug: string;
  templateId: string;
  executedAt: Date;
}

export type TaskWithContact = FollowupTask & {
  contact: { firstName: string; lastName: string | null; phone: string | null } | null;
  company: { name: string; industry: string | null } | null;
  lead: { trade: string | null; recycleCount: number } | null;
  automationMeta: TaskAutomationMeta | null;
  opportunityStageSlug: string | null;
};

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function excludeSupersededAutomationTasks<T extends FollowupTask>(tasks: T[]): Promise<T[]> {
  if (tasks.length === 0) return tasks;

  const taskIds = tasks.map((task) => task.id);
  const opportunityIds = [...new Set(tasks.map((task) => task.opportunityId).filter(Boolean) as string[])];
  if (opportunityIds.length === 0) return tasks;

  const [automationRows, oppStageRows] = await Promise.all([
    db
      .select({
        generatedTaskId: automationExecutionLogs.generatedTaskId,
        triggerStageSlug: automationExecutionLogs.triggerStageSlug,
      })
      .from(automationExecutionLogs)
      .where(and(
        inArray(automationExecutionLogs.generatedTaskId, taskIds),
        eq(automationExecutionLogs.status, "success"),
      )),
    db
      .select({ opportunityId: pipelineOpportunities.id, stageSlug: pipelineStages.slug })
      .from(pipelineOpportunities)
      .innerJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
      .where(inArray(pipelineOpportunities.id, opportunityIds)),
  ]);

  if (automationRows.length === 0 || oppStageRows.length === 0) return tasks;

  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const oppStageMap = new Map(oppStageRows.map((row) => [row.opportunityId, row.stageSlug]));
  const supersededTaskIds = new Set<string>();

  for (const row of automationRows) {
    if (!row.generatedTaskId) continue;
    const task = taskMap.get(row.generatedTaskId);
    if (!task?.opportunityId) continue;
    const currentStageSlug = oppStageMap.get(task.opportunityId);
    if (currentStageSlug && row.triggerStageSlug !== currentStageSlug) {
      supersededTaskIds.add(row.generatedTaskId);
    }
  }

  if (supersededTaskIds.size === 0) return tasks;
  return tasks.filter((task) => !supersededTaskIds.has(task.id));
}

function scopedTaskOwnerCondition(ownerId?: string) {
  if (!ownerId) return undefined;

  const ownedOpportunityIds = db
    .select({ id: pipelineOpportunities.id })
    .from(pipelineOpportunities)
    .where(eq(pipelineOpportunities.assignedTo, ownerId));
  const ownedLeadIds = db
    .select({ id: crmLeads.id })
    .from(crmLeads)
    .where(eq(crmLeads.assignedTo, ownerId));

  return or(
    inArray(followupTasks.opportunityId, ownedOpportunityIds),
    and(
      isNull(followupTasks.opportunityId),
      inArray(followupTasks.leadId, ownedLeadIds),
    ),
    and(
      isNull(followupTasks.opportunityId),
      isNull(followupTasks.leadId),
      eq(followupTasks.assignedTo, ownerId),
    ),
  );
}

export async function getTasksDueToday(ownerId?: string): Promise<TaskWithContact[]> {
  const { start, end } = todayRange();
  const ownerCond = scopedTaskOwnerCondition(ownerId);
  const conditions = [
    eq(followupTasks.completed, false),
    gte(followupTasks.dueDate, start),
    lte(followupTasks.dueDate, end),
  ];
  if (ownerCond) conditions.push(ownerCond);
  const tasks = await db.select().from(followupTasks)
    .where(and(...conditions))
    .orderBy(asc(followupTasks.dueDate));
  return enrichTasks(await excludeSupersededAutomationTasks(tasks));
}

export async function getOverdueTasks(ownerId?: string): Promise<TaskWithContact[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ownerCond = scopedTaskOwnerCondition(ownerId);
  const conditions = [
    eq(followupTasks.completed, false),
    lt(followupTasks.dueDate, today),
  ];
  if (ownerCond) conditions.push(ownerCond);
  const tasks = await db.select().from(followupTasks)
    .where(and(...conditions))
    .orderBy(asc(followupTasks.dueDate));
  return enrichTasks(await excludeSupersededAutomationTasks(tasks));
}

export async function getTasksForOpportunity(opportunityId: string, ownerId?: string): Promise<FollowupTask[]> {
  const ownerCond = scopedTaskOwnerCondition(ownerId);
  const conditions = [eq(followupTasks.opportunityId, opportunityId)];
  if (ownerCond) conditions.push(ownerCond);
  const tasks = await db.select().from(followupTasks)
    .where(and(...conditions))
    .orderBy(asc(followupTasks.dueDate));
  return excludeSupersededAutomationTasks(tasks);
}

export async function getTasksForLead(leadId: string, ownerId?: string): Promise<FollowupTask[]> {
  const ownerCond = scopedTaskOwnerCondition(ownerId);
  const conditions = [eq(followupTasks.leadId, leadId)];
  if (ownerCond) conditions.push(ownerCond);
  const tasks = await db.select().from(followupTasks)
    .where(and(...conditions))
    .orderBy(asc(followupTasks.dueDate));
  return excludeSupersededAutomationTasks(tasks);
}

export async function getTasksForContact(contactId: string): Promise<FollowupTask[]> {
  return db.select().from(followupTasks)
    .where(eq(followupTasks.contactId, contactId))
    .orderBy(asc(followupTasks.dueDate));
}

export async function getUpcomingTasks(ownerId?: string): Promise<TaskWithContact[]> {
  const { end } = todayRange();
  const ownerCond = scopedTaskOwnerCondition(ownerId);
  const conditions = [
    eq(followupTasks.completed, false),
    gte(followupTasks.dueDate, new Date(end.getTime() + 1)),
  ];
  if (ownerCond) conditions.push(ownerCond);
  const tasks = await db.select().from(followupTasks)
    .where(and(...conditions))
    .orderBy(asc(followupTasks.dueDate));
  return enrichTasks(await excludeSupersededAutomationTasks(tasks));
}

export async function getActiveTaskForContext(leadId?: string | null, opportunityId?: string | null, taskType?: string | null): Promise<FollowupTask | null> {
  if (leadId) {
    const conditions = [eq(followupTasks.leadId, leadId), eq(followupTasks.completed, false)];
    if (taskType) conditions.push(eq(followupTasks.taskType, taskType));
    const [task] = await db.select().from(followupTasks)
      .where(and(...conditions))
      .orderBy(asc(followupTasks.dueDate))
      .limit(1);
    return task ?? null;
  }
  if (opportunityId) {
    const conditions = [eq(followupTasks.opportunityId, opportunityId), eq(followupTasks.completed, false)];
    if (taskType) conditions.push(eq(followupTasks.taskType, taskType));
    const [task] = await db.select().from(followupTasks)
      .where(and(...conditions))
      .orderBy(asc(followupTasks.dueDate))
      .limit(1);
    return task ?? null;
  }
  return null;
}

export async function createTask(data: InsertFollowupTask): Promise<FollowupTask> {
  const [result] = await db.insert(followupTasks).values(data).returning();
  return result;
}

export async function updateTask(id: string, data: Partial<InsertFollowupTask & { completedAt: Date | null }>): Promise<FollowupTask> {
  const [result] = await db.update(followupTasks).set(data).where(eq(followupTasks.id, id)).returning();
  return result;
}

export async function getTaskById(id: string): Promise<FollowupTask | undefined> {
  const [result] = await db.select().from(followupTasks).where(eq(followupTasks.id, id));
  return result;
}

export async function completeTask(id: string, extras?: { outcome?: string; completionNote?: string }): Promise<FollowupTask> {
  const [result] = await db.update(followupTasks)
    .set({
      completed: true,
      completedAt: new Date(),
      ...(extras?.outcome != null ? { outcome: extras.outcome } : {}),
      ...(extras?.completionNote != null ? { completionNote: extras.completionNote } : {}),
    })
    .where(eq(followupTasks.id, id))
    .returning();
  return result;
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(followupTasks).where(eq(followupTasks.id, id));
}

export async function getCompletedTaskHistory(limit = 50, ownerId?: string): Promise<TaskWithContact[]> {
  const ownerCond = scopedTaskOwnerCondition(ownerId);
  const conditions = [eq(followupTasks.completed, true)];
  if (ownerCond) conditions.push(ownerCond);
  const tasks = await db.select().from(followupTasks)
    .where(and(...conditions))
    .orderBy(desc(followupTasks.completedAt))
    .limit(limit);
  return enrichTasks(tasks);
}

export async function syncOpenTaskOwnershipForLeadIds(leadIds: string[], assignedTo: string | null): Promise<number> {
  if (leadIds.length === 0) return 0;

  const opportunityRows = await db
    .select({ id: pipelineOpportunities.id, leadId: pipelineOpportunities.leadId, stageSlug: pipelineStages.slug })
    .from(pipelineOpportunities)
    .leftJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
    .where(inArray(pipelineOpportunities.leadId, leadIds));
  const opportunityIds = opportunityRows.map((row) => row.id);
  const opportunityStageMap = new Map(opportunityRows.map((row) => [row.id, row.stageSlug ?? null]));
  const leadOpportunityStageMap = new Map(
    opportunityRows
      .filter((row) => row.leadId)
      .map((row) => [row.leadId!, row.stageSlug ?? null]),
  );

  const linkedTaskCondition = opportunityIds.length > 0
    ? or(
        inArray(followupTasks.leadId, leadIds),
        inArray(followupTasks.opportunityId, opportunityIds),
      )
    : inArray(followupTasks.leadId, leadIds);

  const today = todayRange().start;
  const openTaskRows = await db
    .select({
      id: followupTasks.id,
      dueDate: followupTasks.dueDate,
      leadId: followupTasks.leadId,
      opportunityId: followupTasks.opportunityId,
      triggerStageSlug: automationExecutionLogs.triggerStageSlug,
    })
    .from(followupTasks)
    .leftJoin(
      automationExecutionLogs,
      and(
        eq(automationExecutionLogs.generatedTaskId, followupTasks.id),
        eq(automationExecutionLogs.status, "success"),
      ),
    )
    .where(and(
      eq(followupTasks.completed, false),
      linkedTaskCondition,
    ));

  const currentTaskIds = new Set<string>();
  const overdueCurrentTaskIds = new Set<string>();

  for (const row of openTaskRows) {
    const currentStageSlug = row.opportunityId
      ? opportunityStageMap.get(row.opportunityId) ?? null
      : row.leadId
        ? leadOpportunityStageMap.get(row.leadId) ?? null
        : null;
    const isStaleAutomation = Boolean(
      row.triggerStageSlug
      && currentStageSlug
      && row.triggerStageSlug !== currentStageSlug,
    );

    if (isStaleAutomation) {
      continue;
    }

    currentTaskIds.add(row.id);
    if (row.dueDate < today) {
      overdueCurrentTaskIds.add(row.id);
    }
  }

  const overdueCurrentIds = [...overdueCurrentTaskIds];
  const overdueUpdated = overdueCurrentIds.length > 0
    ? await db
        .update(followupTasks)
        .set({ assignedTo, dueDate: today })
        .where(inArray(followupTasks.id, overdueCurrentIds))
        .returning({ id: followupTasks.id })
    : [];

  const nonOverdueCurrentIds = [...currentTaskIds].filter((id) => !overdueCurrentTaskIds.has(id));
  const currentUpdated = nonOverdueCurrentIds.length > 0
    ? await db
        .update(followupTasks)
        .set({ assignedTo })
        .where(inArray(followupTasks.id, nonOverdueCurrentIds))
        .returning({ id: followupTasks.id })
    : [];

  return overdueUpdated.length + currentUpdated.length;
}

async function enrichTasks(tasks: FollowupTask[]): Promise<TaskWithContact[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map(t => t.id);
  const contactIds = [...new Set(tasks.map(t => t.contactId).filter(Boolean) as string[])];
  const opportunityIds = [...new Set(tasks.map(t => t.opportunityId).filter(Boolean) as string[])];
  const directLeadIds = [...new Set(tasks.map(t => t.leadId).filter(Boolean) as string[])];

  const [contacts, automationLogRows, oppStageRows] = await Promise.all([
    contactIds.length
      ? db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName, phone: crmContacts.phone, companyId: crmContacts.companyId })
          .from(crmContacts)
          .where(inArray(crmContacts.id, contactIds))
      : Promise.resolve([]),
    db.select({
      generatedTaskId: automationExecutionLogs.generatedTaskId,
      triggerStageSlug: automationExecutionLogs.triggerStageSlug,
      templateId: automationExecutionLogs.templateId,
      createdAt: automationExecutionLogs.createdAt,
    })
      .from(automationExecutionLogs)
      .where(
        and(
          inArray(automationExecutionLogs.generatedTaskId, taskIds),
          eq(automationExecutionLogs.status, "success"),
        ),
      ),
    opportunityIds.length
      ? db.select({ opportunityId: pipelineOpportunities.id, slug: pipelineStages.slug, leadId: pipelineOpportunities.leadId })
          .from(pipelineOpportunities)
          .innerJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
          .where(inArray(pipelineOpportunities.id, opportunityIds))
      : Promise.resolve([]),
  ]);

  const leadIds = [...new Set([
    ...directLeadIds,
    ...oppStageRows.map((row) => row.leadId).filter(Boolean) as string[],
  ])];
  const leads = await (
    leadIds.length
      ? db.select({ id: crmLeads.id, trade: crmLeads.trade, recycleCount: crmLeads.recycleCount })
          .from(crmLeads)
          .where(inArray(crmLeads.id, leadIds))
      : Promise.resolve([])
  );

  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));
  const oppStageMap = Object.fromEntries(oppStageRows.map(r => [r.opportunityId, r.slug]));
  const oppLeadMap = Object.fromEntries(oppStageRows.map(r => [r.opportunityId, r.leadId]));
  const leadMap = Object.fromEntries(leads.map(l => [l.id, l]));

  const companyIds = [...new Set([
    ...contacts.map(c => c.companyId).filter(Boolean) as string[],
    ...tasks.map(t => t.companyId).filter(Boolean) as string[],
  ])];
  const companies = companyIds.length
    ? await db.select({ id: crmCompanies.id, name: crmCompanies.name, industry: crmCompanies.industry })
        .from(crmCompanies)
        .where(inArray(crmCompanies.id, companyIds))
    : [];

  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]));
  const automationMetaMap = new Map<string, TaskAutomationMeta>(
    automationLogRows
      .filter((r) => r.generatedTaskId)
      .map((r) => [
        r.generatedTaskId!,
        { triggerStageSlug: r.triggerStageSlug, templateId: r.templateId!, executedAt: r.createdAt },
      ]),
  );

  return tasks.map(task => {
    const contact = task.contactId ? contactMap[task.contactId] ?? null : null;
    const company = (task.companyId ? companyMap[task.companyId] : null)
      ?? (contact?.companyId ? companyMap[contact.companyId] : null)
      ?? null;
    const effectiveLeadId = task.leadId ?? (task.opportunityId ? oppLeadMap[task.opportunityId] ?? null : null);
    const leadRow = effectiveLeadId ? leadMap[effectiveLeadId] ?? null : null;
    const rawTrade = leadRow?.trade ?? company?.industry ?? null;
    const recycleCount = leadRow?.recycleCount ?? 0;
    const lead: TaskWithContact["lead"] = rawTrade || recycleCount > 0
      ? { trade: rawTrade, recycleCount }
      : null;
    const automationMeta = automationMetaMap.get(task.id) ?? null;
    const opportunityStageSlug = task.opportunityId ? oppStageMap[task.opportunityId] ?? null : null;
    return { ...task, contact, company, lead, automationMeta, opportunityStageSlug };
  });
}
