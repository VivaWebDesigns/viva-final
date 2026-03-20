export type ProfileContextType = "company" | "lead" | "opportunity";

export type ProfileHealth = "healthy" | "at_risk" | "stale" | "unknown";

export type TimelineEventType =
  | "note"
  | "call"
  | "email"
  | "task"
  | "status_change"
  | "stage_change"
  | "system";

export type TimelineEventSource =
  | "crm_lead_notes"
  | "client_notes"
  | "pipeline_activities";

export interface ResolvedIdentity {
  companyId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  resolvedVia: ProfileContextType;
}

export interface BillingSummary {
  stripeCustomerId: string | null;
  hasStripe: boolean;
}
