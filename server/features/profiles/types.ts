/**
 * profiles/types.ts
 *
 * Core TypeScript types for the Unified Profile domain.
 *
 * These types are the foundation for the canonical profile model and are
 * intentionally decoupled from raw Drizzle row types.  No raw DB rows
 * should ever surface outside this domain.
 *
 * Responsibility: type contracts only — zero runtime logic.
 */

// ─── Context ─────────────────────────────────────────────────────────────────

/**
 * Which entity is being used as the entry-point when building a profile.
 * The profile domain can resolve from any of these contexts.
 */
export type ProfileContextType = "company" | "lead" | "opportunity";

/** A typed reference to any entity that can seed a profile lookup. */
export interface ProfileContextRef {
  context: ProfileContextType;
  entityId: string;
}

// ─── Primitive shared refs ────────────────────────────────────────────────────

/** Lightweight actor reference (user who performed an action). */
export interface ProfileActorRef {
  id: string;
  name: string;
}

/** Lightweight stage reference. */
export interface ProfileStageRef {
  id: string;
  name: string;
  slug: string;
  color: string;
  sortOrder: number;
  isClosed: boolean;
}

/** Lightweight status reference (lead statuses). */
export interface ProfileStatusRef {
  id: string;
  name: string;
  slug: string;
  color: string;
  isClosed: boolean;
}

/** Lightweight tag reference. */
export interface ProfileTagRef {
  id: string;
  name: string;
  slug: string;
  color: string;
}

// ─── Identity section ─────────────────────────────────────────────────────────

/**
 * Canonical company record as seen through the profile lens.
 * Merges crm_companies fields that are relevant to profile identity.
 */
export interface ProfileCompanyIdentity {
  id: string;
  name: string;
  dba: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  industry: string | null;
  preferredLanguage: string | null;
  notes: string | null;
  clientStatus: string | null;
  accountOwnerId: string | null;
  preferredContactMethod: string | null;
  nextFollowUpDate: Date | null;
  launchDate: Date | null;
  renewalDate: Date | null;
  websiteStatus: string | null;
  carePlanStatus: string | null;
  serviceTier: string | null;
  billingNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Canonical contact record as seen through the profile lens.
 * Corresponds to a crm_contacts row.
 */
export interface ProfileContactIdentity {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  title: string | null;
  preferredLanguage: string | null;
  isPrimary: boolean;
  notes: string | null;
  createdAt: Date;
}

/** Identity section of the unified profile. */
export interface ProfileIdentitySection {
  /**
   * Best-effort display name:
   *   company.name > company.dba > lead.title > "Unknown"
   */
  displayName: string;
  company: ProfileCompanyIdentity | null;
  primaryContact: ProfileContactIdentity | null;
  /** All contacts linked to this company (may include primaryContact). */
  contacts: ProfileContactIdentity[];
  trade: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  timezone: string | null;
  preferredLanguage: string | null;
}

// ─── Sales section ────────────────────────────────────────────────────────────

/** A single opportunity as it appears in the sales view of a profile. */
export interface ProfileOpportunitySummary {
  id: string;
  title: string;
  value: string | null;
  status: string;
  stageId: string | null;
  stage: ProfileStageRef | null;
  websitePackage: string | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  nextActionDate: Date | null;
  followUpDate: Date | null;
  assignedTo: ProfileActorRef | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A single lead as it appears in the sales history of a profile. */
export interface ProfileLeadSummary {
  id: string;
  title: string;
  source: string | null;
  sourceLabel: string | null;
  status: ProfileStatusRef | null;
  value: string | null;
  assignedTo: ProfileActorRef | null;
  fromWebsiteForm: boolean;
  websiteUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Sales section of the unified profile. */
export interface ProfileSalesSection {
  /**
   * The lead that anchors this profile.
   * Every profile has exactly one source lead as canonical anchor.
   */
  sourceLead: {
    id: string;
    title: string;
    source: string | null;
    sourceLabel: string | null;
    status: ProfileStatusRef | null;
    value: string | null;
    fromWebsiteForm: boolean;
    websiteUrl: string | null;
    notes: string | null;
    assignedTo: ProfileActorRef | null;
    monthlyBudget: string | null;
    tags: ProfileTagRef[];
    utmAttribution: {
      utmSource: string | null;
      utmMedium: string | null;
      utmCampaign: string | null;
      utmTerm: string | null;
      utmContent: string | null;
      referrer: string | null;
      landingPage: string | null;
      formPageUrl: string | null;
    };
    createdAt: Date;
    updatedAt: Date;
  };
  /**
   * All other leads linked to the same company.
   * Empty when the company has only one lead.
   */
  leadHistory: ProfileLeadSummary[];
  /** The currently open (or most recent) opportunity. */
  activeOpportunity: ProfileOpportunitySummary | null;
  /** All opportunities associated with this profile's company. */
  opportunities: ProfileOpportunitySummary[];
}

// ─── Work section ─────────────────────────────────────────────────────────────

/** A follow-up task as it appears in the work section. */
export interface ProfileTask {
  id: string;
  title: string;
  notes: string | null;
  taskType: string | null;
  dueDate: Date;
  completed: boolean;
  completedAt: Date | null;
  outcome: string | null;
  completionNote: string | null;
  followUpTime: string | null;
  followUpTimezone: string | null;
  assignedTo: ProfileActorRef | null;
  /** The entity this task is most directly tied to. */
  sourceEntityType: "lead" | "opportunity" | "contact" | "company";
  sourceEntityId: string;
  createdAt: Date;
}

/** A demo config linked to a lead. */
export interface ProfileDemoRef {
  id: string;
  businessName: string;
  trade: string;
  tier: string;
  city: string | null;
  phone: string | null;
  previewUrl: string;
  settings: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

/** Work section of the unified profile. */
export interface ProfileWorkSection {
  /** Aggregated tasks from all linked entities (lead + opportunity + company + contact). */
  tasks: ProfileTask[];
  /** Convenience pointer: the earliest incomplete task by due date, or null. */
  nextAction: ProfileTask | null;
  /** All demo configs linked to this profile's source lead. */
  demos: ProfileDemoRef[];
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

/** Source table/system that produced this timeline event. */
export type TimelineEventSource =
  | "crm_note"
  | "pipeline_activity"
  | "onboarding_note"
  | "client_note"
  | "record_history"
  | "followup_task";

/**
 * A single normalized event in the unified timeline.
 * All events across lead notes, pipeline activities, onboarding notes,
 * client notes, and record history are coerced into this shape.
 */
export interface UnifiedTimelineEvent {
  id: string;
  /** ISO timestamp of the event. */
  at: Date;
  source: TimelineEventSource;
  /** The domain-specific type within the source (e.g. "stage_change", "call", "status_changed"). */
  type: string;
  content: string | null;
  /** The table/domain entity this event belongs to. */
  entityType: string;
  entityId: string;
  author: ProfileActorRef | null;
  /** Source-specific metadata (stage transitions, field diffs, etc.). */
  metadata?: Record<string, unknown>;
}

/** Timeline section of the unified profile (placeholder — populated in Phase 2). */
export interface ProfileTimelineSection {
  /** All events merged and sorted newest-first. Populated once timeline service is wired. */
  events: UnifiedTimelineEvent[];
}

// ─── Service / Onboarding / Billing / Files ───────────────────────────────────

/** Summary of a single onboarding record as seen in the service section. */
export interface ProfileOnboardingSummary {
  id: string;
  clientName: string;
  status: string;
  templateId: string | null;
  templateName: string | null;
  assignedTo: ProfileActorRef | null;
  kickoffDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  notes: string | null;
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Billing summary as seen in the service section. */
export interface ProfileBillingSummary {
  stripeCustomerId: string | null;
  billingNotes: string | null;
}

/** A file attachment linked to any entity in this profile. */
export interface ProfileFile {
  id: string;
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  entityType: string;
  entityId: string;
  uploaderUserId: string | null;
  uploaderName: string | null;
  createdAt: Date;
}

/** Service section of the unified profile. */
export interface ProfileServiceSection {
  onboarding: ProfileOnboardingSummary[];
  billingSummary: ProfileBillingSummary;
  files: ProfileFile[];
}

// ─── Derived summary ──────────────────────────────────────────────────────────

/**
 * The lifecycle stage of this profile entity, derived from the best available
 * data across all domains.
 *
 * Precedence: onboarding > won > opportunity > lead
 */
export type ProfileLifecycleStage =
  | "lead"
  | "opportunity"
  | "won"
  | "lost"
  | "onboarding"
  | "client";

/**
 * Derived summary fields — pre-computed from the full profile for quick
 * display without deep inspection of the DTO.
 */
export interface UnifiedProfileSummary {
  lifecycleStage: ProfileLifecycleStage;
  /** Overall health indicator derived from onboarding completion, task overdue status, etc. */
  health: "good" | "at_risk" | "unknown";
  owner: ProfileActorRef | null;
  status: string | null;
  stage: ProfileStageRef | null;
  /** Combined pipeline value (all open opportunities). */
  value: string | null;
  /** Package tier from the active opportunity. */
  packageTier: string | null;
  hasOpportunity: boolean;
  hasOnboarding: boolean;
  hasStripeCustomer: boolean;
  hasDemo: boolean;
  openTaskCount: number;
  overdueTaskCount: number;
  attachmentCount: number;
  lastActivityAt: Date | null;
}

// ─── Root DTO ─────────────────────────────────────────────────────────────────

/**
 * UnifiedProfileDto — the canonical read model for a single business entity.
 *
 * This DTO is the source of truth for how a real-world business is represented
 * across CRM, Pipeline, Onboarding, Billing, and Files.
 *
 * It is assembled by ProfileService and should never be mutated directly.
 * All writes continue to go through the individual domain routes.
 */
export interface UnifiedProfileDto {
  /** The canonical profile ID = crmLeads.id of the source/anchor lead. */
  profileId: string;

  identity: ProfileIdentitySection;
  sales: ProfileSalesSection;
  work: ProfileWorkSection;
  /**
   * Timeline is a placeholder in Phase 1.
   * It will be fully wired in Phase 2 (timeline service).
   */
  timeline: ProfileTimelineSection;
  service: ProfileServiceSection;

  /** Pre-computed derived fields for quick display. */
  derived: UnifiedProfileSummary;
}
