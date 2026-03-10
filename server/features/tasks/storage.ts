import { db } from "../../db";
import {
  followupTasks, crmContacts, crmCompanies,
  type InsertFollowupTask, type FollowupTask,
} from "@shared/schema";
import { eq, and, gte, lte, lt, desc, asc, isNull, or } from "drizzle-orm";

export type TaskWithContact = FollowupTask & {
  contact: { firstName: string; lastName: string | null; phone: string | null } | null;
  company: { name: string } | null;
};

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getTasksDueToday(): Promise<TaskWithContact[]> {
  const { start, end } = todayRange();
  const tasks = await db.select().from(followupTasks)
    .where(and(
      eq(followupTasks.completed, false),
      gte(followupTasks.dueDate, start),
      lte(followupTasks.dueDate, end),
    ))
    .orderBy(asc(followupTasks.dueDate));
  return enrichTasks(tasks);
}

export async function getOverdueTasks(): Promise<TaskWithContact[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tasks = await db.select().from(followupTasks)
    .where(and(
      eq(followupTasks.completed, false),
      lt(followupTasks.dueDate, today),
    ))
    .orderBy(asc(followupTasks.dueDate));
  return enrichTasks(tasks);
}

export async function getTasksForOpportunity(opportunityId: string): Promise<FollowupTask[]> {
  return db.select().from(followupTasks)
    .where(eq(followupTasks.opportunityId, opportunityId))
    .orderBy(asc(followupTasks.dueDate));
}

export async function getTasksForLead(leadId: string): Promise<FollowupTask[]> {
  return db.select().from(followupTasks)
    .where(eq(followupTasks.leadId, leadId))
    .orderBy(asc(followupTasks.dueDate));
}

export async function getTasksForContact(contactId: string): Promise<FollowupTask[]> {
  return db.select().from(followupTasks)
    .where(eq(followupTasks.contactId, contactId))
    .orderBy(asc(followupTasks.dueDate));
}

export async function createTask(data: InsertFollowupTask): Promise<FollowupTask> {
  const [result] = await db.insert(followupTasks).values(data).returning();
  return result;
}

export async function updateTask(id: string, data: Partial<InsertFollowupTask & { completedAt: Date | null }>): Promise<FollowupTask> {
  const [result] = await db.update(followupTasks).set(data).where(eq(followupTasks.id, id)).returning();
  return result;
}

export async function completeTask(id: string): Promise<FollowupTask> {
  const [result] = await db.update(followupTasks)
    .set({ completed: true, completedAt: new Date() })
    .where(eq(followupTasks.id, id))
    .returning();
  return result;
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(followupTasks).where(eq(followupTasks.id, id));
}

async function enrichTasks(tasks: FollowupTask[]): Promise<TaskWithContact[]> {
  if (tasks.length === 0) return [];

  const contactIds = [...new Set(tasks.map(t => t.contactId).filter(Boolean) as string[])];
  const contacts = contactIds.length
    ? await db.select({ id: crmContacts.id, firstName: crmContacts.firstName, lastName: crmContacts.lastName, phone: crmContacts.phone, companyId: crmContacts.companyId }).from(crmContacts).where(
        or(...contactIds.map(id => eq(crmContacts.id, id)))
      )
    : [];

  const companyIds = [...new Set(contacts.map(c => c.companyId).filter(Boolean) as string[])];
  const companies = companyIds.length
    ? await db.select({ id: crmCompanies.id, name: crmCompanies.name }).from(crmCompanies).where(
        or(...companyIds.map(id => eq(crmCompanies.id, id)))
      )
    : [];

  const contactMap = Object.fromEntries(contacts.map(c => [c.id, c]));
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c]));

  return tasks.map(task => {
    const contact = task.contactId ? contactMap[task.contactId] ?? null : null;
    const company = contact?.companyId ? companyMap[contact.companyId] ?? null : null;
    return { ...task, contact, company };
  });
}
