import { db } from "../../db";
import {
  crmActivityEvents,
  crmLeadNotes,
  crmLeads,
  followupTasks,
  pipelineActivities,
  pipelineOpportunities,
  user,
} from "@shared/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

export interface ActivityRange {
  from: Date;
  to: Date;
}

function makeRange(days = 7): ActivityRange {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 7;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - safeDays);
  return { from, to };
}

function msToMinutes(ms: number) {
  return Math.round(ms / 60000);
}

function pct(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function mapByUser<T extends { userId: string | null }>(rows: T[]) {
  return new Map(rows.filter((row) => row.userId).map((row) => [row.userId!, row]));
}

async function getRiskQueues(range: ActivityRange) {
  const untouchedCutoff = new Date();
  untouchedCutoff.setHours(untouchedCutoff.getHours() - 24);

  const staleOpportunityCutoff = new Date();
  staleOpportunityCutoff.setDate(staleOpportunityCutoff.getDate() - 7);

  const untouchedLeadRows = await db.execute(sql`
    SELECT
      l.id,
      l.title,
      l.created_at AS "createdAt",
      l.assigned_to AS "assignedTo",
      u.name AS "assignedName"
    FROM crm_leads l
    LEFT JOIN "user" u ON u.id = l.assigned_to
    WHERE l.assigned_to IS NOT NULL
      AND l.created_at < ${untouchedCutoff}
      AND NOT EXISTS (
        SELECT 1 FROM crm_activity_events a
        WHERE a.entity_type = 'lead'
          AND a.entity_id = l.id
          AND a.user_id = l.assigned_to
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_lead_notes n
        WHERE n.lead_id = l.id
          AND n.user_id = l.assigned_to
      )
    ORDER BY l.created_at ASC
    LIMIT 20
  `);

  const staleOpportunityRows = await db.execute(sql`
    SELECT
      o.id,
      o.title,
      o.updated_at AS "updatedAt",
      o.next_action_date AS "nextActionDate",
      o.assigned_to AS "assignedTo",
      u.name AS "assignedName"
    FROM pipeline_opportunities o
    LEFT JOIN "user" u ON u.id = o.assigned_to
    WHERE o.status = 'open'
      AND o.assigned_to IS NOT NULL
      AND o.updated_at < ${staleOpportunityCutoff}
      AND NOT EXISTS (
        SELECT 1 FROM pipeline_activities pa
        WHERE pa.opportunity_id = o.id
          AND pa.created_at >= ${range.from}
      )
      AND NOT EXISTS (
        SELECT 1 FROM crm_activity_events a
        WHERE a.entity_type = 'opportunity'
          AND a.entity_id = o.id
          AND a.created_at >= ${range.from}
      )
    ORDER BY o.updated_at ASC
    LIMIT 20
  `);

  return {
    untouchedLeads: untouchedLeadRows.rows,
    staleOpportunities: staleOpportunityRows.rows,
  };
}

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

export async function getActivitySummary(days = 7) {
  const range = makeRange(days);

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
      and(eq(crmActivityEvents.userId, user.id), gte(crmActivityEvents.createdAt, range.from)),
    )
    .where(inArray(user.role, ["sales_rep", "lead_gen"]))
    .groupBy(user.id, user.name, user.email, user.role)
    .orderBy(desc(sql`COALESCE(SUM(${crmActivityEvents.activeMs}), 0)`));

  const [leadAssignments, touchedLeads, leadNotes, pipelineActions, taskRows, firstTouchRows] = await Promise.all([
    db
      .select({
        userId: crmLeads.assignedTo,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(crmLeads)
      .where(and(gte(crmLeads.createdAt, range.from), sql`${crmLeads.assignedTo} IS NOT NULL`))
      .groupBy(crmLeads.assignedTo),
    db
      .select({
        userId: crmActivityEvents.userId,
        count: sql<number>`COUNT(DISTINCT ${crmActivityEvents.entityId})::int`,
      })
      .from(crmActivityEvents)
      .where(and(
        gte(crmActivityEvents.createdAt, range.from),
        eq(crmActivityEvents.entityType, "lead"),
        sql`${crmActivityEvents.entityId} IS NOT NULL`,
      ))
      .groupBy(crmActivityEvents.userId),
    db
      .select({
        userId: crmLeadNotes.userId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(crmLeadNotes)
      .where(and(gte(crmLeadNotes.createdAt, range.from), sql`${crmLeadNotes.userId} IS NOT NULL`))
      .groupBy(crmLeadNotes.userId),
    db
      .select({
        userId: pipelineActivities.userId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(pipelineActivities)
      .where(and(gte(pipelineActivities.createdAt, range.from), sql`${pipelineActivities.userId} IS NOT NULL`))
      .groupBy(pipelineActivities.userId),
    db
      .select({
        userId: followupTasks.assignedTo,
        created: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${followupTasks.completed} = true)::int`,
        overdue: sql<number>`COUNT(*) FILTER (WHERE ${followupTasks.completed} = false AND ${followupTasks.dueDate} < NOW())::int`,
      })
      .from(followupTasks)
      .where(and(gte(followupTasks.createdAt, range.from), sql`${followupTasks.assignedTo} IS NOT NULL`))
      .groupBy(followupTasks.assignedTo),
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
      GROUP BY l.assigned_to
    `),
  ]);

  const assignedMap = mapByUser(leadAssignments);
  const touchedMap = mapByUser(touchedLeads);
  const notesMap = mapByUser(leadNotes);
  const pipelineMap = mapByUser(pipelineActions);
  const tasksMap = mapByUser(taskRows);
  const firstTouchMap = new Map((firstTouchRows.rows as Array<{
    userId: string;
    touchedCount: number;
    avgFirstTouchMinutes: number;
  }>).map((row) => [row.userId, row]));

  const repSummaries = reps.map((rep) => {
    const assigned = assignedMap.get(rep.userId)?.count ?? 0;
    const touched = touchedMap.get(rep.userId)?.count ?? 0;
    const tasks = tasksMap.get(rep.userId);
    const firstTouch = firstTouchMap.get(rep.userId);

    return {
      ...rep,
      activeMinutes: msToMinutes(rep.activeMs),
      crmMinutes: msToMinutes(rep.crmMs),
      pipelineMinutes: msToMinutes(rep.pipelineMs),
      taskMinutes: msToMinutes(rep.taskMs),
      leadsAssigned: assigned,
      leadsTouched: touched,
      leadTouchRate: pct(touched, assigned),
      leadNotes: notesMap.get(rep.userId)?.count ?? 0,
      pipelineActions: pipelineMap.get(rep.userId)?.count ?? 0,
      tasksCreated: tasks?.created ?? 0,
      tasksCompleted: tasks?.completed ?? 0,
      overdueTasks: tasks?.overdue ?? 0,
      followUpCompletionRate: pct(tasks?.completed ?? 0, tasks?.created ?? 0),
      avgFirstTouchMinutes: firstTouch?.avgFirstTouchMinutes ?? null,
      firstTouchedLeads: firstTouch?.touchedCount ?? 0,
    };
  });

  const totals = repSummaries.reduce((acc, rep) => ({
    activeMinutes: acc.activeMinutes + rep.activeMinutes,
    leadsAssigned: acc.leadsAssigned + rep.leadsAssigned,
    leadsTouched: acc.leadsTouched + rep.leadsTouched,
    overdueTasks: acc.overdueTasks + rep.overdueTasks,
    pipelineActions: acc.pipelineActions + rep.pipelineActions,
  }), {
    activeMinutes: 0,
    leadsAssigned: 0,
    leadsTouched: 0,
    overdueTasks: 0,
    pipelineActions: 0,
  });

  const riskQueues = await getRiskQueues(range);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), days },
    totals: {
      ...totals,
      leadTouchRate: pct(totals.leadsTouched, totals.leadsAssigned),
    },
    reps: repSummaries,
    riskQueues,
  };
}
