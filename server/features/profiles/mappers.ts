import type {
  CrmCompany,
  CrmContact,
  CrmLead,
  PipelineOpportunity,
  FollowupTask,
  OnboardingRecord,
  Attachment,
  CrmLeadNote,
  PipelineActivity,
} from "@shared/schema";
import type {
  MappedCompany,
  MappedContact,
  MappedLead,
  MappedOpportunity,
  MappedTask,
  MappedOnboarding,
  MappedFile,
  UnifiedTimelineEvent,
} from "./dto";
import type { ProfileHealth } from "./types";

// ── Health derivation ────────────────────────────────────────────────────────

const STALE_DAYS = 30;
const AT_RISK_DAYS = 14;

export function deriveHealth(lastActivityAt: Date | null): ProfileHealth {
  if (!lastActivityAt) return "unknown";
  const daysSince = (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > STALE_DAYS) return "stale";
  if (daysSince > AT_RISK_DAYS) return "at_risk";
  return "healthy";
}

// ── Entity mappers ───────────────────────────────────────────────────────────

export function mapCompany(row: CrmCompany): MappedCompany {
  return {
    id: row.id,
    name: row.name,
    dba: row.dba ?? null,
    website: row.website ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    zip: row.zip ?? null,
    country: row.country ?? null,
    industry: row.industry ?? null,
    preferredLanguage: row.preferredLanguage ?? null,
    clientStatus: row.clientStatus ?? null,
    accountOwnerId: row.accountOwnerId ?? null,
    nextFollowUpDate: row.nextFollowUpDate ?? null,
    preferredContactMethod: row.preferredContactMethod ?? null,
    launchDate: row.launchDate ?? null,
    renewalDate: row.renewalDate ?? null,
    websiteStatus: row.websiteStatus ?? null,
    carePlanStatus: row.carePlanStatus ?? null,
    serviceTier: row.serviceTier ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapContact(row: CrmContact): MappedContact {
  return {
    id: row.id,
    companyId: row.companyId ?? null,
    firstName: row.firstName,
    lastName: row.lastName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    altPhone: row.altPhone ?? null,
    title: row.title ?? null,
    preferredLanguage: row.preferredLanguage ?? null,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapLead(row: CrmLead): MappedLead {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId ?? null,
    contactId: row.contactId ?? null,
    statusId: row.statusId ?? null,
    value: row.value ?? null,
    source: row.source ?? null,
    sourceLabel: row.sourceLabel ?? null,
    assignedTo: row.assignedTo ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    timezone: row.timezone ?? null,
    fromWebsiteForm: row.fromWebsiteForm,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapOpportunity(row: PipelineOpportunity): MappedOpportunity {
  return {
    id: row.id,
    title: row.title,
    value: row.value ?? null,
    websitePackage: row.websitePackage ?? null,
    stageId: row.stageId ?? null,
    leadId: row.leadId ?? null,
    companyId: row.companyId ?? null,
    contactId: row.contactId ?? null,
    assignedTo: row.assignedTo ?? null,
    status: row.status,
    expectedCloseDate: row.expectedCloseDate ?? null,
    nextActionDate: row.nextActionDate ?? null,
    followUpDate: row.followUpDate ?? null,
    stageEnteredAt: row.stageEnteredAt ?? null,
    sourceLeadTitle: row.sourceLeadTitle ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapTask(row: FollowupTask): MappedTask {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? null,
    taskType: row.taskType ?? null,
    dueDate: row.dueDate,
    completed: row.completed,
    completedAt: row.completedAt ?? null,
    assignedTo: row.assignedTo ?? null,
    opportunityId: row.opportunityId ?? null,
    leadId: row.leadId ?? null,
    contactId: row.contactId ?? null,
    companyId: row.companyId ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
  };
}

export function mapOnboarding(row: OnboardingRecord): MappedOnboarding {
  return {
    id: row.id,
    clientName: row.clientName,
    status: row.status,
    opportunityId: row.opportunityId ?? null,
    companyId: row.companyId ?? null,
    contactId: row.contactId ?? null,
    assignedTo: row.assignedTo ?? null,
    kickoffDate: row.kickoffDate ?? null,
    dueDate: row.dueDate ?? null,
    completedAt: row.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapFile(row: Attachment): MappedFile {
  return {
    id: row.id,
    key: row.key,
    url: row.url,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploaderUserId: row.uploaderUserId ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    createdAt: row.createdAt,
  };
}

// ── Derived value helpers ────────────────────────────────────────────────────

export function resolveValue(opportunities: MappedOpportunity[]): number | null {
  const active = opportunities.filter((o) => o.status === "open");
  if (active.length === 0) return null;
  const total = active.reduce((sum, o) => sum + parseFloat(o.value ?? "0"), 0);
  return total > 0 ? total : null;
}

export function resolvePrimaryContact(contacts: MappedContact[]): MappedContact | null {
  if (contacts.length === 0) return null;
  return contacts.find((c) => c.isPrimary) ?? contacts[0];
}

export function resolveNextAction(tasks: MappedTask[]): MappedTask | null {
  const pending = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return pending[0] ?? null;
}

export function resolveLastActivityAt(
  leadNotes: CrmLeadNote[],
  pipelineActivities: PipelineActivity[],
): Date | null {
  const dates: Date[] = [
    ...leadNotes.map((n) => n.createdAt),
    ...pipelineActivities.map((a) => a.createdAt),
  ];
  if (dates.length === 0) return null;
  return dates.reduce((latest, d) => (d > latest ? d : latest));
}

// ── Timeline event mappers ───────────────────────────────────────────────────

export function mapLeadNoteToTimelineEvent(
  note: CrmLeadNote,
): UnifiedTimelineEvent {
  return {
    id: note.id,
    type: note.type as UnifiedTimelineEvent["type"],
    entityType: "lead",
    entityId: note.leadId,
    content: note.content,
    authorId: note.userId,
    createdAt: note.createdAt,
    metadata: (note.metadata as Record<string, unknown> | null) ?? null,
  };
}

export function mapPipelineActivityToTimelineEvent(
  activity: PipelineActivity,
): UnifiedTimelineEvent {
  return {
    id: activity.id,
    type: activity.type as UnifiedTimelineEvent["type"],
    entityType: "opportunity",
    entityId: activity.opportunityId,
    content: activity.content,
    authorId: activity.userId,
    createdAt: activity.createdAt,
    metadata: (activity.metadata as Record<string, unknown> | null) ?? null,
  };
}
