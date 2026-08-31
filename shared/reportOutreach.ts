export const REPORT_OUTREACH_TASKS = ["report_email_followup", "report_email_review"] as const;

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
