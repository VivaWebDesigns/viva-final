/**
 * Workflow Job Processor
 *
 * Routes each job type to its handler. Called by the worker after claiming a job.
 * Throws on failure so the worker can apply retry/backoff logic.
 *
 * Resilience:
 *   - Resend calls are wrapped with a 15s timeout
 *   - All calls use structured error classification
 *   - Success/failure recorded in provider snapshot for admin diagnostics
 */

import { crmLeadNotes, scanReportDeliveries, type WorkflowJob, type UtmAttribution } from "@shared/schema";
import { getReportOutreachState, recordReportEmailSent } from "../crm/reportOutreach";
import { reportSendBlockedReason } from "@shared/reportOutreach";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { ingestWebsiteFormSubmission } from "../crm/ingest";
import { Resend } from "resend";
import {
  withTimeout,
  classifyProviderError,
  logProviderEvent,
  severityForErrorClass,
  warnIfThresholdReached,
} from "../../lib/provider-resilience";
import { recordSuccess, recordFailure, getSnapshot } from "../../lib/provider-snapshot";

const RESEND_TIMEOUT_MS = 15_000;
const CONTACT_EMAIL_FROM =
  process.env.CONTACT_EMAIL_FROM || "matt@vivawebdesigns.com";

// ── Job payload types ─────────────────────────────────────────────────

interface CrmIngestPayload {
  formData: {
    name: string;
    email?: string;
    phone: string;
    business?: string;
    city?: string;
    trade?: string;
    service?: string;
    message?: string;
    zipCode?: string;
  };
  attribution: {
    honeypot?: string;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    utmTerm?: string | null;
    utmContent?: string | null;
    referrer?: string | null;
    landingPage?: string | null;
    formPageUrl?: string | null;
  };
  sourceType: "contact_form" | "demo_inquiry";
}

interface EmailNotificationPayload {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  noteId?: string;
  deliveryId?: string;
  category?: string;
  reportId?: string;
  imageUrl?: string;
  landingUrl?: string;
  requestId?: string;
}

// ── Processor entry point ─────────────────────────────────────────────

export async function processJob(job: WorkflowJob): Promise<void> {
  switch (job.type) {
    case "crm_ingest":
      return processCrmIngest(job);
    case "email_notification":
      return processEmailNotification(job);
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

// ── CRM Ingest handler ────────────────────────────────────────────────

async function processCrmIngest(job: WorkflowJob): Promise<void> {
  const ctx = { provider: "crm", operation: "ingest", correlationId: job.id };
  const payload = job.payload as unknown as CrmIngestPayload;

  if (!payload.formData || !payload.attribution || !payload.sourceType) {
    throw new Error("crm_ingest: malformed payload — missing formData, attribution, or sourceType");
  }

  // Coerce null → undefined to satisfy UtmAttribution (which uses string | undefined)
  const attribution: UtmAttribution = {
    honeypot:     payload.attribution.honeypot     ?? undefined,
    utmSource:    payload.attribution.utmSource    ?? undefined,
    utmMedium:    payload.attribution.utmMedium    ?? undefined,
    utmCampaign:  payload.attribution.utmCampaign  ?? undefined,
    utmTerm:      payload.attribution.utmTerm      ?? undefined,
    utmContent:   payload.attribution.utmContent   ?? undefined,
    referrer:     payload.attribution.referrer     ?? undefined,
    landingPage:  payload.attribution.landingPage  ?? undefined,
    formPageUrl:  payload.attribution.formPageUrl  ?? undefined,
  };

  try {
    await ingestWebsiteFormSubmission(
      payload.formData,
      attribution,
      payload.sourceType,
    );
    logProviderEvent(ctx, "success", { severity: "info" });
    recordSuccess("crm", "ingest");
  } catch (err: any) {
    const errorClass = classifyProviderError(undefined, err.message);
    logProviderEvent(ctx, "failure", {
      errorClass,
      severity: severityForErrorClass(errorClass),
      message: err.message,
    });
    recordFailure("crm", "ingest", err.message);
    const snap = getSnapshot("crm", "ingest");
    if (snap) warnIfThresholdReached(snap.consecutiveFailures, ctx);
    throw err;
  }
}

// ── Email Notification handler (Resend) ───────────────────────────────

async function processEmailNotification(job: WorkflowJob): Promise<void> {
  const ctx = { provider: "resend", operation: "send_email", correlationId: job.id };
  const payload = job.payload as unknown as EmailNotificationPayload;

  if (!payload.to || !payload.subject || !payload.html) {
    throw new Error("email_notification: malformed payload — missing to, subject, or html");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  if (payload.category === "scan_report" && payload.deliveryId) {
    const [delivery] = await db.select().from(scanReportDeliveries).where(eq(scanReportDeliveries.id, payload.deliveryId));
    if (delivery?.sentAt) {
      await recordReportEmailSent(delivery.id);
      return;
    }
    if (delivery) {
      const state = await getReportOutreachState(delivery.leadId);
      const reason = reportSendBlockedReason(state.reportEmailCount, state.reportOutreachDisposition);
      if (reason) {
        await db.update(scanReportDeliveries).set({ status: "cancelled", updatedAt: new Date() }).where(eq(scanReportDeliveries.id, delivery.id));
        if (payload.noteId) await db.update(crmLeadNotes).set({ content: `Report email cancelled: ${reason}`, metadata: { status: "cancelled", deliveryId: delivery.id } }).where(eq(crmLeadNotes.id, payload.noteId));
        return;
      }
    }
  }

  let providerAccepted = false;
  try {
    const result = await withTimeout(
      async (_signal) => resend.emails.send({
        from: `Viva Web Designs <${payload.from || CONTACT_EMAIL_FROM}>`,
        to: payload.to,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.category === "scan_report" ? {
          headers: { "List-Unsubscribe": `<mailto:${payload.replyTo || CONTACT_EMAIL_FROM}?subject=Unsubscribe>` },
          tags: [{ name: "category", value: "scan_report" }],
        } : {}),
      }, { idempotencyKey: `workflow-email/${job.id}` }),
      RESEND_TIMEOUT_MS,
      ctx,
    );

    if (result.error) {
      const errorClass = classifyProviderError(undefined, result.error.message ?? "Resend error");
      logProviderEvent(ctx, "failure", {
        errorClass,
        severity: severityForErrorClass(errorClass),
        message: result.error.message ?? JSON.stringify(result.error),
      });
      recordFailure("resend", "send_email", result.error.message ?? "Resend API error");
      const snap = getSnapshot("resend", "send_email");
      if (snap) warnIfThresholdReached(snap.consecutiveFailures, ctx);
      throw new Error(`Resend error: ${result.error.message ?? JSON.stringify(result.error)}`);
    }

    providerAccepted = true;
    logProviderEvent(ctx, "success", { severity: "info", message: `id=${result.data?.id}` });
    recordSuccess("resend", "send_email");
    if (payload.noteId) {
      await db.update(crmLeadNotes).set({
        content: `Scan report email sent to ${payload.to}`,
        metadata: {
          status: "sent",
          provider: "resend",
          providerMessageId: result.data?.id ?? null,
          reportId: payload.reportId,
          recipient: payload.to,
          subject: payload.subject,
          imageUrl: payload.imageUrl,
          landingUrl: payload.landingUrl,
          deliveryId: payload.deliveryId,
          requestId: payload.requestId,
          jobId: job.id,
        },
      }).where(eq(crmLeadNotes.id, payload.noteId));
    }
    if (payload.deliveryId) {
      await db.update(scanReportDeliveries).set({
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(scanReportDeliveries.id, payload.deliveryId));
      await recordReportEmailSent(payload.deliveryId);
    }
  } catch (err: any) {
    // Do not turn an accepted send into a failed delivery if CRM bookkeeping fails.
    // Retrying uses the provider idempotency key, or skips sending once sentAt exists.
    if (providerAccepted) throw err;
    if (!err.message?.startsWith("Resend error:")) {
      // Catch network/timeout errors not already logged
      const isTimeout = err.message?.startsWith("PROVIDER_TIMEOUT");
      const errorClass = isTimeout ? "transient" : classifyProviderError(undefined, err.message);
      if (!isTimeout) {
        logProviderEvent(ctx, "failure", {
          errorClass,
          severity: severityForErrorClass(errorClass),
          message: err.message,
        });
      }
      recordFailure("resend", "send_email", err.message);
      const snap = getSnapshot("resend", "send_email");
      if (snap) warnIfThresholdReached(snap.consecutiveFailures, ctx);
    }
    if (payload.noteId) {
      const exhausted = job.attempts >= job.maxAttempts;
      await db.update(crmLeadNotes).set({
        content: exhausted
          ? `Scan report email failed for ${payload.to}`
          : `Scan report email delivery will retry for ${payload.to}`,
        metadata: {
          status: exhausted ? "failed" : "retrying",
          error: err.message,
          reportId: payload.reportId,
          recipient: payload.to,
          subject: payload.subject,
          imageUrl: payload.imageUrl,
          landingUrl: payload.landingUrl,
          deliveryId: payload.deliveryId,
          requestId: payload.requestId,
          jobId: job.id,
        },
      }).where(eq(crmLeadNotes.id, payload.noteId));
    }
    if (payload.deliveryId) {
      const exhausted = job.attempts >= job.maxAttempts;
      await db.update(scanReportDeliveries).set({
        status: exhausted ? "failed" : "retrying",
        updatedAt: new Date(),
      }).where(eq(scanReportDeliveries.id, payload.deliveryId));
    }
    throw err;
  }
}
