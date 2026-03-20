import type {
  CrmCompany,
  CrmContact,
  CrmLead,
  PipelineOpportunity,
  FollowupTask,
  OnboardingRecord,
  Attachment,
} from "@shared/schema";
import type { ProfileHealth, TimelineEventType, BillingSummary } from "./types";

export interface UnifiedTimelineEvent {
  id: string;
  type: TimelineEventType;
  entityType: "lead" | "opportunity" | "company";
  entityId: string;
  content: string;
  authorId: string | null;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface UnifiedProfileDto {
  identity: {
    company: CrmCompany;
    primaryContact: CrmContact | null;
    contacts: CrmContact[];
  };

  sales: {
    sourceLead: CrmLead | null;
    leadHistory: CrmLead[];
    activeOpportunity: PipelineOpportunity | null;
    opportunities: PipelineOpportunity[];
  };

  work: {
    tasks: FollowupTask[];
    nextAction: FollowupTask | null;
  };

  timeline: {
    events: UnifiedTimelineEvent[];
  };

  service: {
    onboarding: OnboardingRecord[];
    billingSummary: BillingSummary | null;
    files: Attachment[];
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
