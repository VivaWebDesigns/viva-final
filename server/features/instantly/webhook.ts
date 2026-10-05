import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  crmLeadNotes,
  crmLeads,
  followupTasks,
  instantlyEnrollments,
  instantlyWebhookEvents,
  pipelineActivities,
  pipelineOpportunities,
  pipelineStages,
  scanReportDeliveries,
  type InstantlyEnrollment,
} from "@shared/schema";
import { db } from "../../db";
import { createScanReportToken, hashScanReportToken } from "../../public-scan-report";
import { closeReportTasks, INSTANTLY_TEMPLATE_PREFIX, recordReportEmailSent } from "../crm/reportOutreach";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface InstantlyWebhookPayload {
  event_type?: string;
  timestamp?: string;
  lead_email?: string;
  email_id?: string;
  step?: number;
  email_subject?: string;
  email_text?: string;
  reply_text_snippet?: string;
  reply_text?: string;
  unibox_url?: string;
  crmLeadId?: string;
  [key: string]: unknown;
}

export function instantlyEventKey(payload: InstantlyWebhookPayload): string {
  if (payload.email_id && payload.event_type) return `${payload.event_type}:${payload.email_id}`;
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

/** Reply-type events: the disposition, the pipeline stage to move to, and the follow-up task. */
const RESPONSE_EVENTS: Record<string, { disposition: string; stageSlug: string; label: string; task: string | null }> = {
  reply_received: { disposition: "replied", stageSlug: "contacted", label: "Reply received", task: "Respond to Instantly reply" },
  lead_interested: { disposition: "replied", stageSlug: "contacted", label: "Marked interested", task: "Follow up — interested in Instantly" },
  lead_meeting_booked: { disposition: "replied", stageSlug: "demo-scheduled", label: "Meeting booked", task: "Confirm meeting booked in Instantly" },
  lead_not_interested: { disposition: "not_interested", stageSlug: "closed-lost", label: "Marked not interested", task: null },
};

const STOP_EVENTS: Record<string, { disposition: string; label: string }> = {
  lead_unsubscribed: { disposition: "opted_out", label: "Unsubscribed in Instantly" },
  email_bounced: { disposition: "bounced", label: "Email bounced in Instantly" },
};

async function findEnrollment(payload: InstantlyWebhookPayload) {
  if (typeof payload.crmLeadId === "string" && payload.crmLeadId) {
    const [byId] = await db.select().from(instantlyEnrollments)
      .where(eq(instantlyEnrollments.leadId, payload.crmLeadId)).limit(1);
    if (byId) return byId;
  }
  const email = payload.lead_email?.trim().toLowerCase();
  if (!email) return null;
  const [byEmail] = await db.select().from(instantlyEnrollments)
    .where(eq(instantlyEnrollments.email, email)).limit(1);
  return byEmail ?? null;
}

/** Moves an open deal that is still at the start of the pipeline; advanced deals are never moved back. */
async function moveEarlyOpportunities(tx: Tx, leadId: string, targetSlug: string, label: string, now: Date) {
  const stages = await tx.select().from(pipelineStages);
  const target = stages.find(stage => stage.slug === targetSlug);
  if (!target) return;
  const opportunities = await tx.select().from(pipelineOpportunities)
    .where(and(eq(pipelineOpportunities.leadId, leadId), eq(pipelineOpportunities.status, "open"))).for("update");
  for (const opportunity of opportunities) {
    const fromSlug = stages.find(stage => stage.id === opportunity.stageId)?.slug ?? "";
    if (!["new-lead", "report-emailed"].includes(fromSlug)) continue;
    await tx.update(pipelineOpportunities).set({
      stageId: target.id,
      stageEnteredAt: now,
      updatedAt: now,
      status: targetSlug === "closed-lost" ? "lost" : "open",
    }).where(eq(pipelineOpportunities.id, opportunity.id));
    await tx.insert(pipelineActivities).values({
      opportunityId: opportunity.id,
      type: "stage_change",
      content: `Instantly ${label.toLowerCase()}: ${fromSlug} → ${target.name}`,
      metadata: { event: "stage_change", fromStageSlug: fromSlug, toStageSlug: targetSlug, source: "instantly" },
    });
  }
}

async function recordSend(enrollment: InstantlyEnrollment, payload: InstantlyWebhookPayload, eventKey: string) {
  const sentAt = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const step = Number(payload.step) || 1;
  const recipient = payload.lead_email ?? enrollment.email;
  const requestId = `instantly:${eventKey}`;
  // A retried event finishes the earlier attempt instead of logging a second send.
  const [existing] = await db.select({ id: scanReportDeliveries.id }).from(scanReportDeliveries)
    .where(eq(scanReportDeliveries.requestId, requestId)).limit(1);
  if (existing) {
    await recordReportEmailSent(existing.id, sentAt);
    return `email_${step}_recorded`;
  }
  const deliveryId = await db.transaction(async tx => {
    const [delivery] = await tx.insert(scanReportDeliveries).values({
      leadId: enrollment.leadId,
      reportId: enrollment.reportId,
      requestId,
      // Instantly emails carry no report link; the token only satisfies the delivery record.
      publicTokenHash: hashScanReportToken(createScanReportToken()),
      recipient,
      imageUrl: enrollment.imageUrl,
      templateKey: `${INSTANTLY_TEMPLATE_PREFIX}-step-${step}`,
      emailSubject: payload.email_subject ?? null,
      emailMessage: payload.email_text ?? null,
      status: "sent",
      sentAt,
    }).returning();
    const [note] = await tx.insert(crmLeadNotes).values({
      leadId: enrollment.leadId,
      type: "email",
      content: `Instantly email ${step} sent to ${recipient}`,
      metadata: { status: "sent", provider: "instantly", step, deliveryId: delivery.id, subject: payload.email_subject ?? null },
    }).returning();
    await tx.update(scanReportDeliveries).set({ noteId: note.id }).where(eq(scanReportDeliveries.id, delivery.id));
    return delivery.id;
  });
  await recordReportEmailSent(deliveryId, sentAt);
  return `email_${step}_recorded`;
}

async function recordResponse(enrollment: InstantlyEnrollment, payload: InstantlyWebhookPayload, eventType: string) {
  const rule = RESPONSE_EVENTS[eventType];
  const now = new Date();
  await db.transaction(async tx => {
    const [lead] = await tx.select().from(crmLeads).where(eq(crmLeads.id, enrollment.leadId)).for("update");
    if (!lead) return;
    const snippet = payload.reply_text_snippet ?? payload.reply_text?.slice(0, 280);
    await tx.insert(crmLeadNotes).values({
      leadId: lead.id,
      type: eventType === "reply_received" ? "email" : "system",
      createdAt: sql`clock_timestamp()`,
      content: `Instantly: ${rule.label}${snippet ? ` — ${snippet}` : ""}`,
      metadata: {
        event: `instantly_${eventType}`,
        reportOutreachDisposition: rule.disposition,
        uniboxUrl: payload.unibox_url ?? null,
        replyText: payload.reply_text ?? null,
      },
    });
    await closeReportTasks(tx, lead.id, now);
    await moveEarlyOpportunities(tx, lead.id, rule.stageSlug, rule.label, now);
    if (rule.task) {
      await tx.insert(followupTasks).values({
        title: rule.task,
        notes: payload.unibox_url ? `Open the conversation in Instantly: ${payload.unibox_url}` : "Check the Instantly inbox for this lead.",
        taskType: "follow_up",
        dueDate: now,
        leadId: lead.id,
        companyId: lead.companyId,
        contactId: lead.contactId,
        assignedTo: lead.assignedTo,
      });
    }
  });
  return `${rule.disposition}_recorded`;
}

async function recordStop(enrollment: InstantlyEnrollment, eventType: string) {
  const rule = STOP_EVENTS[eventType];
  const now = new Date();
  await db.transaction(async tx => {
    await tx.insert(crmLeadNotes).values({
      leadId: enrollment.leadId,
      type: "system",
      createdAt: sql`clock_timestamp()`,
      content: `${rule.label}; report outreach stopped.`,
      metadata: { event: `instantly_${eventType}`, reportOutreachDisposition: rule.disposition },
    });
    await closeReportTasks(tx, enrollment.leadId, now);
    await tx.update(instantlyEnrollments).set({ status: "stopped", lastError: rule.label, updatedAt: now })
      .where(eq(instantlyEnrollments.id, enrollment.id));
  });
  return `${rule.disposition}_recorded`;
}

/** Records one webhook delivery; repeated deliveries of the same event are ignored. */
export async function handleInstantlyWebhook(payload: InstantlyWebhookPayload) {
  const eventType = payload.event_type ?? "unknown";
  const eventKey = instantlyEventKey(payload);
  const [claimed] = await db.insert(instantlyWebhookEvents).values({ eventKey, eventType, payload })
    .onConflictDoNothing().returning();
  if (!claimed) return { outcome: "duplicate" };

  const enrollment = await findEnrollment(payload);
  let outcome = "ignored";
  try {
    if (!enrollment) outcome = "unknown_lead";
    else if (eventType === "email_sent") outcome = await recordSend(enrollment, payload, eventKey);
    else if (RESPONSE_EVENTS[eventType]) outcome = await recordResponse(enrollment, payload, eventType);
    else if (STOP_EVENTS[eventType]) outcome = await recordStop(enrollment, eventType);
  } catch (error) {
    // Release the claim so Instantly's retry of this event is processed, not dropped as a duplicate.
    await db.delete(instantlyWebhookEvents).where(eq(instantlyWebhookEvents.id, claimed.id));
    throw error;
  }

  await db.update(instantlyWebhookEvents)
    .set({ outcome, leadId: enrollment?.leadId ?? null })
    .where(eq(instantlyWebhookEvents.id, claimed.id));
  return { outcome };
}

/** Constant-time check of the shared secret Instantly sends as a custom header. */
export function isValidInstantlyWebhookSecret(received: string | undefined, expected: string | null) {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const INSTANTLY_HANDLED_EVENTS = ["email_sent", ...Object.keys(RESPONSE_EVENTS), ...Object.keys(STOP_EVENTS)];
