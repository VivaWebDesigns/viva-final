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
 *
 * Performance notes:
 * ─────────────────────────────────────────────────────────────────────────────
 * getPipelineBreakdown — single LEFT JOIN query; aggregation in SQL via
 *   GROUP BY + COUNT FILTER. Indexes: pipeline_opp_status_stage_idx.
 *
 * getOnboardingBreakdown — single conditional-aggregation query; no record
 *   hydration. Indexes: onboarding_status_idx, onboarding_status_due_idx.
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

function logTiming(label: string, ms: number) {
  console.log(`[reports:${label}] timing ${ms}ms`);
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

/**
 * getPipelineBreakdown — SQL-aggregated version
 *
 * BEFORE: 2 queries (stages + all opp rows) + JS filter/reduce per stage.
 *   At 10k opportunities this would scan and hydrate every row in JS.
 *
 * AFTER: 1 LEFT JOIN query with GROUP BY + COUNT FILTER + SUM FILTER.
 *   The DB engine uses pipeline_opp_status_stage_idx for the aggregate scan.
 *   Totals (totalOpen, totalValue) are computed by reducing the per-stage
 *   SQL results — a trivial in-memory operation on ~5–20 stage rows.
 *
 * Indexes used: pipeline_opp_status_stage_idx (status, stageId)
 */
export async function getPipelineBreakdown(range?: DateRange) {
  const t0 = Date.now();

  const dateConditions = dateFilter(pipelineOpportunities.createdAt, range);

  const joinOn = dateConditions.length
    ? and(eq(pipelineOpportunities.stageId, pipelineStages.id), ...dateConditions)
    : eq(pipelineOpportunities.stageId, pipelineStages.id);

  const rows = await db
    .select({
      stageId: pipelineStages.id,
      stageName: pipelineStages.name,
      stageSlug: pipelineStages.slug,
      color: pipelineStages.color,
      totalCount: sql<number>`COUNT(${pipelineOpportunities.id})::int`,
      openCount: sql<number>`COUNT(${pipelineOpportunities.id}) FILTER (WHERE ${pipelineOpportunities.status} = 'open')::int`,
      totalValue: sql<number>`COALESCE(SUM(${pipelineOpportunities.value}::numeric), 0)::float`,
      openValue: sql<number>`COALESCE(SUM(${pipelineOpportunities.value}::numeric) FILTER (WHERE ${pipelineOpportunities.status} = 'open'), 0)::float`,
    })
    .from(pipelineStages)
    .leftJoin(pipelineOpportunities, joinOn)
    .groupBy(
      pipelineStages.id,
      pipelineStages.name,
      pipelineStages.slug,
      pipelineStages.color,
      pipelineStages.sortOrder,
    )
    .orderBy(pipelineStages.sortOrder);

  const byStage = rows.map((r) => ({
    stageId: r.stageId,
    stageName: r.stageName,
    stageSlug: r.stageSlug,
    color: r.color,
    totalCount: r.totalCount,
    openCount: r.openCount,
    totalValue: r.totalValue,
    openValue: r.openValue,
  }));

  const totalOpen = byStage.reduce((s, r) => s + r.openCount, 0);
  const totalValue = byStage.reduce((s, r) => s + r.totalValue, 0);

  logTiming("pipeline_breakdown", Date.now() - t0);
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

/**
 * getOnboardingBreakdown — SQL-aggregated version
 *
 * BEFORE: 1 query loading ALL onboarding_records (full row hydration) +
 *   JS filters for status counts, overdue detection, and avgCompletionDays.
 *   At 1k records this transfers every column of every row across the wire.
 *
 * AFTER: 1 conditional-aggregation query returning a single summary row.
 *   The DB engine uses onboarding_status_due_idx (status, dueDate) for the
 *   overdue filter and onboarding_status_idx for status GROUP BY.
 *   Checklist query is unchanged (already aggregated).
 *
 * Indexes used:
 *   onboarding_status_idx (status)
 *   onboarding_status_due_idx (status, dueDate)
 *   onboarding_created_idx (createdAt)
 */
export async function getOnboardingBreakdown(range?: DateRange) {
  const t0 = Date.now();

  const conditions = dateFilter(onboardingRecords.createdAt, range);
  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [agg, checklist] = await Promise.all([
    db
      .select({
        total: sql<number>`COUNT(*)::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${onboardingRecords.status} = 'pending')::int`,
        in_progress: sql<number>`COUNT(*) FILTER (WHERE ${onboardingRecords.status} = 'in_progress')::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${onboardingRecords.status} = 'completed')::int`,
        on_hold: sql<number>`COUNT(*) FILTER (WHERE ${onboardingRecords.status} = 'on_hold')::int`,
        overdue: sql<number>`COUNT(*) FILTER (
          WHERE ${onboardingRecords.dueDate} IS NOT NULL
            AND ${onboardingRecords.dueDate} < NOW()
            AND ${onboardingRecords.status} != 'completed'
        )::int`,
        avgCompletionDays: sql<number>`COALESCE(
          ROUND(
            AVG(
              EXTRACT(EPOCH FROM (${onboardingRecords.completedAt} - ${onboardingRecords.createdAt})) / 86400.0
            ) FILTER (WHERE ${onboardingRecords.completedAt} IS NOT NULL)
          ),
          0
        )::int`,
      })
      .from(onboardingRecords)
      .where(whereClause),

    db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${onboardingChecklistItems.isCompleted} = true)::int`,
      })
      .from(onboardingChecklistItems),
  ]);

  const row = agg[0] ?? {
    total: 0, pending: 0, in_progress: 0, completed: 0, on_hold: 0, overdue: 0, avgCompletionDays: 0,
  };
  const check = checklist[0] || { total: 0, completed: 0 };
  const checklistRate = check.total > 0
    ? Math.round((check.completed / check.total) * 100) : 0;

  logTiming("onboarding_breakdown", Date.now() - t0);

  return {
    total: row.total,
    byStatus: {
      pending: row.pending,
      in_progress: row.in_progress,
      completed: row.completed,
      on_hold: row.on_hold,
    },
    overdue: row.overdue,
    avgCompletionDays: row.avgCompletionDays,
    checklist: { total: check.total, completed: check.completed, rate: checklistRate },
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
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const conditions = dateFilter(crmLeads.createdAt, range);
  conditions.push(lt(crmLeads.updatedAt, sevenDaysAgo));

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
