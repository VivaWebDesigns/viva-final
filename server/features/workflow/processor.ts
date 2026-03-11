/**
 * Workflow Job Processor
 *
 * Routes each job type to its handler. Called by the worker after claiming a job.
 * Throws on failure so the worker can apply retry/backoff logic.
 */

import type { WorkflowJob } from "@shared/schema";
import { ingestWebsiteFormSubmission } from "../crm/ingest";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  const payload = job.payload as unknown as CrmIngestPayload;

  if (!payload.formData || !payload.attribution || !payload.sourceType) {
    throw new Error("crm_ingest: malformed payload — missing formData, attribution, or sourceType");
  }

  await ingestWebsiteFormSubmission(
    payload.formData,
    payload.attribution,
    payload.sourceType,
  );
}

// ── Email Notification handler ────────────────────────────────────────

async function processEmailNotification(job: WorkflowJob): Promise<void> {
  const payload = job.payload as unknown as EmailNotificationPayload;

  if (!payload.to || !payload.subject || !payload.html) {
    throw new Error("email_notification: malformed payload — missing to, subject, or html");
  }

  const result = await resend.emails.send({
    from: "Viva Web Designs <info@vivawebdesigns.com>",
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message ?? JSON.stringify(result.error)}`);
  }
}
