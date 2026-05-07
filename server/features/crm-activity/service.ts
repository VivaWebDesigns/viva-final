import { db } from "../../db";
import {
  crmActivityEvents,
  crmLeadNotes,
  crmLeads,
  followupTasks,
  pipelineActivities,
  user,
} from "@shared/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

export interface ActivityRange {
  from: Date;
  to: Date;
  endExclusive: Date;
  days: number;
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function nextLocalDay(value: Date) {
  const date = startOfLocalDay(value);
  date.setDate(date.getDate() + 1);
  return date;
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetweenInclusive(from: Date, to: Date) {
  const start = startOfLocalDay(from).getTime();
  const end = startOfLocalDay(to).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function makeRange(options: number | { days?: number; from?: string; to?: string } = 1): ActivityRange {
  if (typeof options !== "number" && (options.from || options.to)) {
    const parsedFrom = options.from ? parseDateOnly(options.from) : null;
    const parsedTo = options.to ? parseDateOnly(options.to) : parsedFrom;
    if (parsedFrom && parsedTo) {
      const from = startOfLocalDay(parsedFrom <= parsedTo ? parsedFrom : parsedTo);
      const requestedTo = startOfLocalDay(parsedFrom <= parsedTo ? parsedTo : parsedFrom);
      const days = Math.min(daysBetweenInclusive(from, requestedTo), 365);
      const to = new Date(from);
      to.setDate(to.getDate() + days - 1);
      return { from, to, endExclusive: nextLocalDay(to), days };
    }
  }

  const rawDays = typeof options === "number" ? options : options.days;
  const safeDays = Number.isFinite(rawDays) && rawDays && rawDays > 0 ? Math.min(rawDays, 365) : 1;
  const to = startOfLocalDay(new Date());
  const from = new Date(to);
  from.setDate(from.getDate() - safeDays + 1);
  return { from, to, endExclusive: nextLocalDay(to), days: safeDays };
}

function msToMinutes(ms: number) {
  return Math.round(ms / 60000);
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateKey(value: Date | string) {
  return (toIso(value) ?? String(value)).slice(0, 10);
}

function eachDateKey(range: ActivityRange) {
  const dates: string[] = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(range.to);
  end.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function isWeekdayDateKey(value: string) {
  const day = new Date(`${value}T00:00:00`).getDay();
  return day !== 0 && day !== 6;
}

function mapByUser<T extends { userId: string | null }>(rows: T[]) {
  return new Map(rows.filter((row) => row.userId).map((row) => [row.userId!, row]));
}

function getScoreStatus(score: number) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 60) return "needs_attention";
  return "at_risk";
}

const visibleSalesRepPredicate = and(
  eq(user.role, "sales_rep"),
  eq(user.includeInActivityIntelligence, true),
);

const TARGET_TASKS_COMPLETED_PER_WEEKDAY = 6;
const TARGET_LEADS_CONTACTED_PER_WEEKDAY = 4;

export async function createActivityEvent(userId: string, data: {
  eventType: string;
  surface: string;
  entityType?: string | null;
  entityId?: string | null;
  path: string;
  activeMs?: number;
  metadata?: unknown;
}) {
  const [event] = await db.insert(crmActivityEvents).values({
    userId,
    eventType: data.eventType,
    surface: data.surface,
    entityType: data.entityType ?? null,
    entityId: data.entityId ?? null,
    path: data.path,
    activeMs: data.activeMs ?? 0,
    metadata: data.metadata ?? null,
  }).returning();

  return event;
}

export async function getActivitySummary(options: number | { days?: number; from?: string; to?: string } = 1) {
  const range = makeRange(options);

  const reps = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      activeMs: sql<number>`COALESCE(SUM(${crmActivityEvents.activeMs}), 0)::int`,
      crmMs: sql<number>`COALESCE(SUM(${crmActivityEvents.activeMs}) FILTER (WHERE ${crmActivityEvents.surface} = 'crm'), 0)::int`,
      pipelineMs: sql<number>`COALESCE(SUM(${crmActivityEvents.activeMs}) FILTER (WHERE ${crmActivityEvents.surface} = 'pipeline'), 0)::int`,
      taskMs: sql<number>`COALESCE(SUM(${crmActivityEvents.activeMs}) FILTER (WHERE ${crmActivityEvents.surface} = 'tasks'), 0)::int`,
    })
    .from(user)
    .leftJoin(
      crmActivityEvents,
      and(
        eq(crmActivityEvents.userId, user.id),
        gte(crmActivityEvents.createdAt, range.from),
        lt(crmActivityEvents.createdAt, range.endExclusive),
      ),
    )
    .where(visibleSalesRepPredicate)
    .groupBy(user.id, user.name, user.email, user.role)
    .orderBy(desc(sql`COALESCE(SUM(${crmActivityEvents.activeMs}), 0)`));

  const [leadAssignments, leadNotes, pipelineActions, taskRows, signInRows, firstTouchRows, outcomeRows, dailyRows] = await Promise.all([
    db
      .select({
        userId: crmLeads.assignedTo,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(crmLeads)
      .where(and(gte(crmLeads.createdAt, range.from), lt(crmLeads.createdAt, range.endExclusive), sql`${crmLeads.assignedTo} IS NOT NULL`))
      .groupBy(crmLeads.assignedTo),
    db
      .select({
        userId: crmLeadNotes.userId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(crmLeadNotes)
      .where(and(gte(crmLeadNotes.createdAt, range.from), lt(crmLeadNotes.createdAt, range.endExclusive), sql`${crmLeadNotes.userId} IS NOT NULL`))
      .groupBy(crmLeadNotes.userId),
    db
      .select({
        userId: pipelineActivities.userId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(pipelineActivities)
      .where(and(gte(pipelineActivities.createdAt, range.from), lt(pipelineActivities.createdAt, range.endExclusive), sql`${pipelineActivities.userId} IS NOT NULL`))
      .groupBy(pipelineActivities.userId),
    db.execute(sql`
      WITH task_base AS (
        SELECT
          ft.id,
          ft.title,
          ft.task_type AS "taskType",
          COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to) AS "userId",
          ft.completed,
          ft.completed_at AS "completedAt",
          ft.due_date AS "dueAt",
          ft.lead_id AS "leadId",
          ft.opportunity_id AS "opportunityId",
          COALESCE(ft.lead_id, po.lead_id) AS "resolvedLeadId"
        FROM followup_tasks ft
        LEFT JOIN pipeline_opportunities po ON po.id = ft.opportunity_id
        LEFT JOIN crm_leads cl ON cl.id = COALESCE(ft.lead_id, po.lead_id)
        WHERE COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to) IS NOT NULL
          AND (
            (ft.completed = true AND ft.completed_at >= ${range.from} AND ft.completed_at < ${range.endExclusive})
            OR (ft.due_date >= ${range.from} AND ft.due_date < ${range.endExclusive})
          )
      ),
      task_classification AS (
        SELECT
          tb.*,
          (
            (
              tb."resolvedLeadId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM crm_lead_notes n
                WHERE n.lead_id = tb."resolvedLeadId"
                  AND n.created_at < tb."dueAt"
                  AND n.type IN ('call', 'email', 'sms', 'task')
              )
            )
            OR (
              tb."resolvedLeadId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM followup_tasks previous_ft
                LEFT JOIN pipeline_opportunities previous_po ON previous_po.id = previous_ft.opportunity_id
                WHERE previous_ft.id <> tb.id
                  AND previous_ft.completed = true
                  AND previous_ft.completed_at < tb."dueAt"
                  AND COALESCE(previous_ft.lead_id, previous_po.lead_id) = tb."resolvedLeadId"
              )
            )
            OR (
              tb."opportunityId" IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM pipeline_activities pa
                WHERE pa.opportunity_id = tb."opportunityId"
                  AND pa.created_at < tb."dueAt"
                  AND pa.type IN ('call', 'email', 'task')
              )
            )
          ) AS "isFollowUp"
        FROM task_base tb
      ),
      completed_rollup AS (
        SELECT
          tc."userId",
          COUNT(*) FILTER (
            WHERE tc.completed = true
              AND tc."completedAt" >= ${range.from}
              AND tc."completedAt" < ${range.endExclusive}
          )::int AS "completed",
          COUNT(DISTINCT tc."resolvedLeadId") FILTER (
            WHERE tc.completed = true
              AND tc."completedAt" >= ${range.from}
              AND tc."completedAt" < ${range.endExclusive}
              AND tc."resolvedLeadId" IS NOT NULL
              AND tc."taskType" = 'call'
              AND NOT EXISTS (
                SELECT 1
                FROM followup_tasks previous_contact
                LEFT JOIN pipeline_opportunities previous_contact_po ON previous_contact_po.id = previous_contact.opportunity_id
                WHERE previous_contact.id <> tc.id
                  AND previous_contact.completed = true
                  AND previous_contact.completed_at < tc."completedAt"
                  AND previous_contact.task_type = 'call'
                  AND COALESCE(previous_contact.lead_id, previous_contact_po.lead_id) = tc."resolvedLeadId"
              )
          )::int AS "leadsContacted",
          COUNT(*) FILTER (
            WHERE tc."isFollowUp" = true
              AND tc."dueAt" >= ${range.from}
              AND tc."dueAt" < ${range.endExclusive}
          )::int AS "followUpsDue",
          COUNT(*) FILTER (
            WHERE tc."isFollowUp" = true
              AND tc.completed = true
              AND tc."dueAt" >= ${range.from}
              AND tc."dueAt" < ${range.endExclusive}
          )::int AS "followUpsCompleted"
        FROM task_classification tc
        GROUP BY tc."userId"
      ),
      overdue_rollup AS (
        SELECT
          COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to) AS "userId",
          COUNT(*)::int AS "overdue"
        FROM followup_tasks ft
        LEFT JOIN pipeline_opportunities po ON po.id = ft.opportunity_id
        LEFT JOIN crm_leads cl ON cl.id = COALESCE(ft.lead_id, po.lead_id)
        WHERE COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to) IS NOT NULL
          AND ft.completed = false
          AND ft.due_date < NOW()
        GROUP BY COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to)
      )
      SELECT
        COALESCE(c."userId", o."userId") AS "userId",
        COALESCE(c."completed", 0)::int AS "completed",
        COALESCE(c."leadsContacted", 0)::int AS "leadsContacted",
        COALESCE(c."followUpsDue", 0)::int AS "followUpsDue",
        COALESCE(c."followUpsCompleted", 0)::int AS "followUpsCompleted",
        COALESCE(o."overdue", 0)::int AS "overdue"
      FROM completed_rollup c
      FULL OUTER JOIN overdue_rollup o ON o."userId" = c."userId"
    `),
    db
      .select({
        userId: crmActivityEvents.userId,
        createdAt: crmActivityEvents.createdAt,
      })
      .from(crmActivityEvents)
      .where(and(
        gte(crmActivityEvents.createdAt, range.from),
        lt(crmActivityEvents.createdAt, range.endExclusive),
        eq(crmActivityEvents.eventType, "sign_in"),
      ))
      .orderBy(desc(crmActivityEvents.createdAt)),
    db.execute(sql`
      SELECT
        l.assigned_to AS "userId",
        COUNT(*) FILTER (WHERE first_seen.first_seen_at IS NOT NULL)::int AS "touchedCount",
        COALESCE(
          ROUND(AVG(EXTRACT(EPOCH FROM (first_seen.first_seen_at - l.created_at)) / 60.0)
            FILTER (WHERE first_seen.first_seen_at IS NOT NULL)),
          0
        )::int AS "avgFirstTouchMinutes"
      FROM crm_leads l
      LEFT JOIN LATERAL (
        SELECT MIN(a.created_at) AS first_seen_at
        FROM crm_activity_events a
        WHERE a.entity_type = 'lead'
          AND a.entity_id = l.id
          AND a.user_id = l.assigned_to
      ) first_seen ON true
      WHERE l.assigned_to IS NOT NULL
        AND l.created_at >= ${range.from}
        AND l.created_at < ${range.endExclusive}
      GROUP BY l.assigned_to
    `),
    db.execute(sql`
      SELECT
        pa.user_id AS "userId",
        COUNT(DISTINCT po.lead_id) FILTER (WHERE po.lead_id IS NOT NULL)::int AS "leadsWorked",
        COUNT(*) FILTER (WHERE pa.type = 'stage_change')::int AS "pipelineActions",
        COUNT(*) FILTER (WHERE pa.type = 'stage_change' AND pa.metadata->>'toStageSlug' = 'demo-scheduled')::int AS "demosScheduled",
        COUNT(*) FILTER (WHERE pa.type = 'stage_change' AND pa.metadata->>'toStageSlug' = 'demo-completed')::int AS "demosCompleted",
        COUNT(*) FILTER (WHERE pa.type = 'stage_change' AND pa.metadata->>'toStageSlug' = 'closed-won')::int AS "closedWon",
        COUNT(*) FILTER (WHERE pa.type = 'stage_change' AND pa.metadata->>'toStageSlug' = 'closed-lost')::int AS "closedLost"
      FROM pipeline_activities pa
      INNER JOIN pipeline_opportunities po ON po.id = pa.opportunity_id
      WHERE pa.user_id IS NOT NULL
        AND pa.created_at >= ${range.from}
        AND pa.created_at < ${range.endExclusive}
      GROUP BY pa.user_id
    `),
    db.execute(sql`
      WITH crm_daily AS (
        SELECT
          a.user_id AS "userId",
          DATE(a.created_at) AS "date",
          COALESCE(SUM(a.active_ms), 0)::int AS "activeMs",
          COUNT(*) FILTER (WHERE a.event_type = 'sign_in')::int AS "signIns",
          MIN(a.created_at) FILTER (WHERE a.event_type = 'sign_in') AS "firstSignInAt",
          MAX(a.created_at) FILTER (WHERE a.event_type <> 'sign_in' OR a.active_ms > 0) AS "lastActivityAt",
          COUNT(DISTINCT a.entity_id) FILTER (WHERE a.entity_type = 'lead' AND a.entity_id IS NOT NULL)::int AS "leadsTouched"
        FROM crm_activity_events a
        WHERE a.user_id IS NOT NULL
          AND a.created_at >= ${range.from}
          AND a.created_at < ${range.endExclusive}
        GROUP BY a.user_id, DATE(a.created_at)
      ),
      pipeline_daily AS (
        SELECT
          pa.user_id AS "userId",
          DATE(pa.created_at) AS "date",
          COUNT(*)::int AS "pipelineActions",
          COUNT(DISTINCT po.lead_id) FILTER (WHERE po.lead_id IS NOT NULL)::int AS "leadsWorked",
          COUNT(*) FILTER (WHERE pa.type = 'stage_change' AND pa.metadata->>'toStageSlug' = 'demo-scheduled')::int AS "demosScheduled",
          COUNT(*) FILTER (WHERE pa.type = 'stage_change' AND pa.metadata->>'toStageSlug' = 'closed-won')::int AS "closedWon"
        FROM pipeline_activities pa
        INNER JOIN pipeline_opportunities po ON po.id = pa.opportunity_id
        WHERE pa.user_id IS NOT NULL
          AND pa.created_at >= ${range.from}
          AND pa.created_at < ${range.endExclusive}
        GROUP BY pa.user_id, DATE(pa.created_at)
      ),
      task_daily AS (
        SELECT
          COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to) AS "userId",
          DATE(COALESCE(ft.completed_at, ft.created_at)) AS "date",
          COUNT(*) FILTER (WHERE ft.completed = true AND ft.completed_at >= ${range.from} AND ft.completed_at < ${range.endExclusive})::int AS "tasksCompleted"
        FROM followup_tasks ft
        LEFT JOIN pipeline_opportunities po ON po.id = ft.opportunity_id
        LEFT JOIN crm_leads cl ON cl.id = COALESCE(ft.lead_id, po.lead_id)
        WHERE COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to) IS NOT NULL
          AND (
            (ft.created_at >= ${range.from} AND ft.created_at < ${range.endExclusive})
            OR (ft.completed_at >= ${range.from} AND ft.completed_at < ${range.endExclusive})
          )
        GROUP BY COALESCE(po.assigned_to, cl.assigned_to, ft.assigned_to), DATE(COALESCE(ft.completed_at, ft.created_at))
      )
      SELECT
        COALESCE(c."userId", p."userId", t."userId") AS "userId",
        COALESCE(c."date", p."date", t."date")::text AS "date",
        COALESCE(c."activeMs", 0)::int AS "activeMs",
        COALESCE(c."signIns", 0)::int AS "signIns",
        c."firstSignInAt",
        c."lastActivityAt",
        (COALESCE(c."leadsTouched", 0) + COALESCE(p."leadsWorked", 0))::int AS "leadsWorked",
        COALESCE(p."pipelineActions", 0)::int AS "pipelineActions",
        COALESCE(t."tasksCompleted", 0)::int AS "tasksCompleted",
        COALESCE(p."demosScheduled", 0)::int AS "demosScheduled",
        COALESCE(p."closedWon", 0)::int AS "closedWon"
      FROM crm_daily c
      FULL OUTER JOIN pipeline_daily p
        ON p."userId" = c."userId" AND p."date" = c."date"
      FULL OUTER JOIN task_daily t
        ON t."userId" = COALESCE(c."userId", p."userId")
       AND t."date" = COALESCE(c."date", p."date")
      ORDER BY "date" DESC
    `),
  ]);

  const assignedMap = mapByUser(leadAssignments);
  const notesMap = mapByUser(leadNotes);
  const pipelineMap = mapByUser(pipelineActions);
  const tasksMap = new Map((taskRows.rows as Array<{
    userId: string;
    completed: number;
    leadsContacted: number;
    followUpsDue: number;
    followUpsCompleted: number;
    overdue: number;
  }>).filter((row) => row.userId).map((row) => [row.userId, row]));
  const signInMap = new Map<string, { count: number; lastSignInAt: string | null }>();
  const outcomeMap = new Map((outcomeRows.rows as Array<{
    userId: string;
    leadsWorked: number;
    pipelineActions: number;
    demosScheduled: number;
    demosCompleted: number;
    closedWon: number;
    closedLost: number;
  }>).map((row) => [row.userId, row]));
  const dailyByUser = new Map<string, Array<{
    date: string;
    activeMs: number;
    signIns: number;
    firstSignInAt: Date | string | null;
    lastActivityAt: Date | string | null;
    leadsWorked: number;
    pipelineActions: number;
    tasksCompleted: number;
    demosScheduled: number;
    closedWon: number;
  }>>();
  const firstTouchMap = new Map((firstTouchRows.rows as Array<{
    userId: string;
    touchedCount: number;
    avgFirstTouchMinutes: number;
  }>).map((row) => [row.userId, row]));
  const dateKeys = eachDateKey(range);
  const businessDaysInRange = Math.max(dateKeys.filter(isWeekdayDateKey).length, 1);

  for (const row of dailyRows.rows as Array<{
    userId: string;
    date: string;
    activeMs: number;
    signIns: number;
    firstSignInAt: Date | string | null;
    lastActivityAt: Date | string | null;
    leadsWorked: number;
    pipelineActions: number;
    tasksCompleted: number;
    demosScheduled: number;
    closedWon: number;
  }>) {
    const date = String(row.date).slice(0, 10);
    const rows = dailyByUser.get(row.userId) ?? [];
    rows.push({ ...row, date });
    dailyByUser.set(row.userId, rows);
  }

  for (const row of signInRows) {
    const current = signInMap.get(row.userId) ?? { count: 0, lastSignInAt: null };
    current.count += 1;
    if (!current.lastSignInAt) current.lastSignInAt = toIso(row.createdAt);
    signInMap.set(row.userId, current);
  }

  const repSummaries = reps.map((rep) => {
    const assigned = assignedMap.get(rep.userId)?.count ?? 0;
    const tasks = tasksMap.get(rep.userId);
    const firstTouch = firstTouchMap.get(rep.userId);
    const outcomes = outcomeMap.get(rep.userId);
    const daily = dailyByUser.get(rep.userId) ?? [];
    const activeDays = daily.filter((day) => isWeekdayDateKey(day.date) && (day.activeMs > 0 || day.leadsWorked > 0 || day.pipelineActions > 0 || day.tasksCompleted > 0)).length;
    const tasksCompleted = tasks?.completed ?? 0;
    const leadsContacted = tasks?.leadsContacted ?? 0;
    const followUpsDue = tasks?.followUpsDue ?? 0;
    const followUpsCompleted = tasks?.followUpsCompleted ?? 0;
    const demosScheduled = outcomes?.demosScheduled ?? 0;
    const closedWon = outcomes?.closedWon ?? 0;
    const closedLost = outcomes?.closedLost ?? 0;
    const demoRate = pct(demosScheduled, leadsContacted);
    const closeRate = pct(closedWon, leadsContacted);
    const demoCloseRate = pct(closedWon, demosScheduled);

    const leadsContactedScore = clamp((leadsContacted / (businessDaysInRange * TARGET_LEADS_CONTACTED_PER_WEEKDAY)) * 100);
    const taskScore = clamp((tasksCompleted / (businessDaysInRange * TARGET_TASKS_COMPLETED_PER_WEEKDAY)) * 100);
    const followUpScore = followUpsDue > 0 ? pct(followUpsCompleted, followUpsDue) : 0;
    const activityScore = clamp(rep.activeMs / (businessDaysInRange * 30 * 60 * 1000) * 100);
    const firstTouchScore = firstTouch?.avgFirstTouchMinutes
      ? clamp(100 - (firstTouch.avgFirstTouchMinutes / 24 / 60) * 100)
      : (assigned > 0 ? 40 : 70);
    const outcomeScore = clamp(demoRate * 0.6 + closeRate * 1.2 + demoCloseRate * 0.4);
    const consistencyScore = clamp((activeDays / businessDaysInRange) * 100);
    const productivityScore = clamp(Math.round(
      followUpScore * 0.4
      + taskScore * 0.2
      + leadsContactedScore * 0.2
      + activityScore * 0.1
      + outcomeScore * 0.05
      + consistencyScore * 0.05
    ));

    return {
      ...rep,
      activeMinutes: msToMinutes(rep.activeMs),
      crmMinutes: msToMinutes(rep.crmMs),
      pipelineMinutes: msToMinutes(rep.pipelineMs),
      taskMinutes: msToMinutes(rep.taskMs),
      signIns: signInMap.get(rep.userId)?.count ?? 0,
      lastSignInAt: signInMap.get(rep.userId)?.lastSignInAt ?? null,
      activeDays,
      leadsAssigned: assigned,
      leadsTouched: leadsContacted,
      leadsContacted,
      leadTouchRate: pct(leadsContacted, assigned),
      leadNotes: notesMap.get(rep.userId)?.count ?? 0,
      pipelineActions: Math.max(pipelineMap.get(rep.userId)?.count ?? 0, outcomes?.pipelineActions ?? 0),
      tasksCompleted,
      followUpsDue,
      followUpsCompleted,
      overdueTasks: tasks?.overdue ?? 0,
      avgFirstTouchMinutes: firstTouch?.avgFirstTouchMinutes ?? null,
      firstTouchedLeads: firstTouch?.touchedCount ?? 0,
      demosScheduled,
      demosCompleted: outcomes?.demosCompleted ?? 0,
      closedWon,
      closedLost,
      demoRate,
      closeRate,
      demoCloseRate,
      avgTouchesBeforeDemo: demosScheduled > 0 ? Math.round(((outcomes?.pipelineActions ?? 0) + tasksCompleted) / demosScheduled) : null,
      productivityScore,
      productivityStatus: getScoreStatus(productivityScore),
      scoreBreakdown: {
        leadWork: Math.round(leadsContactedScore),
        activity: Math.round(activityScore),
        firstTouch: Math.round(firstTouchScore),
        tasks: Math.round(taskScore),
        followUps: Math.round(followUpScore),
        outcomes: Math.round(outcomeScore),
        consistency: Math.round(consistencyScore),
      },
    };
  });

  const totals = repSummaries.reduce((acc, rep) => ({
    activeMinutes: acc.activeMinutes + rep.activeMinutes,
    signIns: acc.signIns + rep.signIns,
    activeDays: acc.activeDays + rep.activeDays,
    leadsAssigned: acc.leadsAssigned + rep.leadsAssigned,
    leadsTouched: acc.leadsTouched + rep.leadsTouched,
    leadsContacted: acc.leadsContacted + rep.leadsContacted,
    overdueTasks: acc.overdueTasks + rep.overdueTasks,
    pipelineActions: acc.pipelineActions + rep.pipelineActions,
    tasksCompleted: acc.tasksCompleted + rep.tasksCompleted,
    followUpsDue: acc.followUpsDue + rep.followUpsDue,
    followUpsCompleted: acc.followUpsCompleted + rep.followUpsCompleted,
    demosScheduled: acc.demosScheduled + rep.demosScheduled,
    closedWon: acc.closedWon + rep.closedWon,
    closedLost: acc.closedLost + rep.closedLost,
  }), {
    activeMinutes: 0,
    signIns: 0,
    activeDays: 0,
    leadsAssigned: 0,
    leadsTouched: 0,
    leadsContacted: 0,
    overdueTasks: 0,
    pipelineActions: 0,
    tasksCompleted: 0,
    followUpsDue: 0,
    followUpsCompleted: 0,
    demosScheduled: 0,
    closedWon: 0,
    closedLost: 0,
  });

  const repNameMap = new Map(reps.map((rep) => [rep.userId, rep.name]));
  const dailyMap = new Map<string, Map<string, string[]>>();
  for (const row of signInRows) {
    if (!repNameMap.has(row.userId)) continue;
    const dateKey = toDateKey(row.createdAt);
    const dayMap = dailyMap.get(dateKey) ?? new Map<string, string[]>();
    const times = dayMap.get(row.userId) ?? [];
    const signInAt = toIso(row.createdAt);
    if (!signInAt) continue;
    times.push(signInAt);
    dayMap.set(row.userId, times);
    dailyMap.set(dateKey, dayMap);
  }

  const dailySignIns = [...dailyMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayMap]) => ({
      date,
      users: [...dayMap.entries()].map(([userId, times]) => ({
        userId,
        name: repNameMap.get(userId) ?? "Unknown",
        times,
      })),
    }));

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), days: range.days },
    totals: {
      ...totals,
      leadTouchRate: pct(totals.leadsContacted, totals.leadsAssigned),
      demoRate: pct(totals.demosScheduled, totals.leadsContacted),
      closeRate: pct(totals.closedWon, totals.leadsContacted),
      demoCloseRate: pct(totals.closedWon, totals.demosScheduled),
    },
    reps: repSummaries,
    dailySignIns,
  };
}
