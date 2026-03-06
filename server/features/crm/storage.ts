import { db } from "../../db";
import {
  crmCompanies, crmContacts, crmLeadStatuses, crmLeads, crmLeadNotes,
  crmTags, crmLeadTags,
  type InsertCrmCompany, type InsertCrmContact, type InsertCrmLeadStatus,
  type InsertCrmLead, type InsertCrmLeadNote, type InsertCrmTag,
  type CrmCompany, type CrmContact, type CrmLeadStatus,
  type CrmLead, type CrmLeadNote, type CrmTag,
} from "@shared/schema";
import { eq, ilike, or, desc, asc, sql, and, count } from "drizzle-orm";

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
  return db.select().from(crmLeadNotes).where(eq(crmLeadNotes.leadId, leadId)).orderBy(desc(crmLeadNotes.createdAt));
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
  const [result] = await db.select().from(crmContacts).where(eq(crmContacts.phone, phone));
  return result;
}

export async function findCompanyByName(name: string): Promise<CrmCompany | undefined> {
  const [result] = await db.select().from(crmCompanies).where(ilike(crmCompanies.name, name));
  return result;
}

export async function getLeadStatusBySlug(slug: string): Promise<CrmLeadStatus | undefined> {
  const [result] = await db.select().from(crmLeadStatuses).where(eq(crmLeadStatuses.slug, slug));
  return result;
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
