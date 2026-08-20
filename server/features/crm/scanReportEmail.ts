import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  crmCompanies,
  crmContacts,
  crmLeadNotes,
  crmLeads,
  localFalconProspectProfiles,
  workflowJobs,
} from "@shared/schema";
import { db } from "../../db";
import { getFileBuffer, uploadPublishedReport } from "../../services/storage";
import { enqueueJob } from "../workflow/queue";

const POSTAL_ADDRESS = "1628 Redcoat Dr, Charlotte, NC 28211";

export interface ScanReportEmailPreview {
  reportId: string;
  recipient: string;
  from: string;
  replyTo: string;
  subject: string;
  message: string;
  businessName: string;
  snapshotPreviewUrl: string;
}

interface SendScanReportInput {
  leadId: string;
  reportId: string;
  recipient: string;
  subject: string;
  message: string;
  requestId: string;
  actorId: string;
  actorEmail: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function scanReportSenderEmail(): string {
  return process.env.SCAN_REPORT_EMAIL_FROM?.trim()
    || process.env.CONTACT_EMAIL_FROM?.trim()
    || "matt@vivawebdesigns.com";
}

function actorReplyTo(actorEmail: string): string {
  return /@vivawebdesigns\.com$/i.test(actorEmail) ? actorEmail : scanReportSenderEmail();
}

async function loadReport(leadId: string, reportId: string) {
  const [record] = await db.select({
    lead: crmLeads,
    report: localFalconProspectProfiles,
    contact: crmContacts,
    company: crmCompanies,
  }).from(localFalconProspectProfiles)
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .leftJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmLeads.companyId, crmCompanies.id))
    .where(and(
      eq(localFalconProspectProfiles.id, reportId),
      eq(localFalconProspectProfiles.leadId, leadId),
    ))
    .limit(1);
  if (!record) throw Object.assign(new Error("Scan report not found for this lead."), { statusCode: 404 });
  if (!record.report.snapshotStorageKey) {
    throw Object.assign(new Error("Generate the finished PNG snapshot before emailing this report."), { statusCode: 409 });
  }
  return record;
}

export async function getScanReportEmailPreview(
  leadId: string,
  reportId: string,
  actorEmail: string,
): Promise<ScanReportEmailPreview> {
  const record = await loadReport(leadId, reportId);
  const spanish = (record.contact?.preferredLanguage ?? record.company?.preferredLanguage) === "es";
  const firstName = record.contact?.firstName?.trim();
  const businessName = record.report.companyName || record.company?.name || record.lead.title;
  const recipient = record.contact?.email?.trim() || record.company?.email?.trim() || "";
  const greeting = firstName ? ` ${firstName}` : "";
  return {
    reportId,
    recipient,
    from: `Viva Web Designs <${scanReportSenderEmail()}>`,
    replyTo: actorReplyTo(actorEmail),
    subject: spanish
      ? `Así aparece ${businessName} en Google Maps`
      : `How ${businessName} appears on Google Maps`,
    message: spanish
      ? `Hola${greeting},\n\nPreparamos este análisis de visibilidad local para mostrar cómo aparece ${businessName} en Google Maps cuando los clientes buscan “${record.report.scanKeyword}”.\n\nSi deseas, puedo explicarte lo que muestran los resultados y las oportunidades que encontramos.`
      : `Hi,\n\nI’m Matt with Viva Web Designs here in Charlotte.\n\nI came across ${businessName} and ran a scan to see how the company is showing up in Google Maps when people around you search for your services.\n\nI found some pretty significant visibility gaps, so I thought you’d want to see the actual data.\n\nIf you’ve ever wondered why Google isn’t bringing in more calls, the scan below gives you a pretty good idea of what’s happening.\n\nIf it looks like something you’d want to improve, I can dig deeper into what’s behind it and we can jump on a quick video call. I can pull up the interactive scan and show you exactly who Google is ranking ahead of you from each area.\n\nJust reply here or call/text me.\n\nMatt`,
    businessName,
    snapshotPreviewUrl: `/api/local-visibility/reports/${encodeURIComponent(reportId)}/snapshot-file`,
  };
}

export function buildScanReportEmailHtml(input: {
  message: string;
  imageUrl: string;
  businessName: string;
  replyTo: string;
}): string {
  const messageHtml = escapeHtml(input.message).replace(/\r?\n/g, "<br />");
  return `<!doctype html>
<html><body style="margin:0;background:#f5f7fa;color:#172033;font-family:Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Your Google Maps visibility scan from Viva Web Designs.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fa;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0f766e;color:#ffffff;padding:22px 28px;font-size:22px;font-weight:700;">Viva Web Designs</td></tr>
      <tr><td style="padding:28px;font-size:16px;line-height:1.65;">${messageHtml}</td></tr>
      <tr><td align="center" style="padding:0 20px 28px;">
        <a href="${escapeHtml(input.imageUrl)}" target="_blank" style="text-decoration:none;">
          <img src="${escapeHtml(input.imageUrl)}" alt="Google Maps visibility scan for ${escapeHtml(input.businessName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:8px;" />
        </a>
      </td></tr>
      <tr><td align="center" style="padding:0 28px 30px;"><a href="${escapeHtml(input.imageUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:7px;font-weight:700;">View the full report</a></td></tr>
      <tr><td style="border-top:1px solid #e5e7eb;padding:20px 28px;color:#6b7280;font-size:12px;line-height:1.55;">
        This is a business advertisement from Viva Web Designs.<br />${POSTAL_ADDRESS}<br />
        To stop receiving marketing emails, reply to <a href="mailto:${escapeHtml(input.replyTo)}?subject=Unsubscribe">${escapeHtml(input.replyTo)}</a> with “Unsubscribe.”
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendScanReportEmail(input: SendScanReportInput) {
  const record = await loadReport(input.leadId, input.reportId);
  const sourceId = `scan-report:${input.requestId}`;
  const [existingJob] = await db.select({ id: workflowJobs.id })
    .from(workflowJobs)
    .where(and(eq(workflowJobs.type, "email_notification"), eq(workflowJobs.sourceId, sourceId)))
    .limit(1);
  if (existingJob) {
    return { jobId: existingJob.id, noteId: null, imageUrl: null, duplicate: true };
  }
  const file = await getFileBuffer(record.report.snapshotStorageKey!);
  const sha = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const publishedKey = `scans/${input.reportId}/${sha}.png`;
  const published = await uploadPublishedReport(file.buffer, publishedKey, "image/png");
  const imageUrl = published.url;
  const replyTo = actorReplyTo(input.actorEmail);
  const businessName = record.report.companyName || record.company?.name || record.lead.title;

  const [note] = await db.insert(crmLeadNotes).values({
    leadId: input.leadId,
    userId: input.actorId,
    type: "email",
    content: `Scan report email queued for ${input.recipient}`,
    metadata: {
      status: "queued",
      reportId: input.reportId,
      recipient: input.recipient,
      subject: input.subject,
      imageUrl,
      requestId: input.requestId,
    },
  }).returning();

  try {
    const job = await enqueueJob("email_notification", {
      to: input.recipient,
      replyTo,
      subject: input.subject,
      html: buildScanReportEmailHtml({ message: input.message, imageUrl, businessName, replyTo }),
      text: `${input.message}\n\nView the full report: ${imageUrl}\n\nViva Web Designs, ${POSTAL_ADDRESS}\nTo opt out, reply with Unsubscribe.`,
      noteId: note.id,
      category: "scan_report",
      reportId: input.reportId,
      imageUrl,
      requestId: input.requestId,
    }, sourceId, "scan_report_email");
    await db.update(crmLeadNotes).set({
      metadata: { ...(note.metadata as object), jobId: job.id },
    }).where(eq(crmLeadNotes.id, note.id));
    return { jobId: job.id, noteId: note.id, imageUrl, duplicate: false };
  } catch (error) {
    await db.update(crmLeadNotes).set({
      content: `Scan report email could not be queued for ${input.recipient}`,
      metadata: { ...(note.metadata as object), status: "failed" },
    }).where(eq(crmLeadNotes.id, note.id));
    throw error;
  }
}
