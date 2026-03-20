import { db } from "../../db";
import {
  crmCompanies,
  crmContacts,
  crmLeads,
  crmLeadNotes,
  clientNotes,
  pipelineOpportunities,
  pipelineActivities,
  followupTasks,
  onboardingRecords,
  attachments,
  stripeCustomers,
  user,
} from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import {
  resolveByCompanyId,
  resolveByLeadId,
  resolveByOpportunityId,
} from "./relationships";
import {
  mapCompany,
  mapContact,
  mapLead,
  mapOpportunity,
  mapTask,
  mapOnboarding,
  mapFile,
  deriveHealth,
  resolveValue,
  resolvePrimaryContact,
  resolveNextAction,
  resolveLastActivityAt,
  mapLeadNoteToTimelineEvent,
  mapClientNoteToTimelineEvent,
  mapPipelineActivityToTimelineEvent,
} from "./mappers";
import type { UnifiedProfileDto } from "./dto";
import type { BillingSummary } from "./types";

async function assembleProfile(companyId: string): Promise<UnifiedProfileDto> {
  const [companyRow] = await db
    .select()
    .from(crmCompanies)
    .where(eq(crmCompanies.id, companyId));

  if (!companyRow) throw new Error(`Company not found: ${companyId}`);

  const [
    contactRows,
    leadRows,
    opportunityRows,
    onboardingRows,
    taskRows,
    stripeRows,
    fileRows,
    clientNoteRows,
  ] = await Promise.all([
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
    db
      .select()
      .from(clientNotes)
      .where(eq(clientNotes.companyId, companyId)),
  ]);

  const leadIds = leadRows.map((l) => l.id);
  const oppIds = opportunityRows.map((o) => o.id);

  const [leadNoteRows, pipelineActivityRows] = await Promise.all([
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

  // ── Batch-resolve actor names (one query for all three sources) ────────────
  const allUserIds = [
    ...new Set(
      [
        ...leadNoteRows.map((n) => n.userId),
        ...clientNoteRows.map((n) => n.userId),
        ...pipelineActivityRows.map((a) => a.userId),
      ].filter((id): id is string => id !== null && id !== undefined),
    ),
  ];
  const actorMap = new Map<string, string>();
  if (allUserIds.length > 0) {
    const userRows = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, allUserIds));
    for (const u of userRows) actorMap.set(u.id, u.name);
  }

  // ── Map all DB rows through mappers ───────────────────────────────────────
  const company = mapCompany(companyRow);
  const contacts = contactRows.map(mapContact);
  const leads = leadRows.map(mapLead);
  const opportunities = opportunityRows.map(mapOpportunity);
  const tasks = taskRows.map(mapTask);
  const onboarding = onboardingRows.map(mapOnboarding);
  const files = fileRows.map(mapFile);

  // ── Derive values ─────────────────────────────────────────────────────────
  const activeOpportunity = opportunities.find((o) => o.status === "open") ?? null;
  const sourceLead = leads[0] ?? null;

  const primaryContact = resolvePrimaryContact(contacts);
  const nextAction = resolveNextAction(tasks);
  const lastActivityAt = resolveLastActivityAt(leadNoteRows, clientNoteRows, pipelineActivityRows);

  const timelineEvents = [
    ...leadNoteRows.map((n) => mapLeadNoteToTimelineEvent(n, actorMap)),
    ...clientNoteRows.map((n) => mapClientNoteToTimelineEvent(n, actorMap)),
    ...pipelineActivityRows.map((a) => mapPipelineActivityToTimelineEvent(a, actorMap)),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const stripeRow = stripeRows[0] ?? null;
  const billingSummary: BillingSummary = stripeRow
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
