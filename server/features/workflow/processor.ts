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

import type { WorkflowJob } from "@shared/schema";
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
  subject: string;
  html: string;
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

  try {
    await ingestWebsiteFormSubmission(
      payload.formData,
      payload.attribution,
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

  try {
    const result = await withTimeout(
      async (_signal) => resend.emails.send({
        from: "Viva Web Designs <info@vivawebdesigns.com>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
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

    logProviderEvent(ctx, "success", { severity: "info", message: `id=${result.data?.id}` });
    recordSuccess("resend", "send_email");
  } catch (err: any) {
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
    throw err;
  }
}
