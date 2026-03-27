import type { AdminTranslations } from "@/i18n/locales/en";

export const STAGE_NAME_TO_SLUG: Record<string, string> = {
  "New Lead":       "new-lead",
  "Contacted":      "contacted",
  "Demo Scheduled": "demo-scheduled",
  "Demo Completed": "demo-completed",
  "Payment Sent":   "payment-sent",
  "Closed \u2013 Won":  "closed-won",
  "Closed - Won":       "closed-won",
  "Closed \u2013 Lost": "closed-lost",
  "Closed - Lost":      "closed-lost",
  "Discovery":      "discovery",
  "Proposal":       "proposal",
  "None":           "",
};

export const KNOWN_SLUGS = new Set([
  "new-lead", "contacted", "demo-scheduled", "demo-completed",
  "payment-sent", "closed-won", "closed-lost", "discovery", "proposal",
]);

export function normalizeStageSlug(nameOrSlug: string | undefined | null): string {
  if (!nameOrSlug) return "";
  if (KNOWN_SLUGS.has(nameOrSlug)) return nameOrSlug;
  return STAGE_NAME_TO_SLUG[nameOrSlug] ?? nameOrSlug;
}

export function getStageLabel(slugOrName: string | undefined | null, t: AdminTranslations): string {
  if (!slugOrName) return "";
  const slug = normalizeStageSlug(slugOrName);
  return (t.pipeline.stageNames as Record<string, string>)[slug] ?? slugOrName;
}

export const OUTCOME_VALUE_TO_KEY: Record<string, string> = {
  "No answer":      "noAnswer",
  "Left voicemail": "leftVoicemail",
  "Spoke with lead":"spokeWithLead",
  "Interested":     "interested",
  "Uncertain":      "uncertain",
  "Not interested": "notInterested",
  "Bad number":     "badNumber",
  "Appointment set":"appointmentSet",
  "Duplicate lead": "duplicateLead",
};

export function normalizeOutcomeKey(outcomeValue: string | undefined | null): string | undefined {
  if (!outcomeValue) return undefined;
  return OUTCOME_VALUE_TO_KEY[outcomeValue];
}

export function getOutcomeLabel(outcomeValue: string | undefined | null, t: AdminTranslations): string {
  if (!outcomeValue) return "";
  const key = normalizeOutcomeKey(outcomeValue);
  if (key) return (t.tasks.outcomes as Record<string, string>)[key] ?? outcomeValue;
  return outcomeValue;
}

export function getActivityTypeLabel(type: string, t: AdminTranslations): string {
  const activity = t.pipeline.activity as Record<string, string>;
  const keyMap: Record<string, string> = {
    stage_change: "stageChange",
    note:         "note",
    call:         "call",
    email:        "email",
    task:         "task",
    system:       "system",
  };
  const key = keyMap[type];
  if (key && activity[key]) return activity[key];
  return type.replace(/_/g, " ");
}

const FOLLOW_UP_WITH_PREFIX = "Follow up with ";
const FOLLOW_UP_ON_PAYMENT = "Follow up on payment";
const CONTACT_LEAD = "Contact lead";
const SCHEDULE_DEMO = "Schedule demo";

const RECORD_DEMO_OUTCOME = "Record demo outcome";

const TASK_TITLE_MAP: Array<[string, (t: AdminTranslations) => string]> = [
  [FOLLOW_UP_ON_PAYMENT, (t) => t.tasks.followUpOnPayment ?? FOLLOW_UP_ON_PAYMENT],
  [CONTACT_LEAD,         (t) => t.tasks.contactLead ?? CONTACT_LEAD],
  [SCHEDULE_DEMO,        (t) => t.tasks.scheduleDemo ?? SCHEDULE_DEMO],
  [RECORD_DEMO_OUTCOME,  (t) => t.tasks.recordDemoOutcome ?? RECORD_DEMO_OUTCOME],
];

export function renderTaskTitle(task: { title: string }, t: AdminTranslations): string {
  for (const [canonical, fn] of TASK_TITLE_MAP) {
    if (task.title === canonical) return fn(t);
  }
  if (task.title.startsWith(FOLLOW_UP_WITH_PREFIX)) {
    const name = task.title.slice(FOLLOW_UP_WITH_PREFIX.length);
    return `${t.pipeline.followUpWith ?? FOLLOW_UP_WITH_PREFIX.trim()} ${name}`;
  }
  return task.title;
}

const TASK_NOTES_MAP: Array<[string, (t: AdminTranslations) => string]> = [
  [
    "Reach out to the lead for the first time to introduce Viva Web Designs and qualify their interest.",
    (t) => t.tasks.contactLeadNotes,
  ],
  [
    "Follow up with contacted lead to schedule a demo of Viva Web Designs services.",
    (t) => t.tasks.scheduleDemoNotes,
  ],
];

/**
 * Translates a task's notes/description at render time.
 * Matches against known automation template descriptions; falls back to the
 * raw stored value (which may be user-edited HTML) if no match is found.
 * To add a new seeded template description, append one entry to TASK_NOTES_MAP.
 */
export function renderTaskNotes(notes: string | null | undefined, t: AdminTranslations): string {
  if (!notes) return "";
  const trimmed = notes.trim();
  for (const [canonical, fn] of TASK_NOTES_MAP) {
    if (trimmed === canonical) return fn(t);
  }
  return notes;
}

/**
 * Translates a company's industry/trade value at render time.
 * Matches against the canonical BUSINESS_TRADES slugs. Falls back to the
 * raw stored value if no match is found.
 * To support a new trade, add one key to both locale files' `trades` section.
 */
export function renderTradeName(industry: string | null | undefined, t: AdminTranslations): string {
  if (!industry) return "";
  const key = industry.trim().toLowerCase().replace(/\s+/g, "_");
  const map = t.trades as Record<string, string>;
  return map[key] ?? industry;
}

export function getPaymentMethodLabel(method: string | undefined | null, t: AdminTranslations): string {
  if (!method) return "";
  const ps = t.pipeline.paymentSent as Record<string, string>;
  const map: Record<string, string> = {
    Text:  ps.methodText  ?? "Text",
    Email: ps.methodEmail ?? "Email",
    Both:  ps.methodBoth  ?? "Both",
  };
  return map[method] ?? method;
}

interface ActivityMetadata {
  event?: string;
  fromStageSlug?: string;
  toStageSlug?: string;
  fromStageName?: string;
  toStageName?: string;
  taskTitle?: string;
  outcome?: string;
  outcomeKey?: string;
  completionNote?: string;
  method?: string;
  timeFmt?: string;
  userNote?: string;
}

interface ActivityRecord {
  type: string;
  content: string;
  metadata?: ActivityMetadata | null | unknown;
}

export function renderActivityContent(act: ActivityRecord, t: AdminTranslations): string {
  const meta = act.metadata as ActivityMetadata | null | undefined;
  if (!meta?.event) return act.content;

  const activity = t.pipeline.activity as Record<string, string>;

  switch (meta.event) {
    case "stage_change": {
      const from = getStageLabel(meta.fromStageSlug ?? meta.fromStageName, t);
      const to   = getStageLabel(meta.toStageSlug   ?? meta.toStageName,   t);
      if (from && to) return `${from} → ${to}`;
      return act.content;
    }
    case "follow_up_scheduled":
      return `${activity.followUpScheduled ?? "Follow-up scheduled"}: ${meta.taskTitle ?? ""}`;
    case "follow_up_rescheduled":
      return `${activity.followUpRescheduled ?? "Follow-up rescheduled"}: ${meta.taskTitle ?? ""}`;
    case "payment_sent": {
      const ps = t.pipeline.paymentSent as Record<string, string>;
      const methodLabel = getPaymentMethodLabel(meta.method, t);
      const sentence = `${ps.activitySentVia ?? "Payment link sent via"} ${methodLabel} ${ps.activityAt ?? "at"} ${meta.timeFmt ?? ""}`.trimEnd();
      if (meta.userNote) return `${sentence}. ${meta.userNote}`;
      return `${sentence}.`;
    }
    case "task_completed": {
      const parts: string[] = [];
      const taskCompletedLabel = activity.taskCompleted ?? "Task completed";
      if (meta.taskTitle) {
        const translatedTitle = renderTaskTitle({ title: meta.taskTitle }, t);
        parts.push(`${taskCompletedLabel}: ${translatedTitle}`);
      } else {
        parts.push(taskCompletedLabel);
      }
      if (meta.outcomeKey ?? meta.outcome) {
        const outcomeDisplay = meta.outcomeKey
          ? ((t.tasks.outcomes as Record<string, string>)[meta.outcomeKey] ?? meta.outcome ?? "")
          : getOutcomeLabel(meta.outcome, t);
        if (outcomeDisplay) {
          const outcomeLabel = activity.outcome ?? t.common?.note ?? "Outcome";
          parts.push(`${outcomeLabel}: ${outcomeDisplay}`);
        }
      }
      if (meta.completionNote) {
        const noteLabel = t.common?.note ?? "Note";
        parts.push(`${noteLabel}: ${meta.completionNote}`);
      }
      return parts.length > 0 ? parts.join(" · ") : act.content;
    }
    default:
      return act.content;
  }
}
