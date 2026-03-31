import { db } from "../../db";
import { normalizePhoneDigits } from "@shared/phone";
import {
  crmCompanies, crmContacts, crmLeadStatuses, crmLeads, crmLeadNotes,
  crmTags, crmLeadTags, pipelineOpportunities, pipelineStages, pipelineActivities, followupTasks, user,
  onboardingRecords, clientNotes, automationExecutionLogs,
  type InsertCrmCompany, type InsertCrmContact, type InsertCrmLeadStatus,
  type InsertCrmLead, type InsertCrmLeadNote, type InsertCrmTag,
  type CrmCompany, type CrmContact, type CrmLeadStatus,
  type CrmLead, type CrmLeadNote, type CrmTag,
} from "@shared/schema";
import { eq, ilike, or, desc, asc, sql, and, count, inArray } from "drizzle-orm";

export type EnrichedLead = CrmLead & {
  status: CrmLeadStatus | null;
  contact: CrmContact | null;
  company: CrmCompany | null;
};

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface LeadFilters extends PaginationParams {
  search?: string;
  statusId?: string;
  source?: string;
  assignedTo?: string;
  fromWebsiteForm?: boolean;
}

interface SearchParams extends PaginationParams {
  search?: string;
}

export async function getLeads(filters: LeadFilters = {}) {
  const { search, statusId, source, assignedTo, fromWebsiteForm, page = 1, limit = 50 } = filters;
  const offset = (page - 1) * limit;
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(crmLeads.title, `%${search}%`),
        ilike(crmLeads.notes, `%${search}%`)
      )
    );
  }
  if (statusId) conditions.push(eq(crmLeads.statusId, statusId));
  if (source) conditions.push(eq(crmLeads.source, source));
  if (assignedTo) conditions.push(eq(crmLeads.assignedTo, assignedTo));
  if (fromWebsiteForm !== undefined) conditions.push(eq(crmLeads.fromWebsiteForm, fromWebsiteForm));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, totalResult] = await Promise.all([
    where
      ? db.select().from(crmLeads).where(where).orderBy(desc(crmLeads.createdAt)).limit(limit).offset(offset)
      : db.select().from(crmLeads).orderBy(desc(crmLeads.createdAt)).limit(limit).offset(offset),
    where
      ? db.select({ total: count() }).from(crmLeads).where(where)
      : db.select({ total: count() }).from(crmLeads),
  ]);

  return { items, total: totalResult[0]?.total ?? 0, page, limit };
}

export async function getLeadById(id: string): Promise<CrmLead | undefined> {
  const [result] = await db.select().from(crmLeads).where(eq(crmLeads.id, id));
  return result;
}

export async function createLead(data: InsertCrmLead): Promise<CrmLead> {
  const [result] = await db.insert(crmLeads).values(data).returning();
  return result;
}

export async function updateLead(id: string, data: Partial<InsertCrmLead>): Promise<CrmLead> {
  const [result] = await db.update(crmLeads).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(crmLeads.id, id)).returning();
  return result;
}

export async function getCompanies(params: SearchParams = {}) {
  const { search, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  const where = search
    ? or(
        ilike(crmCompanies.name, `%${search}%`),
        ilike(crmCompanies.dba, `%${search}%`),
        ilike(crmCompanies.email, `%${search}%`),
        ilike(crmCompanies.phone, `%${search}%`)
      )
    : undefined;

  const [items, totalResult] = await Promise.all([
    where
      ? db.select().from(crmCompanies).where(where).orderBy(desc(crmCompanies.createdAt)).limit(limit).offset(offset)
      : db.select().from(crmCompanies).orderBy(desc(crmCompanies.createdAt)).limit(limit).offset(offset),
    where
      ? db.select({ total: count() }).from(crmCompanies).where(where)
      : db.select({ total: count() }).from(crmCompanies),
  ]);

  return { items, total: totalResult[0]?.total ?? 0, page, limit };
}

export async function getCompanyById(id: string): Promise<CrmCompany | undefined> {
  const [result] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, id));
  return result;
}

export async function createCompany(data: InsertCrmCompany): Promise<CrmCompany> {
  const [result] = await db.insert(crmCompanies).values(data).returning();
  return result;
}

export async function updateCompany(id: string, data: Partial<InsertCrmCompany>): Promise<CrmCompany> {
  const [result] = await db.update(crmCompanies).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(crmCompanies.id, id)).returning();
  return result;
}

export async function getContacts(params: SearchParams = {}) {
  const { search, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  const where = search
    ? or(
        ilike(crmContacts.firstName, `%${search}%`),
        ilike(crmContacts.lastName, `%${search}%`),
        ilike(crmContacts.email, `%${search}%`),
        ilike(crmContacts.phone, `%${search}%`)
      )
    : undefined;

  const [items, totalResult] = await Promise.all([
    where
      ? db.select().from(crmContacts).where(where).orderBy(desc(crmContacts.createdAt)).limit(limit).offset(offset)
      : db.select().from(crmContacts).orderBy(desc(crmContacts.createdAt)).limit(limit).offset(offset),
    where
      ? db.select({ total: count() }).from(crmContacts).where(where)
      : db.select({ total: count() }).from(crmContacts),
  ]);

  return { items, total: totalResult[0]?.total ?? 0, page, limit };
}

export async function getContactById(id: string): Promise<CrmContact | undefined> {
  const [result] = await db.select().from(crmContacts).where(eq(crmContacts.id, id));
  return result;
}

export async function createContact(data: InsertCrmContact): Promise<CrmContact> {
  const [result] = await db.insert(crmContacts).values(data).returning();
  return result;
}

export async function updateContact(id: string, data: Partial<InsertCrmContact>): Promise<CrmContact> {
  const [result] = await db.update(crmContacts).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(crmContacts.id, id)).returning();
  return result;
}

export async function getLeadStatuses(): Promise<CrmLeadStatus[]> {
  return db.select().from(crmLeadStatuses).orderBy(asc(crmLeadStatuses.sortOrder));
}

export async function createLeadStatus(data: InsertCrmLeadStatus): Promise<CrmLeadStatus> {
  const [result] = await db.insert(crmLeadStatuses).values(data).returning();
  return result;
}

export async function updateLeadStatus(id: string, data: Partial<InsertCrmLeadStatus>): Promise<CrmLeadStatus> {
  const [result] = await db.update(crmLeadStatuses).set(data).where(eq(crmLeadStatuses.id, id)).returning();
  return result;
}

export async function addLeadNote(data: InsertCrmLeadNote): Promise<CrmLeadNote> {
  const [result] = await db.insert(crmLeadNotes).values(data).returning();
  return result;
}

export async function getLeadNotes(leadId: string): Promise<CrmLeadNote[]> {
  const [ownNotes, opp] = await Promise.all([
    db.select().from(crmLeadNotes).where(eq(crmLeadNotes.leadId, leadId)),
    db.select({ id: pipelineOpportunities.id })
      .from(pipelineOpportunities)
      .where(eq(pipelineOpportunities.leadId, leadId))
      .then(r => r[0]),
  ]);

  let mappedActivities: CrmLeadNote[] = [];
  if (opp) {
    const pipelineRows = await db
      .select()
      .from(pipelineActivities)
      .where(eq(pipelineActivities.opportunityId, opp.id));
    mappedActivities = pipelineRows.map(a => ({
      id: a.id,
      leadId,
      userId: a.userId,
      type: a.type,
      content: a.content,
      metadata: a.metadata,
      createdAt: a.createdAt,
    })) as CrmLeadNote[];
  }

  const all = [...ownNotes, ...mappedActivities];
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all;
}

export async function getLeadTags(leadId: string): Promise<CrmTag[]> {
  const result = await db
    .select({ id: crmTags.id, name: crmTags.name, slug: crmTags.slug, color: crmTags.color })
    .from(crmLeadTags)
    .innerJoin(crmTags, eq(crmLeadTags.tagId, crmTags.id))
    .where(eq(crmLeadTags.leadId, leadId));
  return result;
}

export async function setLeadTags(leadId: string, tagIds: string[]): Promise<void> {
  await db.delete(crmLeadTags).where(eq(crmLeadTags.leadId, leadId));
  if (tagIds.length > 0) {
    await db.insert(crmLeadTags).values(tagIds.map(tagId => ({ leadId, tagId })));
  }
}

export async function getTags(): Promise<CrmTag[]> {
  return db.select().from(crmTags).orderBy(asc(crmTags.name));
}

export async function createTag(data: InsertCrmTag): Promise<CrmTag> {
  const [result] = await db.insert(crmTags).values(data).returning();
  return result;
}

export async function findContactByEmail(email: string): Promise<CrmContact | undefined> {
  const [result] = await db.select().from(crmContacts).where(eq(crmContacts.email, email));
  return result;
}

export async function findContactByPhone(phone: string): Promise<CrmContact | undefined> {
  const normalized = normalizePhoneDigits(phone);
  // Strip non-digits from the stored column value and compare to normalized input.
  // This matches both new records (stored as "7045551234") and legacy records
  // stored with formatting (e.g. "(704) 555-1234") without requiring a migration.
  const [result] = await db
    .select()
    .from(crmContacts)
    .where(sql`regexp_replace(${crmContacts.phone}, '[^0-9]', '', 'g') = ${normalized}`);
  return result;
}

export async function findCompanyByName(name: string): Promise<CrmCompany | undefined> {
  const [result] = await db
    .select()
    .from(crmCompanies)
    .where(ilike(crmCompanies.name, name.trim()))
    .limit(1);
  return result;
}

export async function getLeadStatusBySlug(slug: string): Promise<CrmLeadStatus | undefined> {
  const [result] = await db.select().from(crmLeadStatuses).where(eq(crmLeadStatuses.slug, slug));
  return result;
}

export interface DuplicateMatchSummary {
  name: string;
  businessName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  assignedRepName: string | null;
  stageName: string | null;
}

export type DuplicateCheckResult =
  | { isDuplicate: false }
  | { isDuplicate: true; match: DuplicateMatchSummary };

function rowToMatchSummary(row: {
  contactFirstName: string;
  contactLastName: string | null;
  contactPhone: string | null;
  companyName: string | null;
  leadCity: string | null;
  leadState: string | null;
  repName: string | null;
  stageName: string | null;
}): DuplicateMatchSummary {
  return {
    name: `${row.contactFirstName}${row.contactLastName ? " " + row.contactLastName : ""}`,
    businessName: row.companyName,
    phone: row.contactPhone,
    city: row.leadCity,
    state: row.leadState,
    assignedRepName: row.repName,
    stageName: row.stageName,
  };
}

// Shared select shape used by all three duplicate-check queries
const dupSelectShape = {
  contactFirstName: crmContacts.firstName,
  contactLastName:  crmContacts.lastName,
  contactPhone:     crmContacts.phone,
  companyName:      crmCompanies.name,
  leadCity:         crmLeads.city,
  leadState:        crmLeads.state,
  repName:          user.name,
  stageName:        pipelineStages.name,
};

export async function checkManualLeadDuplicate(params: {
  normalizedPhone: string;
  firstName: string;
  lastName: string;
  businessName?: string;
  state: string;
  source?: string;
  sellerProfileUrl?: string;
}): Promise<DuplicateCheckResult> {
  const { normalizedPhone, firstName, lastName, businessName, state, source, sellerProfileUrl } = params;

  // Rule 1: Exact normalized phone match
  const [phoneHit] = await db
    .select(dupSelectShape)
    .from(crmLeads)
    .innerJoin(crmContacts,          eq(crmLeads.contactId,             crmContacts.id))
    .leftJoin(crmCompanies,          eq(crmLeads.companyId,             crmCompanies.id))
    .leftJoin(user,                  eq(crmLeads.assignedTo,            user.id))
    .leftJoin(pipelineOpportunities, eq(pipelineOpportunities.leadId,   crmLeads.id))
    .leftJoin(pipelineStages,        eq(pipelineOpportunities.stageId,  pipelineStages.id))
    .where(sql`regexp_replace(${crmContacts.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`)
    .limit(1);
  if (phoneHit) return { isDuplicate: true, match: rowToMatchSummary(phoneHit) };

  // Rule 1.5: Same seller profile URL (outreach only, non-empty)
  const trimmedUrl = sellerProfileUrl?.trim().toLowerCase();
  if (source === "outreach" && trimmedUrl) {
    const [urlHit] = await db
      .select(dupSelectShape)
      .from(crmLeads)
      .innerJoin(crmContacts,          eq(crmLeads.contactId,             crmContacts.id))
      .leftJoin(crmCompanies,          eq(crmLeads.companyId,             crmCompanies.id))
      .leftJoin(user,                  eq(crmLeads.assignedTo,            user.id))
      .leftJoin(pipelineOpportunities, eq(pipelineOpportunities.leadId,   crmLeads.id))
      .leftJoin(pipelineStages,        eq(pipelineOpportunities.stageId,  pipelineStages.id))
      .where(
        and(
          sql`lower(trim(${crmLeads.sellerProfileUrl})) = ${trimmedUrl}`,
          eq(crmLeads.source, "outreach")
        )
      )
      .limit(1);
    if (urlHit) return { isDuplicate: true, match: rowToMatchSummary(urlHit) };
  }

  // Rule 2: Same first name + last name + state (case-insensitive, whitespace-collapsed)
  const nFirst = firstName.trim().replace(/\s+/g, " ").toLowerCase();
  const nLast  = lastName.trim().replace(/\s+/g,  " ").toLowerCase();
  const nState = state.trim().toLowerCase();

  const [nameHit] = await db
    .select(dupSelectShape)
    .from(crmLeads)
    .innerJoin(crmContacts,          eq(crmLeads.contactId,             crmContacts.id))
    .leftJoin(crmCompanies,          eq(crmLeads.companyId,             crmCompanies.id))
    .leftJoin(user,                  eq(crmLeads.assignedTo,            user.id))
    .leftJoin(pipelineOpportunities, eq(pipelineOpportunities.leadId,   crmLeads.id))
    .leftJoin(pipelineStages,        eq(pipelineOpportunities.stageId,  pipelineStages.id))
    .where(
      and(
        sql`lower(trim(${crmContacts.firstName})) = ${nFirst}`,
        sql`lower(trim(${crmContacts.lastName}))  = ${nLast}`,
        sql`lower(trim(${crmLeads.state}))         = ${nState}`
      )
    )
    .limit(1);
  if (nameHit) return { isDuplicate: true, match: rowToMatchSummary(nameHit) };

  // Rule 3: Same business name + state (only when a business name is provided)
  const trimmedBiz = businessName?.trim().replace(/\s+/g, " ").toLowerCase();
  if (trimmedBiz) {
    const [bizHit] = await db
      .select(dupSelectShape)
      .from(crmLeads)
      .innerJoin(crmContacts,          eq(crmLeads.contactId,             crmContacts.id))
      .innerJoin(crmCompanies,          eq(crmLeads.companyId,             crmCompanies.id))
      .leftJoin(user,                   eq(crmLeads.assignedTo,            user.id))
      .leftJoin(pipelineOpportunities,  eq(pipelineOpportunities.leadId,   crmLeads.id))
      .leftJoin(pipelineStages,         eq(pipelineOpportunities.stageId,  pipelineStages.id))
      .where(
        and(
          sql`lower(trim(regexp_replace(${crmCompanies.name}, '\\s+', ' ', 'g'))) = ${trimmedBiz}`,
          sql`lower(trim(${crmLeads.state})) = ${nState}`
        )
      )
      .limit(1);
    if (bizHit) return { isDuplicate: true, match: rowToMatchSummary(bizHit) };
  }

  return { isDuplicate: false };
}

export async function getDefaultLeadStatus(): Promise<CrmLeadStatus | undefined> {
  const [result] = await db.select().from(crmLeadStatuses).where(eq(crmLeadStatuses.isDefault, true));
  return result;
}

export async function upsertLeadStatus(data: InsertCrmLeadStatus): Promise<CrmLeadStatus> {
  const existing = await getLeadStatusBySlug(data.slug);
  if (existing) return existing;
  return createLeadStatus(data);
}

export async function getLeadCount(): Promise<number> {
  const [result] = await db.select({ total: count() }).from(crmLeads);
  return result?.total ?? 0;
}

export async function enrichLeads(leads: CrmLead[]): Promise<EnrichedLead[]> {
  if (leads.length === 0) return [];

  const statusIds = [...new Set(leads.map(l => l.statusId).filter((id): id is string => id !== null))];
  const contactIds = [...new Set(leads.map(l => l.contactId).filter((id): id is string => id !== null))];
  const companyIds = [...new Set(leads.map(l => l.companyId).filter((id): id is string => id !== null))];

  const [statuses, contacts, companies] = await Promise.all([
    statusIds.length > 0 ? db.select().from(crmLeadStatuses).where(inArray(crmLeadStatuses.id, statusIds)) : [],
    contactIds.length > 0 ? db.select().from(crmContacts).where(inArray(crmContacts.id, contactIds)) : [],
    companyIds.length > 0 ? db.select().from(crmCompanies).where(inArray(crmCompanies.id, companyIds)) : [],
  ]);

  const statusMap = Object.fromEntries(statuses.map(s => [s.id, s]));
  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]));

  return leads.map(lead => ({
    ...lead,
    status: lead.statusId ? statusMap[lead.statusId] ?? null : null,
    contact: lead.contactId ? contactMap[lead.contactId] ?? null : null,
    company: lead.companyId ? companyMap[lead.companyId] ?? null : null,
  }));
}

export async function getAssignableUsers(): Promise<{ id: string; name: string; email: string; role: string }[]> {
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.banned, false))
    .orderBy(asc(user.name));
  return rows;
}

export async function bulkAssignLeads(ids: string[], assignedTo: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  await db.update(crmLeads)
    .set({ assignedTo, updatedAt: new Date() })
    .where(inArray(crmLeads.id, ids));
  return ids.length;
}

export async function bulkUpdateLeadStatus(ids: string[], statusId: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  await db.update(crmLeads)
    .set({ statusId, updatedAt: new Date() })
    .where(inArray(crmLeads.id, ids));
  return ids.length;
}

export async function bulkAddTagsToLeads(ids: string[], tagIds: string[]): Promise<void> {
  if (ids.length === 0 || tagIds.length === 0) return;
  const pairs = ids.flatMap(leadId => tagIds.map(tagId => ({ leadId, tagId })));
  await db.insert(crmLeadTags).values(pairs).onConflictDoNothing();
}

export async function bulkRemoveTagsFromLeads(ids: string[], tagIds: string[]): Promise<void> {
  if (ids.length === 0 || tagIds.length === 0) return;
  await db.delete(crmLeadTags)
    .where(and(inArray(crmLeadTags.leadId, ids), inArray(crmLeadTags.tagId, tagIds)));
}

export async function bulkDeleteLeads(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  await db.transaction(async (tx) => {
    const leadsToDelete = await tx
      .select({ companyId: crmLeads.companyId, contactId: crmLeads.contactId })
      .from(crmLeads)
      .where(inArray(crmLeads.id, ids));
    const companyIds = [...new Set(
      leadsToDelete.map(l => l.companyId).filter((c): c is string => c !== null)
    )];
    const contactIds = [...new Set(
      leadsToDelete.map(l => l.contactId).filter((c): c is string => c !== null)
    )];

    await tx.delete(crmLeadTags).where(inArray(crmLeadTags.leadId, ids));
    await tx.delete(crmLeadNotes).where(inArray(crmLeadNotes.leadId, ids));

    const tasksToDelete = await tx
      .select({ id: followupTasks.id })
      .from(followupTasks)
      .where(inArray(followupTasks.leadId, ids));
    const taskIdsToDelete = tasksToDelete.map(t => t.id);
    if (taskIdsToDelete.length > 0) {
      await tx
        .update(automationExecutionLogs)
        .set({ generatedTaskId: null })
        .where(inArray(automationExecutionLogs.generatedTaskId, taskIdsToDelete));
    }
    await tx.delete(followupTasks).where(inArray(followupTasks.leadId, ids));

    const oppsToDelete = await tx
      .select({ id: pipelineOpportunities.id })
      .from(pipelineOpportunities)
      .where(inArray(pipelineOpportunities.leadId, ids));
    const oppIds = oppsToDelete.map(o => o.id);
    if (oppIds.length > 0) {
      await tx.delete(pipelineActivities).where(inArray(pipelineActivities.opportunityId, oppIds));

      const oppTasksToDelete = await tx
        .select({ id: followupTasks.id })
        .from(followupTasks)
        .where(inArray(followupTasks.opportunityId, oppIds));
      const oppTaskIds = oppTasksToDelete.map(t => t.id);
      if (oppTaskIds.length > 0) {
        await tx
          .update(automationExecutionLogs)
          .set({ generatedTaskId: null })
          .where(inArray(automationExecutionLogs.generatedTaskId, oppTaskIds));
        await tx.delete(followupTasks).where(inArray(followupTasks.id, oppTaskIds));
      }

      await tx.update(onboardingRecords).set({ opportunityId: null }).where(inArray(onboardingRecords.opportunityId, oppIds));
      await tx.update(automationExecutionLogs).set({ opportunityId: null }).where(inArray(automationExecutionLogs.opportunityId, oppIds));
    }

    await tx.update(automationExecutionLogs).set({ leadId: null }).where(inArray(automationExecutionLogs.leadId, ids));
    await tx.delete(pipelineOpportunities).where(inArray(pipelineOpportunities.leadId, ids));
    await tx.delete(crmLeads).where(inArray(crmLeads.id, ids));

    for (const companyId of companyIds) {
      const [remainingLeads] = await tx
        .select({ n: count() })
        .from(crmLeads)
        .where(eq(crmLeads.companyId, companyId));
      if ((remainingLeads?.n ?? 0) > 0) continue;

      const [hasOnboarding] = await tx
        .select({ n: count() })
        .from(onboardingRecords)
        .where(eq(onboardingRecords.companyId, companyId));
      if ((hasOnboarding?.n ?? 0) > 0) continue;

      await tx.delete(clientNotes).where(eq(clientNotes.companyId, companyId));
      await tx.update(crmContacts).set({ companyId: null }).where(eq(crmContacts.companyId, companyId));
      await tx.update(followupTasks).set({ companyId: null }).where(eq(followupTasks.companyId, companyId));
      await tx.update(pipelineOpportunities).set({ companyId: null }).where(eq(pipelineOpportunities.companyId, companyId));
      await tx.delete(crmCompanies).where(eq(crmCompanies.id, companyId));
    }

    for (const contactId of contactIds) {
      const [remainingLeads] = await tx
        .select({ n: count() })
        .from(crmLeads)
        .where(eq(crmLeads.contactId, contactId));
      if ((remainingLeads?.n ?? 0) > 0) continue;

      const [remainingOpps] = await tx
        .select({ n: count() })
        .from(pipelineOpportunities)
        .where(eq(pipelineOpportunities.contactId, contactId));
      if ((remainingOpps?.n ?? 0) > 0) continue;

      const [remainingOnboarding] = await tx
        .select({ n: count() })
        .from(onboardingRecords)
        .where(eq(onboardingRecords.contactId, contactId));
      if ((remainingOnboarding?.n ?? 0) > 0) continue;

      // No active anchors remain — delete any tasks that are solely tied to
      // this contact (no leadId, no opportunityId) before removing the row.
      await tx.delete(followupTasks)
        .where(and(
          eq(followupTasks.contactId, contactId),
          sql`${followupTasks.leadId} IS NULL`,
          sql`${followupTasks.opportunityId} IS NULL`,
        ));

      // Guard: skip if tasks with independent anchors still reference this contact.
      const [remainingTasks] = await tx
        .select({ n: count() })
        .from(followupTasks)
        .where(eq(followupTasks.contactId, contactId));
      if ((remainingTasks?.n ?? 0) > 0) continue;

      await tx.delete(crmContacts).where(eq(crmContacts.id, contactId));
    }
  });
  return ids.length;
}
