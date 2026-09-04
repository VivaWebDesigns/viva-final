import { and, desc, eq, gt, gte, inArray, isNotNull, sql } from "drizzle-orm";
import {
  crmCompanies,
  crmLeadNotes,
  crmLeads,
  googleBusinessReviews,
  googleIntegrationConnections,
  googleOAuthStates,
  scanReportDeliveries,
  scanReportEngagementEvents,
} from "@shared/schema";
import { db } from "../../db";
import type { GoogleProvider } from "./googleAuth";

export async function createGoogleOAuthState(input: {
  stateHash: string;
  provider: GoogleProvider;
  userId: string;
  expiresAt: Date;
}) {
  await db.insert(googleOAuthStates).values(input);
}

export async function consumeGoogleOAuthState(stateHash: string) {
  return db.transaction(async (tx) => {
    const [state] = await tx.select().from(googleOAuthStates).where(and(
      eq(googleOAuthStates.stateHash, stateHash),
      gt(googleOAuthStates.expiresAt, new Date()),
    )).limit(1);
    if (!state) return null;
    await tx.delete(googleOAuthStates).where(eq(googleOAuthStates.stateHash, stateHash));
    return state;
  });
}

export async function getGoogleConnection(provider: GoogleProvider) {
  const [connection] = await db.select().from(googleIntegrationConnections)
    .where(eq(googleIntegrationConnections.provider, provider))
    .limit(1);
  return connection ?? null;
}

export async function listGoogleConnections() {
  return db.select().from(googleIntegrationConnections)
    .orderBy(googleIntegrationConnections.provider);
}

export async function upsertGoogleConnection(input: {
  provider: GoogleProvider;
  encryptedRefreshToken: string;
  scopes: string;
  accountEmail?: string | null;
  propertyId?: string | null;
}) {
  const [connection] = await db.insert(googleIntegrationConnections).values({
    ...input,
    status: "connected",
    lastError: null,
  }).onConflictDoUpdate({
    target: googleIntegrationConnections.provider,
    set: {
      encryptedRefreshToken: input.encryptedRefreshToken,
      scopes: input.scopes,
      accountEmail: input.accountEmail ?? null,
      propertyId: input.propertyId ?? null,
      status: "connected",
      lastError: null,
      updatedAt: new Date(),
    },
  }).returning();
  return connection;
}

export async function updateGoogleConnection(
  provider: GoogleProvider,
  values: Partial<{
    externalAccountId: string | null;
    propertyId: string | null;
    locationId: string | null;
    locationTitle: string | null;
    status: string;
    lastSyncedAt: Date | null;
    lastError: string | null;
  }>,
) {
  const [connection] = await db.update(googleIntegrationConnections).set({
    ...values,
    updatedAt: new Date(),
  }).where(eq(googleIntegrationConnections.provider, provider)).returning();
  return connection ?? null;
}

export interface SyncedGoogleReview {
  googleReviewName: string;
  locationId: string;
  reviewerName: string | null;
  starRating: number;
  comment: string | null;
  reviewCreatedAt: Date;
  reviewUpdatedAt: Date | null;
  replyComment: string | null;
  replyUpdatedAt: Date | null;
}

export async function upsertGoogleReviews(connectionId: string, reviews: SyncedGoogleReview[]) {
  if (reviews.length === 0) return;
  const syncedAt = new Date();
  await db.transaction(async (tx) => {
    for (const review of reviews) {
      await tx.insert(googleBusinessReviews).values({
        connectionId,
        ...review,
        syncedAt,
      }).onConflictDoUpdate({
        target: googleBusinessReviews.googleReviewName,
        set: {
          reviewerName: review.reviewerName,
          starRating: review.starRating,
          comment: review.comment,
          reviewCreatedAt: review.reviewCreatedAt,
          reviewUpdatedAt: review.reviewUpdatedAt,
          replyComment: review.replyComment,
          replyUpdatedAt: review.replyUpdatedAt,
          syncedAt,
        },
      });
    }
  });
}

export async function listStoredGoogleReviews(locationId: string, limit = 5_000) {
  return db.select().from(googleBusinessReviews)
    .where(eq(googleBusinessReviews.locationId, locationId))
    .orderBy(desc(googleBusinessReviews.reviewCreatedAt))
    .limit(limit);
}

const RESPONSE_OUTCOMES = new Set(["Interested", "Uncertain", "Appointment set", "Not interested", "Opted out"]);

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1_000) / 10 : 0;
}

export async function getReportOutreachAnalytics(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
  const deliveries = await db.select({
    id: scanReportDeliveries.id,
    leadId: scanReportDeliveries.leadId,
    templateKey: scanReportDeliveries.templateKey,
    subject: scanReportDeliveries.emailSubject,
    sentAt: scanReportDeliveries.sentAt,
    viewCount: scanReportDeliveries.viewCount,
    ctaClickCount: scanReportDeliveries.ctaClickCount,
    leadTitle: crmLeads.title,
    trade: crmLeads.trade,
    companyName: crmCompanies.name,
  }).from(scanReportDeliveries)
    .innerJoin(crmLeads, eq(scanReportDeliveries.leadId, crmLeads.id))
    .leftJoin(crmCompanies, eq(crmLeads.companyId, crmCompanies.id))
    .where(and(isNotNull(scanReportDeliveries.sentAt), gte(scanReportDeliveries.sentAt, since)))
    .orderBy(desc(scanReportDeliveries.sentAt), desc(scanReportDeliveries.id));

  const deliveryIds = deliveries.map(row => row.id);
  const leadIds = [...new Set(deliveries.map(row => row.leadId))];
  const [events, outcomeNotes, allLeadDeliveries] = await Promise.all([
    deliveryIds.length > 0
      ? db.select({
        deliveryId: scanReportEngagementEvents.deliveryId,
        ctaType: scanReportEngagementEvents.ctaType,
      }).from(scanReportEngagementEvents).where(and(
        inArray(scanReportEngagementEvents.deliveryId, deliveryIds),
        eq(scanReportEngagementEvents.eventType, "cta_click"),
        eq(scanReportEngagementEvents.automated, false),
      ))
      : Promise.resolve([]),
    leadIds.length > 0
      ? db.select({
        leadId: crmLeadNotes.leadId,
        metadata: crmLeadNotes.metadata,
        createdAt: crmLeadNotes.createdAt,
      }).from(crmLeadNotes).where(and(
        inArray(crmLeadNotes.leadId, leadIds),
        sql`${crmLeadNotes.metadata}->>'reportOutreachDisposition' is not null`,
      )).orderBy(desc(crmLeadNotes.createdAt), desc(crmLeadNotes.id))
      : Promise.resolve([]),
    leadIds.length > 0
      ? db.select({
        id: scanReportDeliveries.id,
        leadId: scanReportDeliveries.leadId,
        sentAt: scanReportDeliveries.sentAt,
      }).from(scanReportDeliveries).where(and(
        inArray(scanReportDeliveries.leadId, leadIds),
        isNotNull(scanReportDeliveries.sentAt),
      )).orderBy(desc(scanReportDeliveries.sentAt), desc(scanReportDeliveries.id))
      : Promise.resolve([]),
  ]);

  const latestOutcomeByLead = new Map<string, string>();
  for (const note of outcomeNotes) {
    if (latestOutcomeByLead.has(note.leadId)) continue;
    const outcome = (note.metadata as { outcome?: unknown } | null)?.outcome;
    if (typeof outcome === "string") latestOutcomeByLead.set(note.leadId, outcome);
  }
  const latestDeliveryByLead = new Map<string, string>();
  for (const delivery of allLeadDeliveries) {
    if (!latestDeliveryByLead.has(delivery.leadId)) latestDeliveryByLead.set(delivery.leadId, delivery.id);
  }
  const eventsByDelivery = new Map<string, string[]>();
  for (const event of events) {
    if (!event.ctaType) continue;
    const current = eventsByDelivery.get(event.deliveryId) ?? [];
    current.push(event.ctaType);
    eventsByDelivery.set(event.deliveryId, current);
  }

  type TemplateGroup = {
    key: string;
    sent: number;
    views: number;
    clicks: number;
    leadIds: Set<string>;
    engagedLeadIds: Set<string>;
    clickedLeadIds: Set<string>;
    responseLeadIds: Set<string>;
    appointmentLeadIds: Set<string>;
    optOutLeadIds: Set<string>;
    bouncedLeadIds: Set<string>;
    ctaBreakdown: Record<string, number>;
  };
  const groups = new Map<string, TemplateGroup>();
  const deliveryById = new Map(deliveries.map(row => [row.id, row]));
  const groupFor = (key: string) => {
    let group = groups.get(key);
    if (!group) {
      group = {
        key, sent: 0, views: 0, clicks: 0,
        leadIds: new Set(), engagedLeadIds: new Set(), clickedLeadIds: new Set(),
        responseLeadIds: new Set(), appointmentLeadIds: new Set(), optOutLeadIds: new Set(), bouncedLeadIds: new Set(),
        ctaBreakdown: {},
      };
      groups.set(key, group);
    }
    return group;
  };

  for (const delivery of deliveries) {
    const key = delivery.templateKey || "Unlabeled";
    const group = groupFor(key);
    group.sent += 1;
    group.views += delivery.viewCount;
    group.clicks += delivery.ctaClickCount;
    group.leadIds.add(delivery.leadId);
    if (delivery.viewCount > 0) group.engagedLeadIds.add(delivery.leadId);
    if (delivery.ctaClickCount > 0) group.clickedLeadIds.add(delivery.leadId);
    for (const ctaType of eventsByDelivery.get(delivery.id) ?? []) {
      group.ctaBreakdown[ctaType] = (group.ctaBreakdown[ctaType] ?? 0) + 1;
    }
  }

  for (const [leadId, outcome] of latestOutcomeByLead) {
    const latestDelivery = deliveryById.get(latestDeliveryByLead.get(leadId) ?? "");
    if (!latestDelivery) continue;
    const group = groupFor(latestDelivery.templateKey || "Unlabeled");
    if (RESPONSE_OUTCOMES.has(outcome)) group.responseLeadIds.add(leadId);
    if (outcome === "Appointment set") group.appointmentLeadIds.add(leadId);
    if (outcome === "Opted out") group.optOutLeadIds.add(leadId);
    if (outcome === "Email bounced") group.bouncedLeadIds.add(leadId);
  }

  const templates = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(group => {
    const leads = group.leadIds.size;
    return {
      templateKey: group.key,
      templateName: group.key === "A" ? "Current outreach" : group.key === "Unlabeled" ? "Older sends" : `Template ${group.key}`,
      sent: group.sent,
      uniqueLeads: leads,
      engagedLeads: group.engagedLeadIds.size,
      clickedLeads: group.clickedLeadIds.size,
      responses: group.responseLeadIds.size,
      appointments: group.appointmentLeadIds.size,
      optOuts: group.optOutLeadIds.size,
      bounces: group.bouncedLeadIds.size,
      totalViews: group.views,
      totalClicks: group.clicks,
      engagedRate: percent(group.engagedLeadIds.size, leads),
      clickRate: percent(group.clickedLeadIds.size, leads),
      responseRate: percent(group.responseLeadIds.size, leads),
      appointmentRate: percent(group.appointmentLeadIds.size, leads),
      ctaBreakdown: group.ctaBreakdown,
    };
  });

  const allLeads = new Set(deliveries.map(row => row.leadId));
  const engagedLeads = new Set(deliveries.filter(row => row.viewCount > 0).map(row => row.leadId));
  const clickedLeads = new Set(deliveries.filter(row => row.ctaClickCount > 0).map(row => row.leadId));
  const respondingLeads = new Set<string>();
  const appointmentLeads = new Set<string>();
  for (const [leadId, outcome] of latestOutcomeByLead) {
    if (!allLeads.has(leadId)) continue;
    if (RESPONSE_OUTCOMES.has(outcome)) respondingLeads.add(leadId);
    if (outcome === "Appointment set") appointmentLeads.add(leadId);
  }

  return {
    days,
    generatedAt: new Date().toISOString(),
    summary: {
      sent: deliveries.length,
      uniqueLeads: allLeads.size,
      engagedLeads: engagedLeads.size,
      clickedLeads: clickedLeads.size,
      responses: respondingLeads.size,
      appointments: appointmentLeads.size,
      engagedRate: percent(engagedLeads.size, allLeads.size),
      clickRate: percent(clickedLeads.size, allLeads.size),
      responseRate: percent(respondingLeads.size, allLeads.size),
      appointmentRate: percent(appointmentLeads.size, allLeads.size),
    },
    templates,
    recent: deliveries.slice(0, 100).map(delivery => ({
      deliveryId: delivery.id,
      leadId: delivery.leadId,
      companyName: delivery.companyName || delivery.leadTitle,
      trade: delivery.trade,
      templateKey: delivery.templateKey || "Unlabeled",
      subject: delivery.subject,
      sentAt: delivery.sentAt,
      viewCount: delivery.viewCount,
      ctaClickCount: delivery.ctaClickCount,
      ctaTypes: [...new Set(eventsByDelivery.get(delivery.id) ?? [])],
      outcome: latestDeliveryByLead.get(delivery.leadId) === delivery.id
        ? latestOutcomeByLead.get(delivery.leadId) ?? null
        : null,
    })),
  };
}
