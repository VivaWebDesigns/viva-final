import { db } from "../../db";
import {
  onboardingRecords, onboardingChecklistItems, onboardingNotes, onboardingTemplates,
  pipelineOpportunities, crmCompanies, crmContacts,
  type InsertOnboardingRecord, type OnboardingRecord,
  type InsertOnboardingChecklistItem, type OnboardingChecklistItem,
  type InsertOnboardingNote, type OnboardingNote,
  type OnboardingTemplate,
} from "@shared/schema";
import { eq, desc, and, like, sql, count } from "drizzle-orm";

export async function getTemplates(): Promise<OnboardingTemplate[]> {
  return db.select().from(onboardingTemplates).orderBy(onboardingTemplates.name);
}

export async function getTemplateById(id: string): Promise<OnboardingTemplate | undefined> {
  const [result] = await db.select().from(onboardingTemplates).where(eq(onboardingTemplates.id, id));
  return result;
}

export async function getTemplateBySlug(slug: string): Promise<OnboardingTemplate | undefined> {
  const [result] = await db.select().from(onboardingTemplates).where(eq(onboardingTemplates.slug, slug));
  return result;
}

export async function upsertTemplate(data: { name: string; slug: string; description?: string; items: any[] }): Promise<OnboardingTemplate> {
  const existing = await getTemplateBySlug(data.slug);
  if (existing) return existing;
  const [result] = await db.insert(onboardingTemplates).values(data).returning();
  return result;
}

export async function getRecords(filters?: {
  status?: string;
  search?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}): Promise<{ records: OnboardingRecord[]; total: number }> {
  const page = filters?.page || 1;
  const limit = filters?.limit || 25;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filters?.status) conditions.push(eq(onboardingRecords.status, filters.status));
  if (filters?.search) conditions.push(like(onboardingRecords.clientName, `%${filters.search}%`));
  if (filters?.assignedTo) conditions.push(eq(onboardingRecords.assignedTo, filters.assignedTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [records, totalResult] = await Promise.all([
    db.select().from(onboardingRecords)
      .where(where)
      .orderBy(desc(onboardingRecords.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(onboardingRecords).where(where),
  ]);

  return { records, total: totalResult[0]?.count || 0 };
}

export async function getRecordById(id: string): Promise<OnboardingRecord | undefined> {
  const [result] = await db.select().from(onboardingRecords).where(eq(onboardingRecords.id, id));
  return result;
}

export async function createRecord(data: InsertOnboardingRecord): Promise<OnboardingRecord> {
  const [result] = await db.insert(onboardingRecords).values(data).returning();
  return result;
}

export async function updateRecord(id: string, data: Partial<InsertOnboardingRecord>): Promise<OnboardingRecord> {
  const [result] = await db.update(onboardingRecords)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(onboardingRecords.id, id))
    .returning();
  return result;
}

export async function deleteRecord(id: string): Promise<void> {
  await db.delete(onboardingRecords).where(eq(onboardingRecords.id, id));
}

export async function getChecklistItems(onboardingId: string): Promise<OnboardingChecklistItem[]> {
  return db.select().from(onboardingChecklistItems)
    .where(eq(onboardingChecklistItems.onboardingId, onboardingId))
    .orderBy(onboardingChecklistItems.sortOrder);
}

export async function createChecklistItem(data: InsertOnboardingChecklistItem): Promise<OnboardingChecklistItem> {
  const [result] = await db.insert(onboardingChecklistItems).values(data).returning();
  return result;
}

export async function updateChecklistItem(id: string, data: Partial<InsertOnboardingChecklistItem>): Promise<OnboardingChecklistItem> {
  const [result] = await db.update(onboardingChecklistItems)
    .set(data)
    .where(eq(onboardingChecklistItems.id, id))
    .returning();
  return result;
}

export async function toggleChecklistItem(
  id: string,
  userId?: string
): Promise<OnboardingChecklistItem> {
  const [existing] = await db.select().from(onboardingChecklistItems).where(eq(onboardingChecklistItems.id, id));
  if (!existing) throw new Error("Checklist item not found");

  const isCompleted = !existing.isCompleted;
  const [result] = await db.update(onboardingChecklistItems)
    .set({
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      completedBy: isCompleted ? userId || null : null,
    })
    .where(eq(onboardingChecklistItems.id, id))
    .returning();
  return result;
}

export async function createChecklistItemsBulk(
  onboardingId: string,
  items: Array<{ category: string; label: string; description?: string; isRequired?: boolean; sortOrder: number; dueDate?: Date | null }>
): Promise<OnboardingChecklistItem[]> {
  if (items.length === 0) return [];
  const values = items.map((item) => ({
    onboardingId,
    category: item.category,
    label: item.label,
    description: item.description || null,
    isRequired: item.isRequired !== false,
    sortOrder: item.sortOrder,
    dueDate: item.dueDate || null,
  }));
  return db.insert(onboardingChecklistItems).values(values).returning();
}

export async function getNotes(onboardingId: string): Promise<OnboardingNote[]> {
  return db.select().from(onboardingNotes)
    .where(eq(onboardingNotes.onboardingId, onboardingId))
    .orderBy(desc(onboardingNotes.createdAt));
}

export async function addNote(data: InsertOnboardingNote): Promise<OnboardingNote> {
  const [result] = await db.insert(onboardingNotes).values(data).returning();
  return result;
}

export async function getProgress(onboardingId: string): Promise<{ total: number; completed: number; percentage: number }> {
  const items = await getChecklistItems(onboardingId);
  const total = items.length;
  const completed = items.filter((i) => i.isCompleted).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage };
}

export async function getRecordByOpportunityId(opportunityId: string): Promise<OnboardingRecord | undefined> {
  const [result] = await db.select().from(onboardingRecords).where(eq(onboardingRecords.opportunityId, opportunityId));
  return result;
}

export async function convertOpportunityToOnboarding(
  opportunityId: string,
  templateId: string | null,
  userId?: string,
  extraData?: Partial<InsertOnboardingRecord>
): Promise<OnboardingRecord> {
  const [opp] = await db.select().from(pipelineOpportunities).where(eq(pipelineOpportunities.id, opportunityId));
  if (!opp) throw new Error("Opportunity not found");
  if (opp.status !== "won") throw new Error("Only won opportunities can be converted to onboarding");
  const existing = await getRecordByOpportunityId(opportunityId);
  if (existing) throw new Error("An onboarding record already exists for this opportunity");

  let clientName = extraData?.clientName || opp.title;
  if (opp.companyId) {
    const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, opp.companyId));
    if (company) clientName = company.name;
  }

  const record = await createRecord({
    clientName,
    status: "pending",
    opportunityId,
    companyId: opp.companyId,
    contactId: opp.contactId,
    assignedTo: extraData?.assignedTo || opp.assignedTo,
    templateId,
    kickoffDate: extraData?.kickoffDate || null,
    dueDate: extraData?.dueDate || null,
    notes: extraData?.notes || null,
  });

  if (templateId) {
    const template = await getTemplateById(templateId);
    if (template && Array.isArray(template.items)) {
      await createChecklistItemsBulk(record.id, (template.items as any[]).map((item: any, idx: number) => ({
        category: item.category,
        label: item.label,
        description: item.description,
        isRequired: item.isRequired !== false,
        sortOrder: idx,
      })));
    }
  }

  await addNote({
    onboardingId: record.id,
    userId: userId || null,
    type: "system",
    content: `Onboarding created from opportunity: "${opp.title}"`,
    metadata: { opportunityId, opportunityTitle: opp.title },
  });

  return record;
}

export async function getOnboardingStats(): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  onHold: number;
  overdue: number;
}> {
  const [statusCounts, overdueResult] = await Promise.all([
    db
      .select({
        status: onboardingRecords.status,
        count: count(),
      })
      .from(onboardingRecords)
      .groupBy(onboardingRecords.status),
    db
      .select({ count: count() })
      .from(onboardingRecords)
      .where(
        and(
          sql`${onboardingRecords.dueDate} IS NOT NULL`,
          sql`${onboardingRecords.dueDate} < NOW()`,
          sql`${onboardingRecords.status} != 'completed'`
        )
      ),
  ]);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    byStatus[row.status] = row.count;
    total += row.count;
  }

  return {
    total,
    pending: byStatus["pending"] ?? 0,
    inProgress: byStatus["in_progress"] ?? 0,
    completed: byStatus["completed"] ?? 0,
    onHold: byStatus["on_hold"] ?? 0,
    overdue: overdueResult[0]?.count ?? 0,
  };
}
