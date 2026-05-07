import { db } from "../../db";
import {
  pipelineStages, pipelineOpportunities, pipelineActivities,
  crmLeads, crmCompanies, crmContacts, crmLeadNotes, user, followupTasks,
  type InsertPipelineStage, type InsertPipelineOpportunity, type InsertPipelineActivity,
  type PipelineStage, type PipelineOpportunity, type PipelineActivity,
} from "@shared/schema";
import { eq, ilike, or, desc, asc, sql, and, count, inArray } from "drizzle-orm";

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface OpportunityFilters extends PaginationParams {
  search?: string;
  stageId?: string;
  assignedTo?: string;
  status?: string;
}

export async function getStages(): Promise<PipelineStage[]> {
  return db.select().from(pipelineStages).orderBy(asc(pipelineStages.sortOrder));
}

export async function getStageById(id: string): Promise<PipelineStage | undefined> {
  const [result] = await db.select().from(pipelineStages).where(eq(pipelineStages.id, id));
  return result;
}

export async function getStageBySlug(slug: string): Promise<PipelineStage | undefined> {
  const [result] = await db.select().from(pipelineStages).where(eq(pipelineStages.slug, slug));
  return result;
}

export async function createStage(data: InsertPipelineStage): Promise<PipelineStage> {
  const [result] = await db.insert(pipelineStages).values(data).returning();
  return result;
}

export async function updateStage(id: string, data: Partial<InsertPipelineStage>): Promise<PipelineStage> {
  const [result] = await db.update(pipelineStages).set(data).where(eq(pipelineStages.id, id)).returning();
  return result;
}

export async function clearStageFromOpportunities(stageId: string): Promise<void> {
  await db.update(pipelineOpportunities)
    .set({ stageId: null, updatedAt: new Date() })
    .where(eq(pipelineOpportunities.stageId, stageId));
}

export async function deleteStage(id: string): Promise<void> {
  await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
}

export async function upsertStage(data: InsertPipelineStage): Promise<PipelineStage> {
  const existing = await getStageBySlug(data.slug);
  if (existing) return existing;
  return createStage(data);
}

export async function getOpportunities(filters: OpportunityFilters = {}) {
  const { search, stageId, assignedTo, status, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(pipelineOpportunities.title, `%${search}%`),
        ilike(pipelineOpportunities.notes, `%${search}%`),
        ilike(pipelineOpportunities.sourceLeadTitle, `%${search}%`)
      )
    );
  }
  if (stageId) conditions.push(eq(pipelineOpportunities.stageId, stageId));
  if (assignedTo) conditions.push(eq(pipelineOpportunities.assignedTo, assignedTo));
  if (status) conditions.push(eq(pipelineOpportunities.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    where
      ? db.select().from(pipelineOpportunities).where(where).orderBy(desc(pipelineOpportunities.createdAt)).limit(limit).offset(offset)
      : db.select().from(pipelineOpportunities).orderBy(desc(pipelineOpportunities.createdAt)).limit(limit).offset(offset),
    where
      ? db.select({ total: count() }).from(pipelineOpportunities).where(where)
      : db.select({ total: count() }).from(pipelineOpportunities),
  ]);

  return { items, total: totalResult[0]?.total ?? 0, page, limit };
}

// Board card projection — only columns needed for display, task scheduling, and DnD.
// Excluded: notes, expectedCloseDate, stageEnteredAt, sourceLeadTitle, updatedAt,
//           nextActionDate, followUpDate — none are rendered on the kanban card.
const BOARD_CARD_COLUMNS = {
  id:             pipelineOpportunities.id,
  title:          pipelineOpportunities.title,
  value:          pipelineOpportunities.value,
  stageId:        pipelineOpportunities.stageId,
  leadId:         pipelineOpportunities.leadId,
  contactId:      pipelineOpportunities.contactId,
  companyId:      pipelineOpportunities.companyId,
  status:         pipelineOpportunities.status,
  websitePackage: pipelineOpportunities.websitePackage,
  assignedTo:     pipelineOpportunities.assignedTo,
  createdAt:      pipelineOpportunities.createdAt,
} as const;

export async function getOpportunitiesByStage(
  userId?: string,
  options: { includeArchived?: boolean; includeAssigneeMap?: boolean } = {},
) {
  const { includeArchived = true, includeAssigneeMap = false } = options;
  const stages = await getStages();

  // Build WHERE clause from userId + optional status filter.
  const userCond    = userId ? eq(pipelineOpportunities.assignedTo, userId) : undefined;
  const statusCond  = includeArchived ? undefined : eq(pipelineOpportunities.status, "open");
  const where       = userCond && statusCond ? and(userCond, statusCond)
                    : statusCond ?? userCond;

  const allOpps = (
    where
      ? await db.select(BOARD_CARD_COLUMNS).from(pipelineOpportunities)
          .where(where).orderBy(asc(pipelineOpportunities.createdAt))
      : await db.select(BOARD_CARD_COLUMNS).from(pipelineOpportunities)
          .orderBy(asc(pipelineOpportunities.createdAt))
  ) as unknown as PipelineOpportunity[];
  const opportunityIds = allOpps.map((opp) => opp.id);
  const opportunityIdSet = new Set(opportunityIds);
  const leadIds = [...new Set(allOpps.map((opp) => opp.leadId).filter(Boolean) as string[])];
  const leadOpportunityMap = new Map(
    allOpps
      .filter((opp) => opp.leadId)
      .map((opp) => [opp.leadId!, opp.id]),
  );
  const taskLinkCondition = opportunityIds.length > 0
    ? (leadIds.length > 0
      ? or(inArray(followupTasks.opportunityId, opportunityIds), inArray(followupTasks.leadId, leadIds))
      : inArray(followupTasks.opportunityId, opportunityIds))
    : undefined;
  const openTaskRows = taskLinkCondition
    ? await db
        .select({
          opportunityId: followupTasks.opportunityId,
          leadId: followupTasks.leadId,
          dueDate: followupTasks.dueDate,
        })
        .from(followupTasks)
        .where(and(eq(followupTasks.completed, false), taskLinkCondition))
    : [];
  const nextTaskDueByOpportunity = new Map<string, number>();

  for (const task of openTaskRows) {
    const opportunityId = task.opportunityId && opportunityIdSet.has(task.opportunityId)
      ? task.opportunityId
      : task.leadId
        ? leadOpportunityMap.get(task.leadId)
        : undefined;
    if (!opportunityId) continue;

    const dueTime = new Date(task.dueDate).getTime();
    const currentDueTime = nextTaskDueByOpportunity.get(opportunityId);
    if (currentDueTime === undefined || dueTime < currentDueTime) {
      nextTaskDueByOpportunity.set(opportunityId, dueTime);
    }
  }

  const buckets = new Map<string, PipelineOpportunity[]>(stages.map(s => [s.id, []]));
  for (const opp of allOpps) {
    if (opp.stageId) buckets.get(opp.stageId)?.push(opp);
  }

  for (const opportunities of buckets.values()) {
    opportunities.sort((a, b) => {
      const aDue = nextTaskDueByOpportunity.get(a.id);
      const bDue = nextTaskDueByOpportunity.get(b.id);
      if (aDue !== undefined && bDue !== undefined && aDue !== bDue) return aDue - bDue;
      if (aDue !== undefined && bDue === undefined) return -1;
      if (aDue === undefined && bDue !== undefined) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  const board: Record<string, { stage: PipelineStage; opportunities: PipelineOpportunity[] }> = {};
  for (const stage of stages) {
    board[stage.id] = { stage, opportunities: buckets.get(stage.id) ?? [] };
  }

  // Enrich board with compact snapshots for card display.
  const contactIds = [...new Set(allOpps.map(o => o.contactId).filter(Boolean) as string[])];
  const companyIds = [...new Set(allOpps.map(o => o.companyId).filter(Boolean) as string[])];
  const assigneeIds = includeAssigneeMap
    ? [...new Set(allOpps.map(o => o.assignedTo).filter(Boolean) as string[])]
    : [];

  const [leadRows, contactRows, companyRows, assigneeRows] = await Promise.all([
    leadIds.length
      ? db.select({ id: crmLeads.id, recycleCount: crmLeads.recycleCount, hungUpCount: crmLeads.hungUpCount }).from(crmLeads).where(inArray(crmLeads.id, leadIds))
      : [],
    contactIds.length
      ? db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName, phone: crmContacts.phone }).from(crmContacts).where(inArray(crmContacts.id, contactIds))
      : [],
    companyIds.length
      ? db.select({ id: crmCompanies.id, name: crmCompanies.name, city: crmCompanies.city, industry: crmCompanies.industry }).from(crmCompanies).where(inArray(crmCompanies.id, companyIds))
      : [],
    assigneeIds.length
      ? db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, assigneeIds))
      : [],
  ]);

  const leadRecycleMap: Record<string, { id: string; recycleCount: number; hungUpCount: number }> = Object.fromEntries(leadRows.map(l => [l.id, l]));
  const contactMap: Record<string, { id: string; firstName: string; lastName: string | null; phone: string | null }> = Object.fromEntries(contactRows.map(c => [c.id, c]));
  const companyMap: Record<string, { id: string; name: string; city: string | null; industry: string | null }> = Object.fromEntries(companyRows.map(c => [c.id, c]));
  const assigneeMap: Record<string, { id: string; name: string }> | undefined = includeAssigneeMap
    ? Object.fromEntries(assigneeRows.map(a => [a.id, a]))
    : undefined;

  return { stages, board, contactMap, companyMap, leadRecycleMap, ...(assigneeMap ? { assigneeMap } : {}) };
}

export async function getOpportunityById(id: string): Promise<PipelineOpportunity | undefined> {
  const [result] = await db.select().from(pipelineOpportunities).where(eq(pipelineOpportunities.id, id));
  return result;
}

export async function getOpportunityByLeadId(leadId: string): Promise<PipelineOpportunity | undefined> {
  const [result] = await db.select().from(pipelineOpportunities).where(eq(pipelineOpportunities.leadId, leadId));
  return result;
}

export async function createOpportunity(data: InsertPipelineOpportunity): Promise<PipelineOpportunity> {
  const [result] = await db.insert(pipelineOpportunities).values({
    ...data,
    stageEnteredAt: new Date(),
  }).returning();
  return result;
}

export async function updateOpportunity(id: string, data: Partial<InsertPipelineOpportunity>): Promise<PipelineOpportunity> {
  const [result] = await db.update(pipelineOpportunities).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(pipelineOpportunities.id, id)).returning();
  return result;
}

export async function moveOpportunity(
  id: string,
  newStageId: string,
  userId?: string
): Promise<{ opportunity: PipelineOpportunity; activity: PipelineActivity }> {
  const existing = await getOpportunityById(id);
  if (!existing) throw new Error("Opportunity not found");

  const oldStage = existing.stageId ? await getStageById(existing.stageId) : null;
  const newStage = await getStageById(newStageId);
  if (!newStage) throw new Error("Stage not found");

  const isClosed = newStage.isClosed;
  const newStatus = isClosed
    ? (newStage.slug === "closed-won" ? "won" : "lost")
    : "open";

  const opportunity = await updateOpportunity(id, {
    stageId: newStageId,
    stageEnteredAt: new Date(),
    status: newStatus,
  });

  const activity = await addActivity({
    opportunityId: id,
    userId: userId || null,
    type: "stage_change",
    content: `Moved from "${oldStage?.name || "None"}" to "${newStage.name}"`,
    metadata: {
      event: "stage_change",
      fromStageId: existing.stageId,
      fromStageName: oldStage?.name,
      fromStageSlug: oldStage?.slug ?? null,
      toStageId: newStageId,
      toStageName: newStage.name,
      toStageSlug: newStage.slug,
      newStatus,
    },
  });

  return { opportunity, activity };
}

export async function convertLeadToOpportunity(
  leadId: string,
  stageId: string,
  userId?: string,
  extraData?: Partial<InsertPipelineOpportunity>
): Promise<PipelineOpportunity> {
  const lead = await db.select().from(crmLeads).where(eq(crmLeads.id, leadId)).then(r => r[0]);
  if (!lead) throw new Error("Lead not found");

  const opportunity = await createOpportunity({
    title: extraData?.title || lead.title,
    value: extraData?.value || lead.value,
    stageId,
    leadId,
    companyId: lead.companyId,
    contactId: lead.contactId,
    assignedTo: extraData?.assignedTo || lead.assignedTo,
    status: "open",
    probability: extraData?.probability ?? 0,
    sourceLeadTitle: lead.title,
    notes: extraData?.notes || lead.notes,
    expectedCloseDate: extraData?.expectedCloseDate || null,
    nextActionDate: extraData?.nextActionDate || null,
    followUpDate: extraData?.followUpDate || null,
  });

  await addActivity({
    opportunityId: opportunity.id,
    userId: userId || null,
    type: "system",
    content: `Created from lead: "${lead.title}"`,
    metadata: { leadId, leadTitle: lead.title },
  });

  return opportunity;
}

export async function addActivity(data: InsertPipelineActivity): Promise<PipelineActivity> {
  const [result] = await db.insert(pipelineActivities).values(data).returning();
  return result;
}

export type ActivityWithAuthor = PipelineActivity & { authorName: string | null; isFromCrm?: boolean };

export async function getActivities(opportunityId: string): Promise<ActivityWithAuthor[]> {
  const [pipelineRows, opportunity] = await Promise.all([
    db
      .select({
        id: pipelineActivities.id,
        opportunityId: pipelineActivities.opportunityId,
        userId: pipelineActivities.userId,
        type: pipelineActivities.type,
        content: pipelineActivities.content,
        metadata: pipelineActivities.metadata,
        createdAt: pipelineActivities.createdAt,
        authorName: user.name,
      })
      .from(pipelineActivities)
      .leftJoin(user, eq(pipelineActivities.userId, user.id))
      .where(eq(pipelineActivities.opportunityId, opportunityId))
      .orderBy(desc(pipelineActivities.createdAt)),
    db
      .select({ leadId: pipelineOpportunities.leadId })
      .from(pipelineOpportunities)
      .where(eq(pipelineOpportunities.id, opportunityId))
      .then(r => r[0]),
  ]);

  let crmNoteRows: ActivityWithAuthor[] = [];
  if (opportunity?.leadId) {
    const notes = await db
      .select({
        id: crmLeadNotes.id,
        opportunityId: sql<string>`${opportunityId}`,
        userId: crmLeadNotes.userId,
        type: crmLeadNotes.type,
        content: crmLeadNotes.content,
        metadata: crmLeadNotes.metadata,
        createdAt: crmLeadNotes.createdAt,
        authorName: user.name,
      })
      .from(crmLeadNotes)
      .leftJoin(user, eq(crmLeadNotes.userId, user.id))
      .where(eq(crmLeadNotes.leadId, opportunity.leadId));
    crmNoteRows = notes.map(n => ({ ...n, isFromCrm: true })) as ActivityWithAuthor[];
  }

  const all = [...pipelineRows, ...crmNoteRows] as ActivityWithAuthor[];
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all;
}

export async function updateActivity(activityId: string, content: string): Promise<ActivityWithAuthor | null> {
  const [updated] = await db
    .update(pipelineActivities)
    .set({ content })
    .where(eq(pipelineActivities.id, activityId))
    .returning();
  if (!updated) return null;
  const [row] = await db
    .select({
      id: pipelineActivities.id,
      opportunityId: pipelineActivities.opportunityId,
      userId: pipelineActivities.userId,
      type: pipelineActivities.type,
      content: pipelineActivities.content,
      metadata: pipelineActivities.metadata,
      createdAt: pipelineActivities.createdAt,
      authorName: user.name,
    })
    .from(pipelineActivities)
    .leftJoin(user, eq(pipelineActivities.userId, user.id))
    .where(eq(pipelineActivities.id, activityId));
  return row as ActivityWithAuthor | null;
}

export async function getOpportunityCount(): Promise<number> {
  const [result] = await db.select({ total: count() }).from(pipelineOpportunities);
  return result?.total ?? 0;
}

export async function getPipelineStats() {
  const [stages, stageAgg] = await Promise.all([
    getStages(),
    db
      .select({
        stageId: pipelineOpportunities.stageId,
        count: count(),
        value: sql<string>`COALESCE(SUM(CAST(${pipelineOpportunities.value} AS NUMERIC)), 0)`,
      })
      .from(pipelineOpportunities)
      .where(eq(pipelineOpportunities.status, "open"))
      .groupBy(pipelineOpportunities.stageId),
  ]);

  const aggMap = new Map(stageAgg.map((r) => [r.stageId, r]));
  let totalOpen = 0;
  let totalValue = 0;

  const byStage = stages.map((stage) => {
    const agg = aggMap.get(stage.id);
    const stageCount = agg?.count ?? 0;
    const stageValue = parseFloat(agg?.value ?? "0");
    totalOpen += stageCount;
    totalValue += stageValue;
    return {
      stageId: stage.id,
      stageName: stage.name,
      stageSlug: stage.slug,
      count: stageCount,
      value: stageValue,
    };
  });

  return { totalOpen, totalValue, byStage };
}

export async function bulkAssignOpportunitiesByLeadIds(leadIds: string[], assignedTo: string | null): Promise<void> {
  if (leadIds.length === 0) return;
  await db.update(pipelineOpportunities)
    .set({ assignedTo, updatedAt: new Date() })
    .where(inArray(pipelineOpportunities.leadId, leadIds));
}
