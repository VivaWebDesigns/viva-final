import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { getHistory } from "./service";
import { db } from "../../db";
import { clientNotes, crmLeadNotes, pipelineActivities, crmLeads, pipelineOpportunities, recordHistory, user } from "@shared/schema";
import { eq, inArray, desc, and } from "drizzle-orm";

const router = Router();

router.get("/client/:entityId", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const companyId = req.params.entityId as string;
    const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 200) : 100;

    const [leadRows, oppRows] = await Promise.all([
      db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.companyId, companyId)),
      db.select({ id: pipelineOpportunities.id }).from(pipelineOpportunities).where(eq(pipelineOpportunities.companyId, companyId)),
    ]);
    const leadIds = leadRows.map(l => l.id);
    const oppIds  = oppRows.map(o => o.id);

    const [histRows, noteRows, leadNoteRows, actRows] = await Promise.all([
      db.select().from(recordHistory)
        .where(and(eq(recordHistory.entityType, "client"), eq(recordHistory.entityId, companyId)))
        .orderBy(desc(recordHistory.createdAt))
        .limit(limit),
      db.select().from(clientNotes)
        .where(eq(clientNotes.companyId, companyId))
        .orderBy(desc(clientNotes.createdAt))
        .limit(limit),
      leadIds.length
        ? db.select().from(crmLeadNotes)
            .where(inArray(crmLeadNotes.leadId, leadIds))
            .orderBy(desc(crmLeadNotes.createdAt))
            .limit(limit)
        : Promise.resolve([] as (typeof crmLeadNotes.$inferSelect)[]),
      oppIds.length
        ? db.select().from(pipelineActivities)
            .where(inArray(pipelineActivities.opportunityId, oppIds))
            .orderBy(desc(pipelineActivities.createdAt))
            .limit(limit)
        : Promise.resolve([] as (typeof pipelineActivities.$inferSelect)[]),
    ]);

    const allUserIds = new Set<string>();
    for (const r of noteRows)     { if (r.userId) allUserIds.add(r.userId); }
    for (const r of leadNoteRows) { if (r.userId) allUserIds.add(r.userId); }
    for (const r of actRows)      { if (r.userId) allUserIds.add(r.userId); }

    const actorMap = new Map<string, string>();
    if (allUserIds.size > 0) {
      const actors = await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, [...allUserIds]));
      for (const a of actors) actorMap.set(a.id, a.name ?? a.id);
    }

    type TimelineEvent = {
      id: string;
      event: string;
      entityType: string;
      entityId: string;
      actorId?: string | null;
      actorName?: string | null;
      fieldName?: string | null;
      fromValue?: string | null;
      toValue?: string | null;
      note?: string | null;
      metadata?: Record<string, unknown> | null;
      createdAt: string;
    };

    const events: TimelineEvent[] = [];

    for (const h of histRows) {
      events.push({
        id: h.id,
        event: h.event,
        entityType: h.entityType,
        entityId: h.entityId,
        actorId: h.actorId ?? null,
        actorName: h.actorName ?? null,
        fieldName: h.fieldName ?? null,
        fromValue: h.fromValue ?? null,
        toValue: h.toValue ?? null,
        note: h.note ?? null,
        createdAt: h.createdAt.toISOString(),
      });
    }

    for (const n of noteRows) {
      events.push({
        id: n.id,
        event: "note_added",
        entityType: "client",
        entityId: companyId,
        actorId: n.userId ?? null,
        actorName: n.userId ? (actorMap.get(n.userId) ?? null) : null,
        fieldName: null,
        fromValue: null,
        toValue: null,
        note: n.content,
        createdAt: n.createdAt.toISOString(),
      });
    }

    for (const n of leadNoteRows) {
      const meta = (n.metadata ?? {}) as Record<string, unknown>;
      const metaEvent = (meta.event as string) ?? null;
      let event = "note_added";
      let note = n.content;
      if (metaEvent === "task_completed") {
        event = "task_completed";
        const parts: string[] = [];
        if (meta.taskTitle) parts.push(meta.taskTitle as string);
        if (meta.outcome)   parts.push(`Outcome: ${meta.outcome}`);
        if (meta.completionNote) parts.push(`Note: ${meta.completionNote}`);
        note = parts.join(" · ") || n.content;
      } else if (metaEvent === "follow_up_scheduled") {
        event = "task_created";
        note = (meta.taskTitle as string) ?? n.content;
      }
      events.push({
        id: n.id,
        event,
        entityType: "lead",
        entityId: n.leadId,
        actorId: n.userId ?? null,
        actorName: n.userId ? (actorMap.get(n.userId) ?? null) : null,
        fieldName: null,
        fromValue: null,
        toValue: null,
        note,
        metadata: (metaEvent === "task_completed" || metaEvent === "follow_up_scheduled") ? (n.metadata as Record<string, unknown>) : null,
        createdAt: n.createdAt.toISOString(),
      });
    }

    for (const a of actRows) {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      const metaEvent = (meta.event as string) ?? null;
      let event = metaEvent ?? a.type ?? "activity";
      let note: string | null = a.content;
      let fromValue: string | null = null;
      let toValue: string | null = null;
      if (metaEvent === "task_completed") {
        event = "task_completed";
        const parts: string[] = [];
        if (meta.taskTitle) parts.push(meta.taskTitle as string);
        if (meta.outcome)   parts.push(`Outcome: ${meta.outcome}`);
        if (meta.completionNote) parts.push(`Note: ${meta.completionNote}`);
        note = parts.join(" · ") || a.content;
      } else if (metaEvent === "follow_up_scheduled") {
        event = "task_created";
        note = (meta.taskTitle as string) ?? a.content;
      } else if (metaEvent === "stage_changed") {
        event = "stage_changed";
        fromValue = (meta.fromStageName as string) ?? null;
        toValue = (meta.toStageName as string) ?? null;
        note = null;
      }
      events.push({
        id: a.id,
        event,
        entityType: "opportunity",
        entityId: a.opportunityId,
        actorId: a.userId ?? null,
        actorName: a.userId ? (actorMap.get(a.userId) ?? null) : null,
        fieldName: null,
        fromValue,
        toValue,
        note,
        metadata: (metaEvent === "task_completed" || metaEvent === "follow_up_scheduled") ? (a.metadata as Record<string, unknown>) : null,
        createdAt: a.createdAt.toISOString(),
      });
    }

    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(events.slice(0, limit));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:entityType/:entityId", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { entityType, entityId } = req.params as Record<string, string>;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const events = await getHistory(entityType, entityId, Math.min(limit, 200));
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
