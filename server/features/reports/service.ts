/**
 * Reports Service
 *
 * Metric Definitions:
 * ─────────────────────────────────────────────────────────────────────────────
 * Conversion Rate     = leads that have at least one pipeline opportunity
 *                       / total leads in the date range × 100
 *                       (a lead is "converted" when it becomes an opportunity)
 *
 * Pipeline Value      = sum of `pipelineOpportunities.value` for ALL non-closed
 *                       opportunities. Null values treated as $0.
 *
 * Open Pipeline Value = same, filtered to status = 'open'
 *
 * Win Rate            = won opportunities / (won + lost) × 100
 *                       (only counts closed outcomes, not open/stale)
 *
 * Overdue Leads       = leads whose followUpDate is in the past and whose
 *                       status is not a terminal status (won/lost). These
 *                       need follow-up action from the sales team.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from "../../db";
import {
  crmLeads, crmLeadStatuses, pipelineOpportunities, pipelineStages,
  onboardingRecords, onboardingChecklistItems, notifications,
} from "@shared/schema";
import { sql, eq, and, gte, count, sum, lt } from "drizzle-orm";

interface DateRange {
  from?: Date;
  to?: Date;
}

function dateFilter(column: any, range?: DateRange) {
  const conditions = [];
  if (range?.from) conditions.push(gte(column, range.from));
  if (range?.to) conditions.push(sql`${column} < ${range.to}`);
  return conditions;
}

export async function getLeadsBySource(range?: DateRange) {
  const conditions = dateFilter(crmLeads.createdAt, range);
  const rows = await db
    .select({
      source: sql<string>`COALESCE(${crmLeads.source}, 'unknown')`,
      sourceLabel: sql<string>`COALESCE(${crmLeads.sourceLabel}, ${crmLeads.source}, 'Unknown')`,
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`COALESCE(sum(${crmLeads.value}::numeric), 0)::float`,
    })
    .from(crmLeads)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(sql`COALESCE(${crmLeads.source}, 'unknown')`, sql`COALESCE(${crmLeads.sourceLabel}, ${crmLeads.source}, 'Unknown')`);
  return rows;
}

export async function getLeadsByStatus(range?: DateRange) {
  const conditions = dateFilter(crmLeads.createdAt, range);
  const rows = await db
    .select({
      statusId: crmLeads.statusId,
      statusName: crmLeadStatuses.name,
      statusColor: crmLeadStatuses.color,
      count: sql<number>`count(*)::int`,
    })
    .from(crmLeads)
    .leftJoin(crmLeadStatuses, eq(crmLeads.statusId, crmLeadStatuses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(crmLeads.statusId, crmLeadStatuses.name, crmLeadStatuses.color);
  return rows;
}

export async function getLeadConversionRate(range?: DateRange) {
  const conditions = dateFilter(crmLeads.createdAt, range);
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmLeads)
    .where(conditions.length ? and(...conditions) : undefined);

  const oppConditions = dateFilter(pipelineOpportunities.createdAt, range);
  const [convertedResult] = await db
    .select({ count: sql<number>`count(DISTINCT ${pipelineOpportunities.leadId})::int` })
    .from(pipelineOpportunities)
    .where(
      and(
        sql`${pipelineOpportunities.leadId} IS NOT NULL`,
        ...(oppConditions.length ? oppConditions : [])
      )
    );

  const total = totalResult.count;
  const converted = convertedResult.count;
  const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
  return { total, converted, rate };
}

export async function getLeadsTrend(days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`to_char(${crmLeads.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(crmLeads)
    .where(gte(crmLeads.createdAt, since))
    .groupBy(sql`to_char(${crmLeads.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${crmLeads.createdAt}, 'YYYY-MM-DD')`);
  return rows;
}

export async function getPipelineBreakdown(range?: DateRange) {
  const stages = await db.select().from(pipelineStages).orderBy(pipelineStages.sortOrder);
  const conditions = dateFilter(pipelineOpportunities.createdAt, range);
  const opps = await db
    .select({
      stageId: pipelineOpportunities.stageId,
      status: pipelineOpportunities.status,
      value: pipelineOpportunities.value,
    })
    .from(pipelineOpportunities)
    .where(conditions.length ? and(...conditions) : undefined);

  const byStage = stages.map((stage) => {
    const stageOpps = opps.filter((o) => o.stageId === stage.id);
    const open = stageOpps.filter((o) => o.status === "open");
    return {
      stageId: stage.id,
      stageName: stage.name,
      color: stage.color,
      totalCount: stageOpps.length,
      openCount: open.length,
      totalValue: stageOpps.reduce((s, o) => s + parseFloat(o.value || "0"), 0),
      openValue: open.reduce((s, o) => s + parseFloat(o.value || "0"), 0),
    };
  });

  const totalOpen = opps.filter((o) => o.status === "open").length;
  const totalValue = opps.reduce((s, o) => s + parseFloat(o.value || "0"), 0);

  return { byStage, totalOpen, totalValue };
}

export async function getWonLostBreakdown(range?: DateRange) {
  const conditions = dateFilter(pipelineOpportunities.updatedAt, range);
  const rows = await db
    .select({
      status: pipelineOpportunities.status,
      count: sql<number>`count(*)::int`,
      totalValue: sql<number>`COALESCE(sum(${pipelineOpportunities.value}::numeric), 0)::float`,
    })
    .from(pipelineOpportunities)
    .where(
      and(
        sql`${pipelineOpportunities.status} IN ('won', 'lost')`,
        ...(conditions.length ? conditions : [])
      )
    )
    .groupBy(pipelineOpportunities.status);

  const won = rows.find((r) => r.status === "won") || { count: 0, totalValue: 0 };
  const lost = rows.find((r) => r.status === "lost") || { count: 0, totalValue: 0 };
  const total = won.count + lost.count;
  const winRate = total > 0 ? Math.round((won.count / total) * 100) : 0;

  return {
    won: { count: won.count, value: won.totalValue },
    lost: { count: lost.count, value: lost.totalValue },
    winRate,
  };
}

export async function getOnboardingBreakdown(range?: DateRange) {
  const conditions = dateFilter(onboardingRecords.createdAt, range);
  const records = await db.select().from(onboardingRecords)
    .where(conditions.length ? and(...conditions) : undefined);
  const now = new Date();

  const byStatus = {
    pending: records.filter((r) => r.status === "pending").length,
    in_progress: records.filter((r) => r.status === "in_progress").length,
    completed: records.filter((r) => r.status === "completed").length,
    on_hold: records.filter((r) => r.status === "on_hold").length,
  };

  const overdue = records.filter(
    (r) => r.dueDate && r.dueDate < now && r.status !== "completed"
  ).length;

  const completedRecords = records.filter((r) => r.completedAt && r.createdAt);
  let avgCompletionDays = 0;
  if (completedRecords.length > 0) {
    const totalDays = completedRecords.reduce((sum, r) => {
      const diff = new Date(r.completedAt!).getTime() - new Date(r.createdAt).getTime();
      return sum + diff / (1000 * 60 * 60 * 24);
    }, 0);
    avgCompletionDays = Math.round(totalDays / completedRecords.length);
  }

  const checklistItems = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) FILTER (WHERE ${onboardingChecklistItems.isCompleted} = true)::int`,
    })
    .from(onboardingChecklistItems);

  const checklist = checklistItems[0] || { total: 0, completed: 0 };
  const checklistRate = checklist.total > 0
    ? Math.round((checklist.completed / checklist.total) * 100) : 0;

  return {
    total: records.length,
    byStatus,
    overdue,
    avgCompletionDays,
    checklist: { total: checklist.total, completed: checklist.completed, rate: checklistRate },
  };
}

export async function getNotificationSummary(range?: DateRange) {
  const conditions = dateFilter(notifications.createdAt, range);
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const byType = await db
    .select({
      type: notifications.type,
      count: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) FILTER (WHERE ${notifications.isRead} = false)::int`,
    })
    .from(notifications)
    .where(whereClause)
    .groupBy(notifications.type);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) FILTER (WHERE ${notifications.isRead} = false)::int`,
    })
    .from(notifications)
    .where(whereClause);

  return { byType, total: totals?.total ?? 0, unread: totals?.unread ?? 0 };
}

export async function getOverdueLeads(range?: DateRange) {
  const now = new Date();
  const conditions = dateFilter(crmLeads.createdAt, range);
  conditions.push(lt(crmLeads.followUpDate, now));
  conditions.push(sql`${crmLeads.followUpDate} IS NOT NULL`);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(crmLeads)
    .where(and(...conditions));

  return { count: rows[0]?.count ?? 0 };
}

export async function getOverview(range?: DateRange) {
  const [leadsBySource, leadsByStatus, conversion, pipeline, wonLost, onboarding, notifs, overdueLeads] =
    await Promise.all([
      getLeadsBySource(range),
      getLeadsByStatus(range),
      getLeadConversionRate(range),
      getPipelineBreakdown(range),
      getWonLostBreakdown(range),
      getOnboardingBreakdown(range),
      getNotificationSummary(range),
      getOverdueLeads(range),
    ]);

  return { leadsBySource, leadsByStatus, conversion, pipeline, wonLost, onboarding, notifications: notifs, overdueLeads };
}
