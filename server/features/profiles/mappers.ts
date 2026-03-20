import type {
  CrmLeadNote,
  PipelineActivity,
  CrmContact,
  PipelineOpportunity,
  FollowupTask,
} from "@shared/schema";
import type { UnifiedTimelineEvent } from "./dto";
import type { ProfileHealth } from "./types";

const STALE_DAYS = 30;
const AT_RISK_DAYS = 14;

export function deriveHealth(lastActivityAt: Date | null): ProfileHealth {
  if (!lastActivityAt) return "unknown";
  const daysSince = (Date.now() - lastActivityAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > STALE_DAYS) return "stale";
  if (daysSince > AT_RISK_DAYS) return "at_risk";
  return "healthy";
}

export function resolveValue(opportunities: PipelineOpportunity[]): number | null {
  const active = opportunities.filter((o) => o.status === "open");
  if (active.length === 0) return null;
  const total = active.reduce((sum, o) => sum + parseFloat(o.value ?? "0"), 0);
  return total > 0 ? total : null;
}

export function resolvePrimaryContact(contacts: CrmContact[]): CrmContact | null {
  if (contacts.length === 0) return null;
  return contacts.find((c) => c.isPrimary) ?? contacts[0];
}

export function resolveNextAction(tasks: FollowupTask[]): FollowupTask | null {
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
