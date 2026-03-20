import { db } from "../../db";
import {
  crmCompanies,
  crmContacts,
  crmLeads,
  crmLeadNotes,
  pipelineOpportunities,
  pipelineActivities,
  followupTasks,
  onboardingRecords,
  attachments,
  stripeCustomers,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  resolveByCompanyId,
  resolveByLeadId,
  resolveByOpportunityId,
} from "./relationships";
import {
  deriveHealth,
  resolveValue,
  resolvePrimaryContact,
  resolveNextAction,
  resolveLastActivityAt,
  mapLeadNoteToTimelineEvent,
  mapPipelineActivityToTimelineEvent,
} from "./mappers";
import type { UnifiedProfileDto } from "./dto";
import type { BillingSummary } from "./types";

async function assembleProfile(companyId: string): Promise<UnifiedProfileDto> {
  const [company] = await db
    .select()
    .from(crmCompanies)
    .where(eq(crmCompanies.id, companyId));

  if (!company) throw new Error(`Company not found: ${companyId}`);

  const [contacts, leads, opportunities, onboarding, tasks, stripeRows, files] =
    await Promise.all([
      db.select().from(crmContacts).where(eq(crmContacts.companyId, companyId)),
      db.select().from(crmLeads).where(eq(crmLeads.companyId, companyId)),
      db
        .select()
        .from(pipelineOpportunities)
        .where(eq(pipelineOpportunities.companyId, companyId)),
      db
        .select()
        .from(onboardingRecords)
        .where(eq(onboardingRecords.companyId, companyId)),
      db
        .select()
        .from(followupTasks)
        .where(eq(followupTasks.companyId, companyId)),
      db
        .select()
        .from(stripeCustomers)
        .where(eq(stripeCustomers.entityId, companyId)),
      db
        .select()
        .from(attachments)
        .where(eq(attachments.entityId, companyId)),
    ]);

  const leadIds = leads.map((l) => l.id);
  const oppIds = opportunities.map((o) => o.id);

  const [leadNotes, pipelineActs] = await Promise.all([
    leadIds.length > 0
      ? db.select().from(crmLeadNotes).where(inArray(crmLeadNotes.leadId, leadIds))
      : Promise.resolve([]),
    oppIds.length > 0
      ? db
          .select()
          .from(pipelineActivities)
          .where(inArray(pipelineActivities.opportunityId, oppIds))
      : Promise.resolve([]),
  ]);

  const activeOpportunity = opportunities.find((o) => o.status === "open") ?? null;
  const sourceLead = leads[0] ?? null;

  const primaryContact = resolvePrimaryContact(contacts);
  const nextAction = resolveNextAction(tasks);
  const lastActivityAt = resolveLastActivityAt(leadNotes, pipelineActs);

  const timelineEvents = [
    ...leadNotes.map(mapLeadNoteToTimelineEvent),
    ...pipelineActs.map(mapPipelineActivityToTimelineEvent),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const stripeRow = stripeRows[0] ?? null;
  const billingSummary: BillingSummary | null = stripeRow
    ? { stripeCustomerId: stripeRow.stripeCustomerId, hasStripe: true }
    : { stripeCustomerId: null, hasStripe: false };

  const owner =
    activeOpportunity?.assignedTo ??
    sourceLead?.assignedTo ??
    company.accountOwnerId ??
    null;

  return {
    identity: {
      company,
      primaryContact,
      contacts,
    },
    sales: {
      sourceLead,
      leadHistory: leads,
      activeOpportunity,
      opportunities,
    },
    work: {
      tasks,
      nextAction,
    },
    timeline: {
      events: timelineEvents,
    },
    service: {
      onboarding,
      billingSummary,
      files,
    },
    derived: {
      owner,
      status: activeOpportunity?.status ?? null,
      health: deriveHealth(lastActivityAt),
      stage: activeOpportunity?.stageId ?? null,
      value: resolveValue(opportunities),
      lastActivityAt,
    },
  };
}

export async function getProfileByCompanyId(
  companyId: string,
): Promise<UnifiedProfileDto> {
  await resolveByCompanyId(companyId);
  return assembleProfile(companyId);
}

export async function getProfileByLeadId(
  leadId: string,
): Promise<UnifiedProfileDto> {
  const identity = await resolveByLeadId(leadId);
  if (!identity.companyId) {
    throw new Error(`Lead ${leadId} has no linked company — cannot build profile`);
  }
  return assembleProfile(identity.companyId);
}

export async function getProfileByOpportunityId(
  opportunityId: string,
): Promise<UnifiedProfileDto> {
  const identity = await resolveByOpportunityId(opportunityId);
  if (!identity.companyId) {
    throw new Error(
      `Opportunity ${opportunityId} has no linked company — cannot build profile`,
    );
  }
  return assembleProfile(identity.companyId);
}
