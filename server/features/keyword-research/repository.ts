import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { keywordResearchProjects, type KeywordResearchProject } from "@shared/schema";

type ProjectChanges = Partial<Pick<KeywordResearchProject, "locationName" | "status" | "services" | "keywords" | "summary" | "researchedAt">>;

export async function createProject(values: Pick<KeywordResearchProject, "name" | "trade" | "city" | "state" | "locationName" | "website" | "websiteNote" | "services" | "createdBy">, cost: number) {
  const [project] = await db.insert(keywordResearchProjects).values({ ...values, dataCostUsd: cost.toFixed(4) }).returning();
  return project;
}

export async function listProjects(limit: number) {
  return db.select({
    id: keywordResearchProjects.id,
    name: keywordResearchProjects.name,
    trade: keywordResearchProjects.trade,
    city: keywordResearchProjects.city,
    state: keywordResearchProjects.state,
    status: keywordResearchProjects.status,
    keywordCount: sql<number>`jsonb_array_length(${keywordResearchProjects.keywords})`.mapWith(Number),
    createdAt: keywordResearchProjects.createdAt,
  }).from(keywordResearchProjects).orderBy(desc(keywordResearchProjects.createdAt)).limit(limit);
}

export async function getProject(id: string) {
  const [project] = await db.select().from(keywordResearchProjects).where(eq(keywordResearchProjects.id, id));
  return project;
}

export async function updateProject(id: string, changes: ProjectChanges, addedCost = 0) {
  const [project] = await db.update(keywordResearchProjects).set({
    ...changes,
    dataCostUsd: sql`${keywordResearchProjects.dataCostUsd} + ${addedCost.toFixed(4)}::numeric`,
    updatedAt: new Date(),
  }).where(eq(keywordResearchProjects.id, id)).returning();
  return project;
}

export async function deleteProject(id: string) {
  const deleted = await db.delete(keywordResearchProjects).where(eq(keywordResearchProjects.id, id)).returning({ id: keywordResearchProjects.id });
  return deleted.length > 0;
}
