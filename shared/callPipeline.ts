/** Cold-calling pipeline: call tasks drive the stage strip; email outreach no longer moves stages. */

export const CALL_TASK_TYPE = "call";
export const CALL_TASK_TITLE = "Call lead";
export const CALL_BACK_TASK_TITLE = "Call back";
export const DISCOVERY_CALL_TASK_TITLE = "Discovery call";

/** The cold-calling stage strip. Slugs stay stable so history and existing code keep working. */
export const CALL_PIPELINE_STAGES = [
  { slug: "new-lead",       name: "New Lead",       color: "#3B82F6", sortOrder: 0, isDefault: true,  isClosed: false },
  { slug: "report-emailed", name: "Report Emailed", color: "#0891B2", sortOrder: 1, isDefault: false, isClosed: false },
  { slug: "attempted",      name: "Attempted",      color: "#0EA5E9", sortOrder: 2, isDefault: false, isClosed: false },
  { slug: "contacted",      name: "Contacted",      color: "#6366F1", sortOrder: 3, isDefault: false, isClosed: false },
  { slug: "demo-scheduled", name: "Call Scheduled", color: "#8B5CF6", sortOrder: 4, isDefault: false, isClosed: false },
  { slug: "demo-completed", name: "Call Completed", color: "#F59E0B", sortOrder: 5, isDefault: false, isClosed: false },
  { slug: "payment-sent",   name: "Quote Sent",     color: "#F97316", sortOrder: 6, isDefault: false, isClosed: false },
  { slug: "payment-made",   name: "Payment Made",   color: "#14B8A6", sortOrder: 7, isDefault: false, isClosed: false },
  { slug: "closed-won",     name: "Closed \u2013 Won",  color: "#10B981", sortOrder: 8, isDefault: false, isClosed: true },
  { slug: "closed-lost",    name: "Closed \u2013 Lost", color: "#EF4444", sortOrder: 9, isDefault: false, isClosed: true },
];

/** Replaced by the "Emails sent" count; kept in the database for history but never shown. */
export const HIDDEN_STAGE_SLUGS = ["report-emailed"] as const;

/** Stages an Appointment Setter can work in. Everything from Call Scheduled on belongs to an admin. */
export const SETTER_WORKING_STAGES = ["new-lead", "report-emailed", "attempted", "contacted"] as const;

/** Stages a setter may pick by hand. Call Scheduled is reached only through a call task, so the discovery call task is always created. */
export const SETTER_MANUAL_STAGES = ["new-lead", "attempted", "contacted", "closed-lost"] as const;

/** Final outcomes a call task can record; the step-by-step prompt resolves to one of these. */
export const CALL_OUTCOMES = {
  leftVoicemail: "Left voicemail",
  noVoicemail: "No answer",
  wrongNumber: "Wrong number",
  appointmentSet: "Appointment set",
  callBack: "Call back",
  notInterested: "Not interested",
} as const;

export const CALL_OUTCOME_STAGE: Record<string, string> = {
  [CALL_OUTCOMES.leftVoicemail]: "attempted",
  [CALL_OUTCOMES.noVoicemail]: "attempted",
  [CALL_OUTCOMES.wrongNumber]: "closed-lost",
  [CALL_OUTCOMES.appointmentSet]: "demo-scheduled",
  [CALL_OUTCOMES.callBack]: "contacted",
  [CALL_OUTCOMES.notInterested]: "closed-lost",
};

export function isCallTask(taskType: string | null | undefined): boolean {
  return taskType === CALL_TASK_TYPE;
}

export function isSetterWorkingStage(slug: string | null | undefined): boolean {
  return (SETTER_WORKING_STAGES as readonly string[]).includes(slug ?? "new-lead");
}

/** Whether a setter may move a lead by hand from one stage to another. */
export function canSetterMoveStage(fromSlug: string | null | undefined, toSlug: string): boolean {
  return isSetterWorkingStage(fromSlug) && (SETTER_MANUAL_STAGES as readonly string[]).includes(toSlug);
}
