import { and, desc, eq, notInArray } from "drizzle-orm";
import {
  crmCompanies,
  crmContacts,
  crmLeads,
  localFalconProspectProfiles,
  smsMessages,
  smsOptOuts,
  smsScanSends,
  user,
} from "@shared/schema";
import { formatPhoneDisplay, normalizePhoneDigits, toE164Phone } from "@shared/phone";
import {
  SCAN_TEXT_CONSENT_SCRIPT,
  SCAN_TEXT_FAILED_STATUSES,
  SCAN_TEXT_MESSAGE,
  isOptInKeyword,
  optOutKeyword,
} from "@shared/scanText";
import { db } from "../../db";
import * as crmStorage from "../crm/storage";
import { publishColdEmailImage } from "../instantly/enrollment";
import { sendEmail } from "../notifications/mailgun";
import { PUBLIC_SITE_URL, TwilioSendError, isTwilioConfigured, sendTwilioMessage } from "./twilio";

// Matt answers text replies himself; override with SMS_REPLY_ALERT_EMAIL.
const DEFAULT_ALERT_EMAIL = "matt@vivawebdesigns.com";

function httpError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

/** E.164 for a 10-digit US number, otherwise null. */
export function toUsE164(raw: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(raw ?? "");
  return digits.length === 10 ? toE164Phone(digits) : null;
}

interface Actor {
  id: string;
  name: string | null;
  role: string;
}

async function loadLeadReport(leadId: string, reportId: string) {
  const [record] = await db.select({
    lead: crmLeads,
    report: localFalconProspectProfiles,
    contact: crmContacts,
    company: crmCompanies,
  }).from(localFalconProspectProfiles)
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .leftJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmLeads.companyId, crmCompanies.id))
    .where(and(eq(localFalconProspectProfiles.id, reportId), eq(localFalconProspectProfiles.leadId, leadId)))
    .limit(1);
  if (!record) throw httpError("Scan report not found for this lead.", 404);
  return record;
}

/** The nearby competitor's report linked to a lead's report, if any. */
async function loadCompetitorReport(competitorReportId: string | null) {
  if (!competitorReportId) return null;
  const [competitor] = await db.select().from(localFalconProspectProfiles)
    .where(and(eq(localFalconProspectProfiles.id, competitorReportId), eq(localFalconProspectProfiles.scanRole, "competitor")))
    .limit(1);
  return competitor ?? null;
}

/** The latest send that may have reached the lead. Failed sends don't block a retry. */
async function activeScanSend(leadId: string) {
  const [row] = await db.select({ send: smsScanSends, senderName: user.name })
    .from(smsScanSends)
    .leftJoin(user, eq(smsScanSends.consentByUserId, user.id))
    .where(and(eq(smsScanSends.leadId, leadId), notInArray(smsScanSends.status, SCAN_TEXT_FAILED_STATUSES)))
    .orderBy(desc(smsScanSends.createdAt))
    .limit(1);
  return row ?? null;
}

async function isOptedOut(phone: string) {
  const [row] = await db.select().from(smsOptOuts).where(eq(smsOptOuts.phone, phone)).limit(1);
  return !!row;
}

function describeSend(row: NonNullable<Awaited<ReturnType<typeof activeScanSend>>>) {
  return {
    status: row.send.status,
    toNumber: formatPhoneDisplay(row.send.toNumber),
    sentAt: row.send.createdAt,
    sentBy: row.senderName,
  };
}

export async function getScanTextPreview(leadId: string, reportId: string, actor: Actor) {
  const { report, contact, company } = await loadLeadReport(leadId, reportId);
  const competitor = await loadCompetitorReport(report.competitorReportId);
  const existing = await activeScanSend(leadId);
  const suggested = contact?.phone || company?.phone || "";
  const suggestedE164 = toUsE164(suggested);
  return {
    configured: isTwilioConfigured(),
    businessName: report.companyName || company?.name || "this business",
    hasSnapshot: !!report.snapshotStorageKey,
    suggestedNumber: suggested ? formatPhoneDisplay(suggested) : "",
    suggestedNumberOptedOut: suggestedE164 ? await isOptedOut(suggestedE164) : false,
    script: SCAN_TEXT_CONSENT_SCRIPT,
    message: SCAN_TEXT_MESSAGE,
    competitor: competitor ? {
      businessName: competitor.companyName || "Nearby competitor",
      hasSnapshot: !!competitor.snapshotStorageKey,
    } : null,
    canEditMessage: actor.role === "admin",
    existingSend: existing ? describeSend(existing) : null,
  };
}

export async function sendScanText(input: {
  leadId: string;
  reportId: string;
  toNumber: string;
  message?: string;
  /** Also attach the linked competitor's report to the same one text. */
  includeCompetitor?: boolean;
  actor: Actor;
}) {
  const to = toUsE164(input.toNumber);
  if (!to) throw httpError("Enter a 10-digit US mobile number.", 400);
  if (await isOptedOut(to)) throw httpError(`${formatPhoneDisplay(to)} replied STOP and can't be texted.`, 409);

  const existing = await activeScanSend(input.leadId);
  if (existing) {
    const info = describeSend(existing);
    throw httpError(
      `This lead's scan was already texted to ${info.toNumber}${info.sentBy ? ` by ${info.sentBy}` : ""} on ${info.sentAt.toLocaleDateString("en-US")}.`,
      409,
    );
  }

  const { report } = await loadLeadReport(input.leadId, input.reportId);
  if (!report.snapshotStorageKey) throw httpError("Generate the finished snapshot before texting this report.", 409);
  const competitor = input.includeCompetitor ? await loadCompetitorReport(report.competitorReportId) : null;
  if (input.includeCompetitor && !competitor?.snapshotStorageKey) {
    throw httpError("This lead has no competitor report with a finished snapshot.", 409);
  }

  // Both pictures go out under the same approved script and message. Only admins may change the wording.
  const edited = input.actor.role === "admin" && !!input.message?.trim() && input.message.trim() !== SCAN_TEXT_MESSAGE;
  const content = edited ? input.message!.trim() : SCAN_TEXT_MESSAGE;
  const { imageUrl } = await publishColdEmailImage(report.id, report.snapshotStorageKey);
  const competitorImageUrl = competitor
    ? (await publishColdEmailImage(competitor.id, competitor.snapshotStorageKey!)).imageUrl
    : null;

  // Consent is recorded before anything is sent.
  const [send] = await db.insert(smsScanSends).values({
    leadId: input.leadId,
    reportId: report.id,
    toNumber: to,
    consentAt: new Date(),
    consentByUserId: input.actor.id,
    consentScript: SCAN_TEXT_CONSENT_SCRIPT,
    content,
    contentEdited: edited,
    imageUrl,
    status: "sending",
  }).returning();

  let result;
  try {
    result = await sendTwilioMessage({ to, body: content, mediaUrl: competitorImageUrl ? [imageUrl, competitorImageUrl] : imageUrl });
  } catch (error) {
    const code = error instanceof TwilioSendError ? error.code : null;
    await db.update(smsScanSends).set({
      status: "failed",
      errorCode: code,
      errorMessage: (error as Error).message,
      updatedAt: new Date(),
    }).where(eq(smsScanSends.id, send.id));
    if (code === "21610") await recordOptOut(to, null, "twilio_error");
    throw error;
  }

  await db.update(smsScanSends).set({ twilioMessageSid: result.sid, status: result.status, updatedAt: new Date() })
    .where(eq(smsScanSends.id, send.id));
  await crmStorage.createSmsMessage({
    leadId: input.leadId,
    direction: "outbound",
    fromNumber: "twilio",
    toNumber: to,
    content: `${content}\n${competitor ? `[Scan images attached: their report and ${competitor.companyName ?? "a nearby competitor"}'s]` : "[Scan image attached]"}`,
    senderName: input.actor.name,
    twilioMessageSid: result.sid,
    status: result.status,
    sentAt: new Date(),
  });
  await crmStorage.addLeadNote({
    leadId: input.leadId,
    userId: input.actor.id,
    type: "sms",
    content: `${competitor ? `Scan and ${competitor.companyName ?? "competitor"}'s scan` : "Scan"} texted to ${formatPhoneDisplay(to)} after verbal consent on the call.${edited ? " Message was edited." : ""}`,
    metadata: {
      via: "twilio", scanSendId: send.id, reportId: report.id, to, imageUrl, contentEdited: edited,
      ...(competitor ? { competitorReportId: competitor.id, competitorImageUrl } : {}),
    },
  });
  return { sendId: send.id, toNumber: formatPhoneDisplay(to), status: result.status };
}

/** Replies only continue a conversation the lead started, to the number they texted from. */
export async function sendSmsReply(input: { leadId: string; content: string; actor: Actor }) {
  const [lastInbound] = await db.select().from(smsMessages)
    .where(and(eq(smsMessages.leadId, input.leadId), eq(smsMessages.direction, "inbound")))
    .orderBy(desc(smsMessages.sentAt))
    .limit(1);
  if (!lastInbound) throw httpError("You can reply once the lead has texted back.", 409);
  const to = lastInbound.fromNumber;
  if (await isOptedOut(to)) throw httpError(`${formatPhoneDisplay(to)} replied STOP and can't be texted.`, 409);

  const content = input.content.trim();
  const result = await sendTwilioMessage({ to, body: content });
  const message = await crmStorage.createSmsMessage({
    leadId: input.leadId,
    direction: "outbound",
    fromNumber: "twilio",
    toNumber: to,
    content,
    senderName: input.actor.name,
    twilioMessageSid: result.sid,
    status: result.status,
    sentAt: new Date(),
  });
  await crmStorage.addLeadNote({
    leadId: input.leadId,
    userId: input.actor.id,
    type: "sms",
    content,
    metadata: { via: "twilio", to },
  });
  return message;
}

async function recordOptOut(phone: string, keyword: string | null, source: "inbound_keyword" | "twilio_error") {
  await db.insert(smsOptOuts).values({ phone, keyword, source }).onConflictDoNothing();
}

/** The lead a number belongs to: whoever we last texted the scan to, else the last conversation. */
async function findLeadForNumber(phone: string) {
  const [send] = await db.select({ leadId: smsScanSends.leadId }).from(smsScanSends)
    .where(eq(smsScanSends.toNumber, phone)).orderBy(desc(smsScanSends.createdAt)).limit(1);
  if (send) return send.leadId;
  const [message] = await db.select({ leadId: smsMessages.leadId }).from(smsMessages)
    .where(eq(smsMessages.toNumber, phone)).orderBy(desc(smsMessages.sentAt)).limit(1);
  return message?.leadId ?? null;
}

async function leadSummary(leadId: string) {
  const [row] = await db.select({ lead: crmLeads, contact: crmContacts, company: crmCompanies })
    .from(crmLeads)
    .leftJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmLeads.companyId, crmCompanies.id))
    .where(eq(crmLeads.id, leadId))
    .limit(1);
  if (!row) return null;
  const contactName = [row.contact?.firstName, row.contact?.lastName].filter(Boolean).join(" ").trim();
  return { companyName: row.company?.name || row.lead.title, contactName: contactName || null };
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface SmsReplyAlertInput {
  leadId: string | null;
  companyName: string | null;
  contactName: string | null;
  fromNumber: string;
  body: string;
  mediaCount: number;
  optedOut: boolean;
}

/** Subject and HTML for the "a lead texted back" email. */
export function buildSmsReplyAlert(input: SmsReplyAlertInput) {
  const phone = formatPhoneDisplay(input.fromNumber);
  const who = input.companyName || phone;
  const subject = `Text reply from ${who}${input.optedOut ? " (opted out)" : ""}`;
  const heading = [input.companyName, input.contactName, phone].filter(Boolean).map(value => escapeHtml(value!)).join(" &middot; ");
  const body = input.body.trim();
  const crmLink = input.leadId
    ? `<p><a href="${escapeHtml(`${PUBLIC_SITE_URL}/admin/crm/leads/${encodeURIComponent(input.leadId)}`)}">Open lead in CRM</a></p>`
    : "<p>This number isn't matched to a lead in the CRM.</p>";
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p><strong>${heading}</strong></p>
<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ccc;color:#333;white-space:pre-wrap">${body ? escapeHtml(body) : "<em>No text in the message.</em>"}</blockquote>
${input.mediaCount > 0 ? `<p>They also sent ${input.mediaCount} picture${input.mediaCount === 1 ? "" : "s"}; see Twilio's message log.</p>` : ""}
${input.optedOut ? "<p>They opted out, so the CRM won't text this number again. Twilio already sent the unsubscribe confirmation.</p>" : ""}
${crmLink}
</div>`;
  return { subject, html };
}

/** Saves an inbound text, applies STOP/START, and emails Matt. */
export async function handleInboundSms(params: Record<string, string>) {
  const from = toUsE164(params.From) ?? params.From;
  const body = params.Body ?? "";
  const mediaCount = Number(params.NumMedia ?? 0) || 0;
  const leadId = await findLeadForNumber(from);

  const keyword = optOutKeyword(body);
  if (keyword) await recordOptOut(from, keyword, "inbound_keyword");
  else if (isOptInKeyword(body)) await db.delete(smsOptOuts).where(eq(smsOptOuts.phone, from));

  const [existing] = params.MessageSid
    ? await db.select({ id: smsMessages.id }).from(smsMessages).where(eq(smsMessages.twilioMessageSid, params.MessageSid)).limit(1)
    : [];
  if (existing) return { duplicate: true };

  await crmStorage.createSmsMessage({
    leadId,
    direction: "inbound",
    fromNumber: from,
    toNumber: toUsE164(params.To) ?? params.To ?? "",
    content: body || (mediaCount ? "[Picture message]" : ""),
    senderName: null,
    twilioMessageSid: params.MessageSid || null,
    status: "received",
    sentAt: new Date(),
  });

  const summary = leadId ? await leadSummary(leadId) : null;
  const { subject, html } = buildSmsReplyAlert({
    leadId,
    companyName: summary?.companyName ?? null,
    contactName: summary?.contactName ?? null,
    fromNumber: from,
    body,
    mediaCount,
    optedOut: !!keyword,
  });
  try {
    await sendEmail(process.env.SMS_REPLY_ALERT_EMAIL?.trim() || DEFAULT_ALERT_EMAIL, subject, html, { tags: ["sms-reply-alert"] });
  } catch (error) {
    console.error("[twilio] reply alert failed", from, error);
  }
  return { duplicate: false, leadId };
}

const FINAL_STATUSES = ["delivered", "undelivered", "failed"];

/** Twilio delivery updates for texts we sent. */
export async function handleSmsStatus(params: Record<string, string>) {
  const sid = params.MessageSid;
  const status = params.MessageStatus;
  if (!sid || !status) return;
  const errorCode = params.ErrorCode || null;
  // Callbacks can arrive out of order; never let "sent" overwrite a final status.
  const notFinal = (column: typeof smsMessages.status | typeof smsScanSends.status) =>
    FINAL_STATUSES.includes(status) ? undefined : notInArray(column, FINAL_STATUSES);
  const from = toUsE164(params.From);
  await db.update(smsMessages)
    .set({ status, ...(from ? { fromNumber: from } : {}) })
    .where(and(eq(smsMessages.twilioMessageSid, sid), notFinal(smsMessages.status)));
  const [send] = await db.update(smsScanSends)
    .set({ status, errorCode, updatedAt: new Date() })
    .where(and(eq(smsScanSends.twilioMessageSid, sid), notFinal(smsScanSends.status)))
    .returning();
  if (errorCode === "21610" && send) await recordOptOut(send.toNumber, null, "twilio_error");
}
