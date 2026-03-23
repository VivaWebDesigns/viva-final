import { db } from "../../db";
import { ProfileNotFoundError, ProfileLinkageError } from "./errors";
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
  automationExecutionLogs,
} from "@shared/schema";
import { eq, inArray, and, or, desc } from "drizzle-orm";
import {
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

interface AssembleOpts {
  primaryLeadId?: string;
  primaryOpportunityId?: string;
}

/**
 * assembleProfile — unified profile read path
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds the complete UnifiedProfileDto for a company from scratch.
 * All callers (getProfileByCompanyId, getProfileByLeadId,
 * getProfileByOpportunityId) converge here.
 *
 * Query structure — 4 sequential dependency waves:
 *
 *  Wave 1 (1 query)   — company row; must succeed before anything else runs.
 *  Wave 2 (8 parallel) — all company-scoped data; no inter-query dependencies.
 *  Wave 3 (≤3 parallel) — lead/opp-scoped data; needs leadIds + oppIds from W2.
 *                         Extra tasks consolidated into ONE OR query (was two).
 *                         Note/activity queries limited to 500 rows each.
 *  Wave 4 (≤2 parallel) — actor names + automation provenance; both need IDs
 *                         from W3 but are independent of each other.
 *
 * Worst-case total: 14 queries, 4 sequential rounds
 * (down from 18 queries / 6 sequential rounds before optimisation)
 *
 * Key optimisations vs. the pre-opt path:
 *  O1 — resolveByCompanyId() is NOT called before assembleProfile() from
 *       getProfileByCompanyId(). That call added 2-3 redundant round-trips
 *       solely to confirm existence — assembleProfile() already throws
 *       ProfileNotFoundError when the company row is absent.
 *  O2 — Extra-tasks query consolidation: WHERE leadId IN [...] OR oppId IN [...]
 *       replaces two separate followupTasks queries (saves 1 round-trip when
 *       both leadIds and oppIds are non-empty).
 *  O3 — User actor resolution and automation-log provenance are now fetched in
 *       a single Promise.all (wave 4) rather than sequentially (saves 1 round).
 *  O4 — Timeline note/activity queries capped at 500 rows (orderBy desc) to
 *       prevent pathological load for long-running accounts.
 */
async function assembleProfile(companyId: string, opts?: AssembleOpts): Promise<UnifiedProfileDto> {
  // ── WAVE 1 ─ company row (must exist before continuing) ───────────────────
  const t0 = Date.now();

  const [companyRow] = await db
    .select()
    .from(crmCompanies)
    .where(eq(crmCompanies.id, companyId));

  if (!companyRow) throw new ProfileNotFoundError("Company", companyId);

  console.debug(`[profile:w1] ${Date.now() - t0}ms company=${companyId}`);

  // ── WAVE 2 ─ all company-scoped relations (8 parallel queries) ────────────
  const t1 = Date.now();

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

    db.select().from(crmLeads)
      .where(eq(crmLeads.companyId, companyId))
      .orderBy(desc(crmLeads.createdAt)),

    db.select().from(pipelineOpportunities)
      .where(eq(pipelineOpportunities.companyId, companyId)),

    db.select().from(onboardingRecords)
      .where(eq(onboardingRecords.companyId, companyId)),

    // companyId-scoped tasks; lead/opp-scoped tasks added in wave 3
    db.select().from(followupTasks)
      .where(eq(followupTasks.companyId, companyId)),

    db.select().from(stripeCustomers)
      .where(eq(stripeCustomers.entityId, companyId)),

    db.select().from(attachments)
      .where(and(
        eq(attachments.entityType, "client"),
        eq(attachments.entityId, companyId),
      )),

    db.select().from(clientNotes)
      .where(eq(clientNotes.companyId, companyId))
      .orderBy(desc(clientNotes.createdAt))
      .limit(500),
  ]);

  console.debug(`[profile:w2] ${Date.now() - t1}ms 8 parallel queries`);

  const leadIds = leadRows.map((l) => l.id);
  const oppIds = opportunityRows.map((o) => o.id);
  const existingTaskIds = new Set(taskRows.map((t) => t.id));

  const hasLeads = leadIds.length > 0;
  const hasOpps = oppIds.length > 0;

  // ── WAVE 3 ─ lead/opp-scoped data (≤3 parallel queries) ──────────────────
  // O2: Extra tasks — one OR query replaces the previous two separate queries
  //     (leadId IN [...] and opportunityId IN [...]). Short-circuits to
  //     Promise.resolve([]) when neither set is populated, avoiding a DB call.
  // O4: Note/activity queries capped at 500 rows (newest-first) so large
  //     historical accounts don't dominate profile load time.
  const t2 = Date.now();

  const extraTasksCondition =
    hasLeads && hasOpps
      ? or(
          inArray(followupTasks.leadId, leadIds),
          inArray(followupTasks.opportunityId, oppIds),
        )
      : hasLeads
        ? inArray(followupTasks.leadId, leadIds)
        : hasOpps
          ? inArray(followupTasks.opportunityId, oppIds)
          : null;

  const [extraTaskRows, leadNoteRows, pipelineActivityRows] = await Promise.all([
    extraTasksCondition
      ? db.select().from(followupTasks).where(extraTasksCondition)
      : Promise.resolve([] as typeof taskRows),

    hasLeads
      ? db.select().from(crmLeadNotes)
          .where(inArray(crmLeadNotes.leadId, leadIds))
          .orderBy(desc(crmLeadNotes.createdAt))
          .limit(500)
      : Promise.resolve([] as (typeof crmLeadNotes.$inferSelect)[]),

    hasOpps
      ? db.select().from(pipelineActivities)
          .where(inArray(pipelineActivities.opportunityId, oppIds))
          .orderBy(desc(pipelineActivities.createdAt))
          .limit(500)
      : Promise.resolve([] as (typeof pipelineActivities.$inferSelect)[]),
  ]);

  // Merge extra tasks into taskRows, deduplicating by id
  for (const t of extraTaskRows) {
    if (!existingTaskIds.has(t.id)) {
      taskRows.push(t);
      existingTaskIds.add(t.id);
    }
  }

  console.debug(
    `[profile:w3] ${Date.now() - t2}ms leads=${leadIds.length} opps=${oppIds.length}`,
  );

  // ── WAVE 4 ─ actor names + automation provenance (≤2 parallel queries) ────
  // O3: These two queries both depend on IDs from wave 3 but are independent
  //     of each other — run them in one Promise.all rather than sequentially.
  const t3 = Date.now();

  const allUserIds = [
    ...new Set(
      [
        ...leadNoteRows.map((n) => n.userId),
        ...clientNoteRows.map((n) => n.userId),
        ...pipelineActivityRows.map((a) => a.userId),
      ].filter((id): id is string => id !== null && id !== undefined),
    ),
  ];
  const taskIds = taskRows.map((t) => t.id);

  const [userRows, automationLogRows] = await Promise.all([
    allUserIds.length > 0
      ? db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, allUserIds))
      : Promise.resolve([] as { id: string; name: string }[]),

    taskIds.length > 0
      ? db
          .select({
            generatedTaskId: automationExecutionLogs.generatedTaskId,
            triggerStageSlug: automationExecutionLogs.triggerStageSlug,
            templateId: automationExecutionLogs.templateId,
            createdAt: automationExecutionLogs.createdAt,
          })
          .from(automationExecutionLogs)
          .where(
            and(
              inArray(automationExecutionLogs.generatedTaskId, taskIds),
              eq(automationExecutionLogs.status, "success"),
            ),
          )
      : Promise.resolve(
          [] as {
            generatedTaskId: string | null;
            triggerStageSlug: string;
            templateId: string | null;
            createdAt: Date;
          }[],
        ),
  ]);

  console.debug(
    `[profile:w4] ${Date.now() - t3}ms actors=${allUserIds.length} tasks=${taskIds.length}`,
  );

  // ── Build lookup maps ─────────────────────────────────────────────────────
  const actorMap = new Map<string, string>();
  for (const u of userRows) actorMap.set(u.id, u.name);

  const automationMetaMap = new Map(
    automationLogRows
      .filter((r) => r.generatedTaskId)
      .map((r) => [
        r.generatedTaskId!,
        {
          triggerStageSlug: r.triggerStageSlug,
          templateId: r.templateId!,
          executedAt: r.createdAt,
        },
      ]),
  );

  // ── Map DB rows through domain mappers ────────────────────────────────────
  const company = mapCompany(companyRow);
  const contacts = contactRows.map(mapContact);
  const leads = leadRows.map(mapLead);
  const opportunities = opportunityRows.map(mapOpportunity);
  const tasks = taskRows.map((t) => mapTask(t, automationMetaMap.get(t.id)));
  const onboarding = onboardingRows.map(mapOnboarding);
  const files = fileRows.map(mapFile);

  // ── Derive composite values ───────────────────────────────────────────────
  const activeOpportunity = opts?.primaryOpportunityId
    ? (opportunities.find((o) => o.id === opts.primaryOpportunityId)
        ?? opportunities.find((o) => o.status === "open")
        ?? null)
    : (opportunities.find((o) => o.status === "open") ?? null);

  const sourceLead = opts?.primaryLeadId
    ? (leads.find((l) => l.id === opts.primaryLeadId) ?? leads[0] ?? null)
    : (leads[0] ?? null);

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

  console.debug(`[profile:total] ${Date.now() - t0}ms company=${companyId}`);

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

// ── Public entry points ───────────────────────────────────────────────────────

export async function getProfileByCompanyId(
  companyId: string,
): Promise<UnifiedProfileDto> {
  // O1: resolveByCompanyId() is intentionally NOT called here.
  // It would add 2-3 extra round-trips just to confirm existence — but
  // assembleProfile() already throws ProfileNotFoundError when the company
  // row is absent. The pre-flight check was purely redundant.
  return assembleProfile(companyId);
}

export async function getProfileByLeadId(
  leadId: string,
): Promise<UnifiedProfileDto> {
  const identity = await resolveByLeadId(leadId);
  if (!identity.companyId) {
    throw new ProfileLinkageError(
      `Lead ${leadId} has no linked company — cannot build profile`,
    );
  }
  return assembleProfile(identity.companyId, { primaryLeadId: leadId });
}

export async function getProfileByOpportunityId(
  opportunityId: string,
): Promise<UnifiedProfileDto> {
  const identity = await resolveByOpportunityId(opportunityId);
  if (!identity.companyId) {
    throw new ProfileLinkageError(
      `Opportunity ${opportunityId} has no linked company — cannot build profile`,
    );
  }
  return assembleProfile(identity.companyId, { primaryOpportunityId: opportunityId });
}
