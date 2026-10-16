import { sendEmail } from "../notifications/mailgun";

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://vivawebdesigns.com").replace(/\/$/, "");
// Matt answers cold-email replies himself; override with INSTANTLY_REPLY_ALERT_EMAIL.
const DEFAULT_ALERT_EMAIL = "matt@vivawebdesigns.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReplyAlertInput {
  leadId: string;
  businessName: string;
  leadEmail: string | null;
  replyText: string | null;
  uniboxUrl: string | null;
}

/** Subject and HTML for the "someone replied" email. */
export function buildReplyAlert(input: ReplyAlertInput) {
  const reply = (input.replyText ?? "").trim();
  const crmUrl = `${PUBLIC_SITE_URL}/admin/crm/leads/${encodeURIComponent(input.leadId)}`;
  const links = [
    input.uniboxUrl ? `<a href="${escapeHtml(input.uniboxUrl)}">Reply in Instantly</a>` : null,
    `<a href="${escapeHtml(crmUrl)}">Open lead in CRM</a>`,
  ].filter(Boolean).join(" &middot; ");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p><strong>${escapeHtml(input.businessName)}</strong> replied to your cold email${input.leadEmail ? ` (${escapeHtml(input.leadEmail)})` : ""}.</p>
<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ccc;color:#333;white-space:pre-wrap">${reply ? escapeHtml(reply) : "<em>No reply text was included.</em>"}</blockquote>
<p>${links}</p>
</div>`;
  return { subject: `New reply: ${input.businessName}`, html };
}

/** Emails Matt about a new reply. Never throws: the reply is already logged in the CRM. */
export async function sendReplyAlert(input: ReplyAlertInput) {
  const { subject, html } = buildReplyAlert(input);
  const to = process.env.INSTANTLY_REPLY_ALERT_EMAIL?.trim() || DEFAULT_ALERT_EMAIL;
  try {
    await sendEmail(to, subject, html, { tags: ["instantly-reply-alert"] });
  } catch (error) {
    console.error("[instantly] reply alert failed", input.leadId, error);
  }
}
