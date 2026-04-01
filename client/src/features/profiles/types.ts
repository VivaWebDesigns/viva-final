// ── Linkage error payload ─────────────────────────────────────────────────────
// Returned when an opportunity exists but cannot be resolved to a company.

export interface OrphanedOpportunityPayload {
  id: string;
  title: string;
  value: string | null;
  status: string;
  stageId: string | null;
  assignedTo: string | null;
  companyId: string | null;
  leadId: string | null;
}

/**
 * Thrown by useUnifiedProfile when the server returns a structured 422
 * PROFILE_LINKAGE_ERROR for an opportunity entry.
 *
 * Carries the opportunity's own data so the fallback UI can display it
 * without an additional network round-trip.
 */
export class ProfileLinkageApiError extends Error {
  readonly code = "PROFILE_LINKAGE_ERROR" as const;
  readonly opportunityId: string;
  readonly opportunity: OrphanedOpportunityPayload | null;

  constructor(
    message: string,
    opportunityId: string,
    opportunity: OrphanedOpportunityPayload | null,
  ) {
    super(message);
    this.name = "ProfileLinkageApiError";
    this.opportunityId = opportunityId;
    this.opportunity = opportunity;
  }
}

// ── Profile entry point ───────────────────────────────────────────────────────
// Discriminated union that identifies which entity to use as the profile anchor.

export type ProfileEntryType = "company" | "lead" | "opportunity";

export interface ProfileEntry {
  type: ProfileEntryType;
  id: string;
}

// ── Derived values ─────────────────────────────────────────────────────────────

export type ProfileHealth = "healthy" | "at_risk" | "stale" | "unknown";

export type TimelineEventType =
  | "note"
  | "call"
  | "email"
  | "task"
  | "status_change"
  | "stage_change"
  | "system"
  | "sms";

export type TimelineEventSource =
  | "crm_lead_notes"
  | "client_notes"
  | "pipeline_activities";

// ── Mapped entity shapes ───────────────────────────────────────────────────────
// These mirror the server-side MappedEntity types in server/features/profiles/dto.ts.
// Dates arrive as ISO strings over JSON; the hooks expose them as `string` so
// consumers can format them without additional coercion.

export interface MappedCompany {
  id: string;
  name: string;
  dba: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  industry: string | null;
  preferredLanguage: string | null;
  clientStatus: string | null;
  accountOwnerId: string | null;
  nextFollowUpDate: string | null;
  preferredContactMethod: string | null;
  launchDate: string | null;
  renewalDate: string | null;
  websiteStatus: string | null;
  carePlanStatus: string | null;
  serviceTier: string | null;
  notes: string | null;
  billingNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MappedContact {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  title: string | null;
  preferredLanguage: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MappedLead {
  id: string;
  title: string;
  companyId: string | null;
  contactId: string | null;
  statusId: string | null;
  value: string | null;
  source: string | null;
  sourceLabel: string | null;
  assignedTo: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  fromWebsiteForm: boolean;
  sellerProfileUrl: string | null;
  adUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MappedOpportunity {
  id: string;
  title: string;
  value: string | null;
  websitePackage: string | null;
  stageId: string | null;
  leadId: string | null;
  companyId: string | null;
  contactId: string | null;
  assignedTo: string | null;
  status: string;
  expectedCloseDate: string | null;
  nextActionDate: string | null;
  followUpDate: string | null;
  stageEnteredAt: string | null;
  sourceLeadTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationMeta {
  triggerStageSlug: string;
  templateId: string;
  executedAt: string;
}

export interface MappedTask {
  id: string;
  title: string;
  notes: string | null;
  taskType: string | null;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  assignedTo: string | null;
  opportunityId: string | null;
  leadId: string | null;
  contactId: string | null;
  companyId: string | null;
  createdBy: string | null;
  createdAt: string;
  automationMeta?: AutomationMeta | null;
}

export interface MappedOnboarding {
  id: string;
  clientName: string;
  status: string;
  opportunityId: string | null;
  companyId: string | null;
  contactId: string | null;
  assignedTo: string | null;
  kickoffDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MappedFile {
  id: string;
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploaderUserId: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface BillingSummary {
  stripeCustomerId: string | null;
  hasStripe: boolean;
}

// ── Timeline event ─────────────────────────────────────────────────────────────
// Source attribution is preserved via `source` (which DB table the row came from).
// Dates arrive as ISO strings over JSON.

export interface UnifiedTimelineEvent {
  id: string;
  type: TimelineEventType;
  source: TimelineEventSource;
  timestamp: string;
  actor: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
}

// ── Canonical profile DTO ──────────────────────────────────────────────────────

export interface UnifiedProfileDto {
  identity: {
    company: MappedCompany;
    primaryContact: MappedContact | null;
    contacts: MappedContact[];
  };

  sales: {
    sourceLead: MappedLead | null;
    leadHistory: MappedLead[];
    activeOpportunity: MappedOpportunity | null;
    opportunities: MappedOpportunity[];
  };

  work: {
    tasks: MappedTask[];
    nextAction: MappedTask | null;
  };

  timeline: {
    events: UnifiedTimelineEvent[];
  };

  service: {
    onboarding: MappedOnboarding[];
    billingSummary: BillingSummary | null;
    files: MappedFile[];
  };

  derived: {
    owner: string | null;
    status: string | null;
    health: ProfileHealth;
    stage: string | null;
    value: number | null;
    lastActivityAt: string | null;
  };
}
