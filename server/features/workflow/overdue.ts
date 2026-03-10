import { db } from "../../db";
import {
  crmLeads, pipelineOpportunities, onboardingRecords, onboardingChecklistItems,
} from "@shared/schema";
import { eq, and, lt, isNotNull, isNull, lte, or, ne, inArray, sql } from "drizzle-orm";

export interface OverdueItem {
  id: string;
  title: string;
  overdueField?: string;
  overdueDate?: string;
  assignedTo?: string | null;
  entityType: "lead" | "opportunity" | "onboarding" | "checklist_item";
}

export interface OverdueSummary {
  staleLeads: { count: number; items: OverdueItem[] };
  overdueOpportunities: { count: number; items: OverdueItem[] };
  overdueOnboarding: { count: number; items: OverdueItem[] };
  overdueChecklistItems: { count: number; items: OverdueItem[] };
  totalCount: number;
}

const STALE_LEAD_DAYS = 30;

export async function getOverdueSummary(): Promise<OverdueSummary> {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_LEAD_DAYS * 24 * 60 * 60 * 1000);

  const [staleLeadsRaw, overdueOppsRaw, overdueOnboardingRaw, overdueChecklistRaw] =
    await Promise.all([
      // Stale leads: not updated in 30+ days, no linked opportunity
      db
        .select({
          id: crmLeads.id,
          title: crmLeads.title,
          assignedTo: crmLeads.assignedTo,
          updatedAt: crmLeads.updatedAt,
        })
        .from(crmLeads)
        .where(lt(crmLeads.updatedAt, staleThreshold))
        .limit(50),

      // Overdue opportunities: open, any date field is past
      db
        .select({
          id: pipelineOpportunities.id,
          title: pipelineOpportunities.title,
          assignedTo: pipelineOpportunities.assignedTo,
          expectedCloseDate: pipelineOpportunities.expectedCloseDate,
          nextActionDate: pipelineOpportunities.nextActionDate,
          followUpDate: pipelineOpportunities.followUpDate,
        })
        .from(pipelineOpportunities)
        .where(
          and(
            eq(pipelineOpportunities.status, "open"),
            or(
              and(isNotNull(pipelineOpportunities.expectedCloseDate), lte(pipelineOpportunities.expectedCloseDate, now)),
              and(isNotNull(pipelineOpportunities.nextActionDate), lte(pipelineOpportunities.nextActionDate, now)),
              and(isNotNull(pipelineOpportunities.followUpDate), lte(pipelineOpportunities.followUpDate, now))
            )
          )
        )
        .limit(50),

      // Overdue onboarding: pending or in_progress, past due date
      db
        .select({
          id: onboardingRecords.id,
          clientName: onboardingRecords.clientName,
          assignedTo: onboardingRecords.assignedTo,
          dueDate: onboardingRecords.dueDate,
          status: onboardingRecords.status,
        })
        .from(onboardingRecords)
        .where(
          and(
            inArray(onboardingRecords.status, ["pending", "in_progress"]),
            isNotNull(onboardingRecords.dueDate),
            lte(onboardingRecords.dueDate, now)
          )
        )
        .limit(50),

      // Overdue checklist items: not completed, past due date
      db
        .select({
          id: onboardingChecklistItems.id,
          label: onboardingChecklistItems.label,
          onboardingId: onboardingChecklistItems.onboardingId,
          dueDate: onboardingChecklistItems.dueDate,
        })
        .from(onboardingChecklistItems)
        .where(
          and(
            eq(onboardingChecklistItems.isCompleted, false),
            isNotNull(onboardingChecklistItems.dueDate),
            lte(onboardingChecklistItems.dueDate, now)
          )
        )
        .limit(50),
    ]);

  // Filter stale leads that have no linked opportunity
  const staleLeadIds = staleLeadsRaw.map((l) => l.id);
  let convertedLeadIds: Set<string> = new Set();
  if (staleLeadIds.length > 0) {
    const linked = await db
      .select({ leadId: pipelineOpportunities.leadId })
      .from(pipelineOpportunities)
      .where(
        and(
          isNotNull(pipelineOpportunities.leadId),
          inArray(pipelineOpportunities.leadId, staleLeadIds)
        )
      );
    convertedLeadIds = new Set(linked.map((r) => r.leadId!));
  }

  const staleLeadItems: OverdueItem[] = staleLeadsRaw
    .filter((l) => !convertedLeadIds.has(l.id))
    .map((l) => ({
      id: l.id,
      title: l.title,
      assignedTo: l.assignedTo,
      overdueField: "updatedAt",
      overdueDate: l.updatedAt?.toISOString(),
      entityType: "lead" as const,
    }));

  const overdueOppItems: OverdueItem[] = overdueOppsRaw.map((o) => {
    const overdueField =
      o.expectedCloseDate && o.expectedCloseDate <= now
        ? "expectedCloseDate"
        : o.nextActionDate && o.nextActionDate <= now
        ? "nextActionDate"
        : "followUpDate";
    const overdueDate =
      overdueField === "expectedCloseDate"
        ? o.expectedCloseDate?.toISOString()
        : overdueField === "nextActionDate"
        ? o.nextActionDate?.toISOString()
        : o.followUpDate?.toISOString();
    return {
      id: o.id,
      title: o.title,
      assignedTo: o.assignedTo,
      overdueField,
      overdueDate,
      entityType: "opportunity" as const,
    };
  });

  const overdueOnboardingItems: OverdueItem[] = overdueOnboardingRaw.map((r) => ({
    id: r.id,
    title: r.clientName,
    assignedTo: r.assignedTo,
    overdueField: "dueDate",
    overdueDate: r.dueDate?.toISOString(),
    entityType: "onboarding" as const,
  }));

  const overdueChecklistItemsResult: OverdueItem[] = overdueChecklistRaw.map((c) => ({
    id: c.id,
    title: c.label,
    overdueField: "dueDate",
    overdueDate: c.dueDate?.toISOString(),
    entityType: "checklist_item" as const,
  }));

  const totalCount =
    staleLeadItems.length +
    overdueOppItems.length +
    overdueOnboardingItems.length +
    overdueChecklistItemsResult.length;

  return {
    staleLeads: { count: staleLeadItems.length, items: staleLeadItems },
    overdueOpportunities: { count: overdueOppItems.length, items: overdueOppItems },
    overdueOnboarding: { count: overdueOnboardingItems.length, items: overdueOnboardingItems },
    overdueChecklistItems: { count: overdueChecklistItemsResult.length, items: overdueChecklistItemsResult },
    totalCount,
  };
}
