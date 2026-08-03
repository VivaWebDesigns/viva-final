import { desc, inArray } from "drizzle-orm";
import { db } from "../../db";
import { localFalconProspectProfiles } from "@shared/schema";
import {
  parseSalesPriority,
  type SalesPrioritySnapshot,
} from "@shared/salesPriority";

export async function getLocalFalconPrioritiesByLeadIds(
  leadIds: string[],
): Promise<Record<string, SalesPrioritySnapshot>> {
  if (leadIds.length === 0) return {};

  const rows = await db
    .select({
      leadId: localFalconProspectProfiles.leadId,
      tier: localFalconProspectProfiles.tier,
      reason: localFalconProspectProfiles.pitchSummary,
    })
    .from(localFalconProspectProfiles)
    .where(inArray(localFalconProspectProfiles.leadId, leadIds))
    .orderBy(
      desc(localFalconProspectProfiles.scanDate),
      desc(localFalconProspectProfiles.createdAt),
    );

  const priorities: Record<string, SalesPrioritySnapshot> = {};
  for (const row of rows) {
    if (priorities[row.leadId]) continue;
    const priority = parseSalesPriority(row.tier);
    if (!priority) continue;
    priorities[row.leadId] = {
      priority,
      reason: row.reason?.trim() || null,
    };
  }

  return priorities;
}
