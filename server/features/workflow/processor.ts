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

import { crmLeadNotes, type WorkflowJob, type UtmAttribution } from "@shared/schema";
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
import { formatEmailSender } from "../../lib/email-sender";

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

export type JobProcessingResult =
  | { status: "completed" }
  | {
      status: "rescheduled";
      payload: Record<string, unknown>;
      nextRunAt: Date;
    };

// ── Processor entry point ─────────────────────────────────────────────

export async function processJob(job: WorkflowJob): Promise<JobProcessingResult> {
  switch (job.type) {
    case "crm_ingest":
      await processCrmIngest(job);
      return { status: "completed" };
    case "email_notification":
      await processEmailNotification(job);
      return { status: "completed" };
    case "sab_report_completion": {
      const { processSabCompletionMonitorJob } = await import("../sab-mcp/completionMonitor");
      return processSabCompletionMonitorJob(job);
    }
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

// ── Email Notification handler ────────────────────────────────────────

async function processEmailNotification(job: WorkflowJob): Promise<void> {
  const payload = job.payload as unknown as EmailNotificationPayload;
  const provider = "resend";
  const ctx = { provider, operation: "send_email", correlationId: job.id };

  if (!payload.to || !payload.subject || !payload.html) {
    throw new Error("email_notification: malformed payload — missing to, subject, or html");
  }
  if (payload.category === "scan_report") {
    throw new Error("Automated prospect delivery is disabled; prepare this message for manual Gmail sending.");
  }

  let providerAccepted = false;
  try {
    const fromEmail = payload.from || CONTACT_EMAIL_FROM;
    let providerMessageId: string | null = null;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await withTimeout(
      async () => resend.emails.send({
        from: formatEmailSender(fromEmail),
        to: payload.to,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        subject: payload.subject,
        html: payload.html,
        ...(payload.text ? { text: payload.text } : {}),
      }, { idempotencyKey: `workflow-email/${job.id}` }),
      RESEND_TIMEOUT_MS,
      ctx,
    );
    if (result.error) throw new Error(`Resend error: ${result.error.message ?? JSON.stringify(result.error)}`);
    providerMessageId = result.data?.id ?? null;

    providerAccepted = true;
    logProviderEvent(ctx, "success", { severity: "info", message: `id=${providerMessageId}` });
    recordSuccess(provider, "send_email");
    if (payload.noteId) {
      await db.update(crmLeadNotes).set({
        content: `Scan report email sent to ${payload.to}`,
        metadata: {
          status: "sent",
          provider,
          providerMessageId,
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
  } catch (err: any) {
    // Do not turn an accepted send into a failed delivery if CRM bookkeeping fails.
    // Resend retries use an idempotency key.
    if (providerAccepted) throw err;
    const isTimeout = err.message?.startsWith("PROVIDER_TIMEOUT");
    const errorClass = isTimeout ? "transient" : classifyProviderError(undefined, err.message);
    if (!isTimeout) {
      logProviderEvent(ctx, "failure", {
        errorClass,
        severity: severityForErrorClass(errorClass),
        message: err.message,
      });
    }
    recordFailure(provider, "send_email", err.message);
    const snap = getSnapshot(provider, "send_email");
    if (snap) warnIfThresholdReached(snap.consecutiveFailures, ctx);
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
    throw err;
  }
}
