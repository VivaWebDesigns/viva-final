import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  crmLeads, crmLeadNotes, followupTasks, pipelineOpportunities, pipelineStages,
  pipelineActivities, scanReportDeliveries, type FollowupTask,
} from "@shared/schema";
import { classifyReportOutreach, reportBusinessDate, REPORT_OUTREACH_TASKS, REPORT_OUTREACH_OUTCOMES,
  type ReportOutreachSegment } from "@shared/reportOutreach";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ReportOutreachState {
  reportEmailCount: number;
  lastReportEmailedAt: Date | null;
  reportOutreachDisposition: string | null;
  reportViewCount: number;
  reportCtaClickCount: number;
  reportLastEngagedAt: Date | null;
  reportNextTaskDueAt: Date | null;
  reportOutreachSegment: ReportOutreachSegment;
  reportNeedsAttention: boolean;
}

/** Uses existing delivery + activity records; no parallel counters to drift or migrate. */
export async function getReportOutreachStates(leadIds: string[], executor: Tx | typeof db = db, includeTasks = false): Promise<Map<string, ReportOutreachState>> {
  const states = new Map<string, ReportOutreachState>(leadIds.map(id => [id, {
    reportEmailCount: 0, lastReportEmailedAt: null, reportOutreachDisposition: null,
    reportViewCount: 0, reportCtaClickCount: 0, reportLastEngagedAt: null, reportNextTaskDueAt: null,
    reportOutreachSegment: "not_started", reportNeedsAttention: false,
  }]));
  if (!leadIds.length) return states;
  const deliveries = await executor.select({
    leadId: scanReportDeliveries.leadId,
    count: sql<number>`count(*)::int`,
    lastSentAt: sql<string>`max(${scanReportDeliveries.sentAt})`,
    viewCount: sql<number>`coalesce(sum(${scanReportDeliveries.viewCount}), 0)::int`,
    ctaClickCount: sql<number>`coalesce(sum(${scanReportDeliveries.ctaClickCount}), 0)::int`,
    lastEngagedAt: sql<string | null>`max(greatest(${scanReportDeliveries.lastViewedAt}, ${scanReportDeliveries.lastCtaClickedAt}))`,
  }).from(scanReportDeliveries).where(and(inArray(scanReportDeliveries.leadId, leadIds), isNotNull(scanReportDeliveries.sentAt)))
    .groupBy(scanReportDeliveries.leadId);
  for (const row of deliveries) states.set(row.leadId, {
    ...states.get(row.leadId)!, reportEmailCount: row.count, lastReportEmailedAt: new Date(row.lastSentAt),
    reportOutreachDisposition: "active", reportViewCount: row.viewCount, reportCtaClickCount: row.ctaClickCount,
    reportLastEngagedAt: row.lastEngagedAt ? new Date(row.lastEngagedAt) : null,
  });
  const notes = await executor.select({ leadId: crmLeadNotes.leadId, metadata: crmLeadNotes.metadata }).from(crmLeadNotes)
    .where(and(inArray(crmLeadNotes.leadId, leadIds), sql`${crmLeadNotes.metadata}->>'reportOutreachDisposition' is not null`))
    .orderBy(desc(crmLeadNotes.createdAt), desc(crmLeadNotes.id));
  const seen = new Set<string>();
  for (const note of notes) {
    if (seen.has(note.leadId)) continue;
    seen.add(note.leadId);
    states.get(note.leadId)!.reportOutreachDisposition = (note.metadata as { reportOutreachDisposition: string }).reportOutreachDisposition;
  }
  if (includeTasks) {
    const tasks = await executor.select({ leadId: followupTasks.leadId, dueDate: followupTasks.dueDate })
      .from(followupTasks).where(and(inArray(followupTasks.leadId, leadIds), eq(followupTasks.completed, false),
        inArray(followupTasks.taskType, [...REPORT_OUTREACH_TASKS]))).orderBy(followupTasks.dueDate);
    for (const task of tasks) {
      if (task.leadId && !states.get(task.leadId)!.reportNextTaskDueAt) states.get(task.leadId)!.reportNextTaskDueAt = task.dueDate;
    }
  }
  for (const state of states.values()) {
    const classified = classifyReportOutreach(state);
    state.reportOutreachSegment = classified.segment;
    state.reportNeedsAttention = classified.needsAttention;
  }
  return states;
}

export async function getReportOutreachState(leadId: string, executor: Tx | typeof db = db) {
  return (await getReportOutreachStates([leadId], executor)).get(leadId)!;
}

export async function ensureReportEmailedStage(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('report-emailed-stage'))`);
  const [existing] = await tx.select().from(pipelineStages).where(eq(pipelineStages.slug, "report-emailed"));
  if (existing) return existing;
  const [contacted] = await tx.select().from(pipelineStages).where(eq(pipelineStages.slug, "contacted"));
  const order = contacted?.sortOrder ?? 1;
  await tx.update(pipelineStages).set({ sortOrder: sql`${pipelineStages.sortOrder} + 1` })
    .where(sql`${pipelineStages.sortOrder} >= ${order}`);
  const [stage] = await tx.insert(pipelineStages).values({
    name: "Report Emailed", slug: "report-emailed", color: "#0891B2", sortOrder: order,
  }).returning();
  return stage;
}

async function closeReportTasks(tx: Tx, leadId: string, now: Date) {
  await tx.update(followupTasks).set({ completed: true, completedAt: now })
    .where(and(eq(followupTasks.leadId, leadId), eq(followupTasks.completed, false),
      inArray(followupTasks.taskType, [...REPORT_OUTREACH_TASKS])));
}

/** Other CRM paths (e.g. a booked demo) also stop the pending email sequence. */
export async function stopReportOutreachForStage(leadId: string, stageSlug: string) {
  if (["new-lead", "report-emailed"].includes(stageSlug)) return;
  await db.transaction(async tx => {
    const [lead] = await tx.select().from(crmLeads).where(eq(crmLeads.id, leadId)).for("update");
    if (!lead) return;
    const state = await getReportOutreachState(leadId, tx);
    if (state.reportEmailCount === 0) {
      const pending = await tx.select({ id: scanReportDeliveries.id }).from(scanReportDeliveries)
        .where(and(eq(scanReportDeliveries.leadId, leadId), inArray(scanReportDeliveries.status, ["queued", "retrying"])));
      if (!pending.length) return;
    }
    if (!state.reportOutreachDisposition || ["active", "no_response"].includes(state.reportOutreachDisposition)) {
      await tx.insert(crmLeadNotes).values({ leadId, type: "system", createdAt: sql`clock_timestamp()`, content: "Report email sequence stopped after pipeline advancement.",
        metadata: { reportOutreachDisposition: stageSlug === "closed-lost" ? "not_interested" : "replied", event: "report_outreach_stopped" } });
    }
    await closeReportTasks(tx, leadId, new Date());
  });
}

/** Runs only after provider acceptance. Lead lock + delivery marker make retries harmless. */
export async function recordReportEmailSent(deliveryId: string, now = new Date()) {
  return db.transaction(async tx => {
    const [initial] = await tx.select().from(scanReportDeliveries).where(eq(scanReportDeliveries.id, deliveryId));
    if (!initial) throw new Error("Report delivery not found");
    const [lead] = await tx.select().from(crmLeads).where(eq(crmLeads.id, initial.leadId)).for("update");
    const [delivery] = await tx.select().from(scanReportDeliveries).where(eq(scanReportDeliveries.id, deliveryId));
    const [processed] = await tx.select({ id: crmLeadNotes.id }).from(crmLeadNotes).where(and(
      eq(crmLeadNotes.leadId, lead.id), sql`${crmLeadNotes.metadata}->>'event' = 'report_email_counted'`,
      sql`${crmLeadNotes.metadata}->>'deliveryId' = ${deliveryId}`,
    )).limit(1);
    if (processed) return;
    now = delivery.sentAt ?? now;
    await tx.update(scanReportDeliveries).set({ status: "sent", sentAt: now, updatedAt: new Date() })
      .where(eq(scanReportDeliveries.id, deliveryId));
    const state = await getReportOutreachState(lead.id, tx);
    const count = state.reportEmailCount;
    await tx.insert(crmLeadNotes).values({ leadId: lead.id, type: "system", createdAt: sql`clock_timestamp()`,
      content: `Report email ${count} sent; outreach tracking updated.`,
      metadata: { event: "report_email_counted", deliveryId, reportOutreachDisposition: state.reportOutreachDisposition ?? "active" },
    });
    // A response recorded while the job was sending must never be undone.
    if (state.reportOutreachDisposition && state.reportOutreachDisposition !== "active") return;
    const opportunities = await tx.select().from(pipelineOpportunities)
      .where(eq(pipelineOpportunities.leadId, lead.id)).for("update");
    const stages = await tx.select().from(pipelineStages);
    const eligible = opportunities.filter(o => o.status === "open" &&
      ["new-lead", "report-emailed"].includes(stages.find(s => s.id === o.stageId)?.slug ?? ""));
    // Do not move an advanced or closed deal backward, or replace its tasks.
    if (opportunities.length && !eligible.length) return;
    const stage = await ensureReportEmailedStage(tx);
    let opportunity = eligible[0];
    if (!opportunity) {
      [opportunity] = await tx.insert(pipelineOpportunities).values({
        title: lead.title, leadId: lead.id, companyId: lead.companyId, contactId: lead.contactId,
        assignedTo: lead.assignedTo, stageId: stage.id, sourceLeadTitle: lead.title,
      }).returning();
    }
    for (const opp of eligible) {
      if (opp.stageId === stage.id) continue;
      await tx.update(pipelineOpportunities).set({ stageId: stage.id, stageEnteredAt: now, updatedAt: now })
        .where(eq(pipelineOpportunities.id, opp.id));
      await tx.insert(pipelineActivities).values({
        opportunityId: opp.id, type: "stage_change", content: "Report email sent: New Lead → Report Emailed",
        metadata: { event: "stage_change", fromStageSlug: "new-lead", toStageSlug: "report-emailed", deliveryId },
      });
    }
    // Retire initial outreach tasks only; leave unrelated custom work intact.
    const oldTasks = await tx.select().from(followupTasks).where(and(
      eq(followupTasks.leadId, lead.id), eq(followupTasks.completed, false),
    ));
    for (const task of oldTasks) {
      if (task.title === "Contact lead" || REPORT_OUTREACH_TASKS.includes(task.taskType as typeof REPORT_OUTREACH_TASKS[number])) {
        await tx.update(followupTasks).set({ completed: true, completedAt: now }).where(eq(followupTasks.id, task.id));
      }
    }
    await tx.insert(followupTasks).values({
      title: count === 1 ? "Send second visibility report email" : "Check report reply — close as No Response if unanswered",
      notes: count === 1
        ? "Check your inbox first. If there is no reply, open this lead and use Email Report to send email 2 of 2. Successful sending completes this task automatically. Do not resend after an opt-out or bounce."
        : "Check your inbox before completing. If unanswered after five business days, choose No response to pause outreach. Do not send a third email.",
      taskType: count === 1 ? "report_email_followup" : "report_email_review",
      dueDate: reportBusinessDate(now, count === 1 ? 7 : 5),
      leadId: lead.id, opportunityId: opportunity.id, companyId: lead.companyId,
      contactId: lead.contactId, assignedTo: opportunity.assignedTo ?? lead.assignedTo,
    });
  });
}

export async function completeReportOutreachTask(task: FollowupTask, input: {
  outcome?: string; completionNote?: string; demoDate?: string;
}, actorId: string) {
  const outcome = input.outcome;
  if (!outcome || !Object.values(REPORT_OUTREACH_OUTCOMES).includes(outcome)) throw new Error("Choose a report outreach outcome.");
  return db.transaction(async tx => {
    if (!task.leadId) throw new Error("Report task has no linked lead.");
    const [lead] = await tx.select().from(crmLeads).where(eq(crmLeads.id, task.leadId)).for("update");
    const [current] = await tx.select().from(followupTasks).where(eq(followupTasks.id, task.id));
    const state = await getReportOutreachState(lead.id, tx);
    // A late reply may resume a sequence previously paused as No Response.
    if (current.completed && (state.reportOutreachDisposition !== "no_response" || outcome === "No response")) return current;
    const now = new Date();
    if (outcome === "No response" && (task.taskType !== "report_email_review" || state.reportEmailCount < 2 ||
      !state.lastReportEmailedAt || reportBusinessDate(now, 0) < reportBusinessDate(state.lastReportEmailedAt, 5))) {
      throw new Error("Wait five business days after the second report email before marking No Response.");
    }
    if (outcome === "Appointment set" && (!input.demoDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.demoDate))) {
      throw new Error("A demo date is required.");
    }
    const disposition = outcome === "No response" ? "no_response" : outcome === "Opted out" ? "opted_out"
      : outcome === "Email bounced" ? "bounced" : outcome === "Not interested" ? "not_interested" : "replied";
    await closeReportTasks(tx, lead.id, now);
    const [completed] = await tx.update(followupTasks).set({ completed: true, completedAt: now,
      outcome, completionNote: input.completionNote ?? null }).where(eq(followupTasks.id, task.id)).returning();
    await tx.insert(crmLeadNotes).values({ leadId: lead.id, userId: actorId, type: "task", createdAt: sql`clock_timestamp()`,
      content: `Report outreach: ${outcome}${input.completionNote ? ` — ${input.completionNote}` : ""}`,
      metadata: { event: "task_completed", outcome, taskId: task.id, reportOutreachDisposition: disposition },
    });
    const targetSlug = outcome === "Appointment set" ? "demo-scheduled" : outcome === "Not interested" ? "closed-lost"
      : disposition === "replied" ? "contacted" : null;
    if (targetSlug && task.opportunityId) {
      const [opp] = await tx.select().from(pipelineOpportunities).where(eq(pipelineOpportunities.id, task.opportunityId)).for("update");
      const stages = await tx.select().from(pipelineStages);
      const oldSlug = stages.find(s => s.id === opp?.stageId)?.slug;
      const target = stages.find(s => s.slug === targetSlug);
      if (!target) throw new Error(`Missing pipeline stage: ${targetSlug}`);
      if (opp?.status === "open" && ["new-lead", "report-emailed"].includes(oldSlug ?? "")) {
        await tx.update(pipelineOpportunities).set({ stageId: target.id, stageEnteredAt: now, updatedAt: now,
          status: targetSlug === "closed-lost" ? "lost" : "open" }).where(eq(pipelineOpportunities.id, opp.id));
        await tx.insert(pipelineActivities).values({ opportunityId: opp.id, userId: actorId, type: "stage_change",
          content: `Report reply: ${oldSlug} → ${target.name}`, metadata: { event: "stage_change", fromStageSlug: oldSlug, toStageSlug: targetSlug } });
        if (targetSlug !== "closed-lost") {
          await tx.insert(followupTasks).values({
            title: targetSlug === "demo-scheduled" ? "Record demo outcome" : "Schedule demo",
            taskType: targetSlug === "demo-scheduled" ? "demo_outcome" : "follow_up",
            dueDate: targetSlug === "demo-scheduled" ? new Date(`${input.demoDate}T00:00:00Z`) : reportBusinessDate(now, 1),
            leadId: lead.id, opportunityId: opp.id, companyId: lead.companyId, contactId: lead.contactId,
            assignedTo: opp.assignedTo, createdBy: actorId,
          });
        }
      }
    }
    return completed;
  });
}
