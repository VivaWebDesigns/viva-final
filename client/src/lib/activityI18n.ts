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
        parts.push(`${taskCompletedLabel}: ${meta.taskTitle}`);
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
