import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { reportSendBlockedReason } from "@shared/reportOutreach";
import { getReportOutreachState } from "./reportOutreach";
import {
  crmCompanies,
  crmContacts,
  crmLeadNotes,
  crmLeads,
  localFalconProspectProfiles,
  scanReportDeliveries,
  scanReportShares,
  workflowJobs,
} from "@shared/schema";
import { db } from "../../db";
import { getFileBuffer, uploadPublishedReport } from "../../services/storage";
import {
  createAnonymousScanReportToken,
  createScanReportToken,
  hashScanReportToken,
  scanReportLandingUrl,
} from "../../public-scan-report";

const POSTAL_ADDRESS = "227 W 4th St<br />1st Floor #3127<br />Charlotte, NC 28202";
const PREHEADER_PADDING = "&#847; &zwnj; &nbsp; ".repeat(30);
export const DEFAULT_SCAN_REPORT_PREHEADER = "Your Google Maps scan is ready — see how your business appears across nearby searches.";

export interface ScanReportEmailPreview {
  reportId: string;
  recipient: string;
  from: string;
  replyTo: string;
  subject: string;
  preheader: string;
  message: string;
  businessName: string;
  snapshotPreviewUrl: string;
  sentCount: number;
  blockedReason: string | null;
}

interface SendScanReportInput {
  leadId: string;
  reportId: string;
  recipient: string;
  subject: string;
  preheader: string;
  message: string;
  imagePlacement: "after_intro" | "after_message";
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
  if (!record.contact?.email?.trim() && record.lead.companyId) {
    const [primaryCompanyContact] = await db.select().from(crmContacts)
      .where(eq(crmContacts.companyId, record.lead.companyId))
      .orderBy(desc(crmContacts.isPrimary), desc(crmContacts.createdAt))
      .limit(1);
    if (primaryCompanyContact) return { ...record, contact: primaryCompanyContact };
  }
  return record;
}

export async function getScanReportEmailPreview(
  leadId: string,
  reportId: string,
  actorEmail: string,
): Promise<ScanReportEmailPreview> {
  const record = await loadReport(leadId, reportId);
  const outreach = await getReportOutreachState(leadId);
  const spanish = (record.contact?.preferredLanguage ?? record.company?.preferredLanguage) === "es";
  const firstName = record.contact?.firstName?.trim();
  const businessName = record.report.companyName || record.company?.name || record.lead.title;
  const recipient = record.contact?.email?.trim() || record.company?.email?.trim() || "";
  const greeting = firstName ? ` ${firstName}` : "";
  return {
    reportId,
    sentCount: outreach.reportEmailCount,
    blockedReason: reportSendBlockedReason(outreach.reportEmailCount, outreach.reportOutreachDisposition),
    recipient,
    from: `Viva Web Designs <${scanReportSenderEmail()}>`,
    replyTo: actorReplyTo(actorEmail),
    subject: outreach.reportEmailCount === 1 ? (spanish ? `Seguimiento: ${businessName} en Google Maps` : `Your Google Maps visibility report — ${businessName}`) : spanish
      ? `Así aparece ${businessName} en Google Maps`
      : "Google Maps issues",
    preheader: spanish ? "Tu análisis de Google Maps" : DEFAULT_SCAN_REPORT_PREHEADER,
    message: outreach.reportEmailCount === 1
      ? (spanish
        ? `Hola${greeting},\n\nQuería dar seguimiento al análisis de visibilidad de ${businessName} que te envié. El informe muestra cómo aparece tu negocio en distintas zonas para “${record.report.scanKeyword}”.\n\nIncluyo el mismo informe para que puedas revisarlo. ¿Te gustaría que te explique los resultados en una breve llamada?\n\nMatt`
        : `Hi${greeting},\n\nFollowing up on the visibility report I sent for ${businessName}. It shows how your business appears across nearby searches for “${record.report.scanKeyword}”.\n\nI’ve included the same report so it’s easy to revisit. Would a quick walkthrough of the results be useful?\n\nMatt`)
      : spanish
      ? `Hola${greeting},\n\nPreparamos este análisis de visibilidad local para mostrar cómo aparece ${businessName} en Google Maps cuando los clientes buscan “${record.report.scanKeyword}”.\n\nSi deseas, puedo explicarte lo que muestran los resultados y las oportunidades que encontramos.`
      : `Hi,\n\nI’m Matt with Viva Web Designs here in Charlotte.\n\nI came across ${businessName} and ran a scan to see how the company is showing up in Google Maps when people around you search for your services.\n\nI found some pretty significant visibility gaps, so I thought you’d want to see the actual data.\n\nIf you’ve ever wondered why Google isn’t bringing in more calls, the scan below gives you a pretty good idea of what’s happening.\n\nIf it looks like something you’d want to improve, I can dig deeper into what’s behind it and we can jump on a quick video call. I can pull up the interactive scan and show you exactly who Google is ranking ahead of you from each area.\n\nJust reply here or call/text me.\n\nMatt`,
    businessName,
    snapshotPreviewUrl: `/api/local-visibility/reports/${encodeURIComponent(reportId)}/snapshot-file`,
  };
}

export function buildScanReportEmailHtml(input: {
  message: string;
  imageUrl: string;
  landingUrl: string;
  businessName: string;
  replyTo: string;
  preheader?: string;
  imagePlacement?: "after_intro" | "after_message";
}): string {
  const paragraphs = input.message.trim().split(/\r?\n\s*\r?\n/);
  const paragraphHtml = paragraphs.map((paragraph) => escapeHtml(paragraph).replace(/\r?\n/g, "<br />"));
  const insertAfterIntro = (input.imagePlacement ?? "after_intro") === "after_intro" && paragraphHtml.length > 3;
  const introHtml = insertAfterIntro ? paragraphHtml.slice(0, 3).join("<br /><br />") : paragraphHtml.join("<br /><br />");
  const remainingHtml = insertAfterIntro ? paragraphHtml.slice(3).join("<br /><br />") : "";
  const imageRow = `<tr><td align="center" style="padding:0 20px 24px;">
        <a href="${escapeHtml(input.landingUrl)}" target="_blank" style="text-decoration:none;">
          <img src="${escapeHtml(input.imageUrl)}" alt="Google Maps visibility scan for ${escapeHtml(input.businessName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:8px;" />
        </a>
      </td></tr>`;
  return `<!doctype html>
<html><body style="margin:0;background:#f5f7fa;color:#172033;font-family:Arial,sans-serif;">
  <div style="display:none!important;max-height:0;max-width:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${escapeHtml(input.preheader || DEFAULT_SCAN_REPORT_PREHEADER)}${PREHEADER_PADDING}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7fa;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0f766e;color:#ffffff;padding:22px 28px;font-size:22px;font-weight:700;">Viva Web Designs</td></tr>
      <tr><td style="padding:28px${insertAfterIntro ? " 28px 18px" : ""};font-size:16px;line-height:1.65;">${introHtml}</td></tr>
      ${imageRow}
      ${remainingHtml ? `<tr><td style="padding:0 28px 28px;font-size:16px;line-height:1.65;">${remainingHtml}</td></tr>` : ""}
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
  const beforeUpload = await getReportOutreachState(input.leadId);
  const preflightBlocked = reportSendBlockedReason(beforeUpload.reportEmailCount, beforeUpload.reportOutreachDisposition);
  if (preflightBlocked) throw Object.assign(new Error(preflightBlocked), { statusCode: 409 });
  const file = await getFileBuffer(record.report.snapshotStorageKey!);
  const sha = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const publishedKey = `scans/${input.reportId}/${sha}.png`;
  const published = await uploadPublishedReport(file.buffer, publishedKey, "image/png");
  const imageUrl = published.url;
  const publicToken = createAnonymousScanReportToken(input.reportId);
  const landingUrl = scanReportLandingUrl(publicToken);
  const replyTo = actorReplyTo(input.actorEmail);
  const businessName = record.report.companyName || record.company?.name || record.lead.title;

  // Reserve a send and its outbox job atomically. Parallel clicks cannot exceed two emails.
  return db.transaction(async tx => {
    const [lead] = await tx.select().from(crmLeads).where(eq(crmLeads.id, input.leadId)).for("update");
    const [duplicateJob] = await tx.select({ id: workflowJobs.id }).from(workflowJobs)
      .where(and(eq(workflowJobs.type, "email_notification"), eq(workflowJobs.sourceId, sourceId))).limit(1);
    if (duplicateJob) return { jobId: duplicateJob.id, noteId: null, imageUrl: null, duplicate: true };
    const outreach = await getReportOutreachState(lead.id, tx);
    const blocked = reportSendBlockedReason(outreach.reportEmailCount, outreach.reportOutreachDisposition);
    if (blocked) throw Object.assign(new Error(blocked), { statusCode: 409 });
    const pending = await tx.select({ id: scanReportDeliveries.id }).from(scanReportDeliveries)
      .where(and(eq(scanReportDeliveries.leadId, lead.id), inArray(scanReportDeliveries.status, ["queued", "retrying"])));
    if (pending.length) throw Object.assign(new Error("A report email is already queued. Wait for delivery before sending another."), { statusCode: 409 });

    await tx.insert(scanReportShares).values({
      reportId: input.reportId,
      publicTokenHash: hashScanReportToken(publicToken),
      imageUrl,
    }).onConflictDoUpdate({
      target: scanReportShares.reportId,
      set: {
        publicTokenHash: hashScanReportToken(publicToken),
        imageUrl,
        updatedAt: new Date(),
      },
    });

    const [delivery] = await tx.insert(scanReportDeliveries).values({
      leadId: input.leadId,
      reportId: input.reportId,
      requestId: input.requestId,
      // Delivery bookkeeping remains lead-specific, but this unused token is never sent.
      publicTokenHash: hashScanReportToken(createScanReportToken()),
      recipient: input.recipient,
      imageUrl,
      status: "queued",
    }).returning();

    const [note] = await tx.insert(crmLeadNotes).values({
      leadId: input.leadId,
      userId: input.actorId,
      type: "email",
      content: `Scan report email queued for ${input.recipient}`,
      metadata: {
        status: "queued",
        reportId: input.reportId,
        recipient: input.recipient,
        subject: input.subject,
        preheader: input.preheader,
        imageUrl,
        landingUrl,
        deliveryId: delivery.id,
        imagePlacement: input.imagePlacement,
        requestId: input.requestId,
      },
    }).returning();

    await tx.update(scanReportDeliveries).set({
      noteId: note.id,
      updatedAt: new Date(),
    }).where(eq(scanReportDeliveries.id, delivery.id));

    const [job] = await tx.insert(workflowJobs).values({
      type: "email_notification", status: "pending", sourceId, sourceType: "scan_report_email",
      attempts: 0, maxAttempts: 3, nextRunAt: new Date(), payload: {
      to: input.recipient,
      from: scanReportSenderEmail(),
      replyTo,
      subject: input.subject,
      html: buildScanReportEmailHtml({
        message: input.message,
        imageUrl,
        landingUrl,
        businessName,
        replyTo,
        preheader: input.preheader,
        imagePlacement: input.imagePlacement,
      }),
      // Plain-text-only mail clients cannot display the linked report image.
      text: `${input.message}\n\nOpen your scan report: ${landingUrl}\n\nViva Web Designs, ${POSTAL_ADDRESS}\nTo opt out, reply with Unsubscribe.`,
      noteId: note.id,
      deliveryId: delivery.id,
      category: "scan_report",
      reportId: input.reportId,
      imageUrl,
      landingUrl,
      preheader: input.preheader,
      imagePlacement: input.imagePlacement,
      requestId: input.requestId,
    }}).returning();
    await tx.update(crmLeadNotes).set({
      metadata: { ...(note.metadata as object), jobId: job.id },
    }).where(eq(crmLeadNotes.id, note.id));
    return { jobId: job.id, noteId: note.id, imageUrl, landingUrl, deliveryId: delivery.id, duplicate: false };
  });
}
