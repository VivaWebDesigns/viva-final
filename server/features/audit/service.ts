import { db } from "../../db";
import { auditLogs, type InsertAuditLog } from "@shared/schema";

export async function logAudit(data: Omit<InsertAuditLog, "userId"> & { userId?: string | null }) {
  try {
    await db.insert(auditLogs).values({
      userId: data.userId || null,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId || null,
      metadata: data.metadata || null,
      ipAddress: data.ipAddress || null,
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
