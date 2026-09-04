export const REPORT_INITIAL_TASK_TITLE = "Send first visibility report email";
export const REPORT_INITIAL_TASK_NOTES = "Open the lead's visibility snapshot, review the recipient and message, then click Email report.";
export const REPORT_PERSONAL_FOLLOWUP_TITLE = "Personal follow-up — visibility report viewed";
export const REPORT_PERSONAL_FOLLOWUP_NOTES = "This prospect viewed or clicked the visibility report. Check your inbox, then use a personal call, text, or email instead of sending another automated report.";

export const REPORT_OUTREACH_TASKS = ["report_email_followup", "report_email_review", "report_personal_followup"] as const;

export function isReportOutreachTask(taskType?: string | null): boolean {
  return REPORT_OUTREACH_TASKS.includes(taskType as typeof REPORT_OUTREACH_TASKS[number]);
}

export const REPORT_OUTREACH_OUTCOMES = {
  interested: "Interested",
  uncertain: "Uncertain",
  appointmentSet: "Appointment set",
  notInterested: "Not interested",
  noResponse: "No response",
  optedOut: "Opted out",
  emailBounced: "Email bounced",
};

export const REPORT_DISPOSITION_LABELS: Record<string, string> = {
  active: "Awaiting response",
  replied: "Replied",
  no_response: "No Response — paused",
  opted_out: "Opted out — stopped",
  bounced: "Email bounced — stopped",
  not_interested: "Not interested — stopped",
};

export const REPORT_OUTREACH_FILTERS = [
  "report_any", "needs_attention", "one_sent", "two_sent", "engaged",
  "awaiting_response", "no_engagement", "stopped",
] as const;
export type ReportOutreachFilter = typeof REPORT_OUTREACH_FILTERS[number];

export const REPORT_OUTREACH_SEGMENTS = [
  "not_started", "send_email_two", "engaged", "awaiting_response",
  "no_engagement", "stopped", "responded",
] as const;
export type ReportOutreachSegment = typeof REPORT_OUTREACH_SEGMENTS[number];

export const REPORT_OUTREACH_SEGMENT_LABELS: Record<ReportOutreachSegment, string> = {
  not_started: "Report not sent",
  send_email_two: "Follow-up email due",
  engaged: "Engaged — personal touch",
  awaiting_response: "Awaiting response",
  no_engagement: "No engagement",
  stopped: "Outreach stopped",
  responded: "Responded",
};

export interface ReportOutreachSummary {
  reportEmailCount: number;
  lastReportEmailedAt: Date | string | null;
  reportOutreachDisposition: string | null;
  reportViewCount: number;
  reportCtaClickCount: number;
  reportLastEngagedAt: Date | string | null;
  reportNextTaskDueAt?: Date | string | null;
}

export function classifyReportOutreach(summary: ReportOutreachSummary, now = new Date()): {
  segment: ReportOutreachSegment;
  needsAttention: boolean;
} {
  const disposition = summary.reportOutreachDisposition;
  if (disposition === "replied") return { segment: "responded", needsAttention: false };
  if (["opted_out", "bounced", "not_interested"].includes(disposition ?? "")) return { segment: "stopped", needsAttention: false };
  if (disposition === "no_response") return { segment: "no_engagement", needsAttention: false };
  if (summary.reportEmailCount === 0) return { segment: "not_started", needsAttention: false };
  const engaged = summary.reportViewCount > 0 || summary.reportCtaClickCount > 0;
  if (engaged) return { segment: "engaged", needsAttention: true };
  const due = summary.reportNextTaskDueAt
    ? new Date(summary.reportNextTaskDueAt)
    : summary.lastReportEmailedAt
      ? reportBusinessDate(new Date(summary.lastReportEmailedAt), summary.reportEmailCount === 1 ? 7 : 5)
      : null;
  const overdue = !!due && reportBusinessDate(now, 0).getTime() >= due.getTime();
  if (summary.reportEmailCount === 1) return { segment: "send_email_two", needsAttention: overdue };
  return { segment: overdue ? "no_engagement" : "awaiting_response", needsAttention: false };
}

/** Date-only task deadlines in the business's Eastern timezone; skips weekends. */
export function reportBusinessDate(now: Date, days: number): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const date = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  while (days > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days--;
  }
  return date;
}

export function reportSendBlockedReason(count: number, disposition: string | null): string | null {
  if (disposition && disposition !== "active") return `Report outreach stopped: ${REPORT_DISPOSITION_LABELS[disposition] ?? disposition}.`;
  if (count >= 2) return "Both report emails have been sent. Check for a response before closing the outreach.";
  return null;
}
