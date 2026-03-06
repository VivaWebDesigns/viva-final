import { db } from "../../db";
import { integrationRecords, type InsertIntegrationRecord, type IntegrationRecord } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getIntegrations(): Promise<IntegrationRecord[]> {
  return db.select().from(integrationRecords).orderBy(integrationRecords.provider);
}

export async function getIntegrationByProvider(provider: string): Promise<IntegrationRecord | undefined> {
  const [result] = await db.select().from(integrationRecords).where(eq(integrationRecords.provider, provider));
  return result;
}

export async function createIntegration(data: InsertIntegrationRecord): Promise<IntegrationRecord> {
  const [result] = await db.insert(integrationRecords).values(data).returning();
  return result;
}

export async function updateIntegration(id: string, data: Partial<InsertIntegrationRecord>): Promise<IntegrationRecord> {
  const [result] = await db.update(integrationRecords).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(integrationRecords.id, id)).returning();
  return result;
}

export async function upsertIntegration(data: InsertIntegrationRecord): Promise<IntegrationRecord> {
  const existing = await getIntegrationByProvider(data.provider);
  if (existing) {
    return updateIntegration(existing.id, data);
  }
  return createIntegration(data);
}
