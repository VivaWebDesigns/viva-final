import type { ProfileHealth, TimelineEventType, TimelineEventSource, BillingSummary } from "./types";

// ── Mapped entity shapes ─────────────────────────────────────────────────────
// These are the explicit, stable DTO shapes the service layer exposes.
// Raw DB rows never leave the service — everything passes through mappers.ts.

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
  nextFollowUpDate: Date | null;
  preferredContactMethod: string | null;
  launchDate: Date | null;
  renewalDate: Date | null;
  websiteStatus: string | null;
  carePlanStatus: string | null;
  serviceTier: string | null;
  notes: string | null;
  billingNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
  expectedCloseDate: Date | null;
  nextActionDate: Date | null;
  followUpDate: Date | null;
  stageEnteredAt: Date | null;
  sourceLeadTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationMeta {
  triggerStageSlug: string;
  templateId: string;
  executedAt: Date;
}

export interface MappedTask {
  id: string;
  title: string;
  notes: string | null;
  taskType: string | null;
  dueDate: Date;
  completed: boolean;
  completedAt: Date | null;
  assignedTo: string | null;
  opportunityId: string | null;
  leadId: string | null;
  contactId: string | null;
  companyId: string | null;
  createdBy: string | null;
  createdAt: Date;
  automationMeta: AutomationMeta | null;
}

export interface MappedOnboarding {
  id: string;
  clientName: string;
  status: string;
  opportunityId: string | null;
  companyId: string | null;
  contactId: string | null;
  assignedTo: string | null;
  kickoffDate: Date | null;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
}

// ── Timeline event ───────────────────────────────────────────────────────────
// Unified read-side shape. Source attribution is preserved via `source`.
// Never contains raw DB FKs — `actor` is the resolved display name.

export interface UnifiedTimelineEvent {
  id: string;
  type: TimelineEventType;
  source: TimelineEventSource;
  timestamp: Date;
  actor: string | null;
  content: string;
  metadata?: Record<string, unknown> | null;
}

// ── Canonical profile DTO ────────────────────────────────────────────────────

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
    lastActivityAt: Date | null;
  };
}
