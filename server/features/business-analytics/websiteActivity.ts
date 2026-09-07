import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  scanReportDeliveries,
  websiteActivityEvents,
  websiteActivitySessions,
} from "@shared/schema";
import { db } from "../../db";

export const WEBSITE_ACTIVITY_RETENTION_DAYS = 90;

export const WEBSITE_ACTIVITY_EVENT_TYPES = [
  "page_view",
  "active_time",
  "phone_click",
  "email_click",
  "schedule_click",
  "scan_interest",
  "results_interest",
  "contact_interest",
  "form_start",
  "form_submit",
  "deep_scroll",
] as const;

const actionTypes = new Set<string>(WEBSITE_ACTIVITY_EVENT_TYPES.filter((type) => !["page_view", "active_time"].includes(type)));

export const websiteActivityBatchSchema = z.object({
  sessionId: z.string().uuid(),
  referrerHost: z.string().trim().max(253).optional().nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  events: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(WEBSITE_ACTIVITY_EVENT_TYPES),
    path: z.string().trim().min(1).max(300),
    activeSeconds: z.number().int().min(0).max(30).optional(),
    occurredAt: z.string().datetime(),
  })).min(1).max(20),
}).strict();

export type WebsiteActivityBatch = z.infer<typeof websiteActivityBatchSchema>;

type HeaderValue = string | string[] | undefined;

function firstHeader(value: HeaderValue): string | null {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item) return null;
  try {
    return decodeURIComponent(item).trim().slice(0, 120) || null;
  } catch {
    return item.trim().slice(0, 120) || null;
  }
}

export function approximateLocation(headers: Record<string, HeaderValue>) {
  return {
    city: firstHeader(headers["cf-ipcity"]),
    region: firstHeader(headers["cf-region"] || headers["cf-region-code"]),
    country: firstHeader(headers["cf-ipcountry"]),
  };
}

export function isAutomatedUserAgent(userAgent: string | undefined): boolean {
  return !userAgent || /(bot|crawler|spider|preview|scanner|safelink|proofpoint|mimecast|barracuda|urlscan|virustotal|headless|phantomjs|lighthouse|pagespeed|pingdom|uptime|monitoring)/i.test(userAgent);
}

export function deviceCategory(userAgent: string | undefined): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!userAgent) return "unknown";
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function cleanPublicPath(value: string): string {
  const raw = value.split("?")[0]?.split("#")[0] || "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/{2,}/g, "/").slice(0, 300);
}

export function sourceLabel(referrerHost: string | null | undefined, suppliedSource?: string | null): string {
  const supplied = suppliedSource?.trim();
  if (supplied) return supplied.slice(0, 80);
  const host = referrerHost?.toLowerCase().replace(/^www\./, "");
  if (!host || host === "vivawebdesigns.com") return "Direct";
  if (/(^|\.)google\./.test(host)) return "Google search";
  if (/(^|\.)bing\.com$/.test(host)) return "Bing search";
  return host.slice(0, 80);
}

function safeOccurredAt(value: string, now = new Date()): Date {
  const parsed = new Date(value);
  const tenMinutes = 10 * 60 * 1_000;
  if (!Number.isFinite(parsed.getTime()) || Math.abs(parsed.getTime() - now.getTime()) > tenMinutes) return now;
  return parsed;
}

let lastRetentionCleanup = 0;

async function cleanupExpiredActivity() {
  const now = Date.now();
  if (now - lastRetentionCleanup < 24 * 60 * 60 * 1_000) return;
  await db.delete(websiteActivitySessions).where(sql`${websiteActivitySessions.lastSeenAt} < now() - interval '${sql.raw(String(WEBSITE_ACTIVITY_RETENTION_DAYS))} days'`);
  lastRetentionCleanup = now;
}

export async function recordWebsiteActivity(
  input: WebsiteActivityBatch,
  context: {
    headers: Record<string, HeaderValue>;
    userAgent?: string;
    isInternal: boolean;
  },
) {
  await cleanupExpiredActivity();
  const now = new Date();
  const events = input.events.map((event) => ({
    id: event.id,
    sessionId: input.sessionId,
    eventType: event.type,
    path: cleanPublicPath(event.path),
    activeSeconds: event.type === "active_time" ? event.activeSeconds ?? 0 : 0,
    occurredAt: safeOccurredAt(event.occurredAt, now),
  }));
  const first = events.reduce((value, event) => event.occurredAt < value ? event.occurredAt : value, events[0]!.occurredAt);
  const last = events.reduce((value, event) => event.occurredAt > value ? event.occurredAt : value, events[0]!.occurredAt);
  const firstPage = events.find((event) => event.eventType === "page_view")?.path ?? events[0]!.path;
  const location = approximateLocation(context.headers);
  const automated = isAutomatedUserAgent(context.userAgent);

  return db.transaction(async (tx) => {
    await tx.insert(websiteActivitySessions).values({
      id: input.sessionId,
      startedAt: first,
      lastSeenAt: last,
      entryPath: firstPage,
      referrerHost: input.referrerHost || null,
      source: sourceLabel(input.referrerHost, input.source),
      city: location.city,
      region: location.region,
      country: location.country,
      device: deviceCategory(context.userAgent),
      isAutomated: automated,
      isInternal: context.isInternal,
    }).onConflictDoNothing();

    const accepted = await tx.insert(websiteActivityEvents).values(events).onConflictDoNothing().returning();
    if (!accepted.length) return { accepted: 0 };

    const pageViews = accepted.filter((event) => event.eventType === "page_view").length;
    const activeSeconds = accepted.reduce((total, event) => total + event.activeSeconds, 0);
    const actions = accepted.filter((event) => actionTypes.has(event.eventType)).length;
    const acceptedLast = accepted.reduce((value, event) => event.occurredAt > value ? event.occurredAt : value, accepted[0]!.occurredAt);
    await tx.update(websiteActivitySessions).set({
      lastSeenAt: sql`greatest(${websiteActivitySessions.lastSeenAt}, ${acceptedLast})`,
      pageViewCount: sql`${websiteActivitySessions.pageViewCount} + ${pageViews}`,
      activeSeconds: sql`${websiteActivitySessions.activeSeconds} + ${activeSeconds}`,
      actionCount: sql`${websiteActivitySessions.actionCount} + ${actions}`,
      isAutomated: sql`${websiteActivitySessions.isAutomated} or ${automated}`,
      isInternal: sql`${websiteActivitySessions.isInternal} or ${context.isInternal}`,
      updatedAt: now,
    }).where(eq(websiteActivitySessions.id, input.sessionId));
    return { accepted: accepted.length };
  });
}

export function websiteSessionQuality(session: {
  pageViewCount: number;
  activeSeconds: number;
  actionCount: number;
  isAutomated: boolean;
  isInternal: boolean;
}): "meaningful" | "brief" | "automated" | "internal" {
  if (session.isInternal) return "internal";
  if (session.isAutomated) return "automated";
  if (session.activeSeconds >= 10 || session.pageViewCount >= 2 || session.actionCount > 0) return "meaningful";
  return "brief";
}

export async function getWebsiteActivityDashboard(startDate: string, endDate: string) {
  await cleanupExpiredActivity();
  const sessionRows = await db.select().from(websiteActivitySessions).where(and(
    sql`(((${websiteActivitySessions.startedAt} at time zone 'UTC') at time zone 'America/New_York')::date >= ${startDate}::date)`,
    sql`(((${websiteActivitySessions.startedAt} at time zone 'UTC') at time zone 'America/New_York')::date <= ${endDate}::date)`,
  )).orderBy(desc(websiteActivitySessions.startedAt)).limit(500);

  const sessionIds = sessionRows.map((session) => session.id);
  const eventRows = sessionIds.length
    ? await db.select().from(websiteActivityEvents).where(inArray(websiteActivityEvents.sessionId, sessionIds)).orderBy(asc(websiteActivityEvents.occurredAt))
    : [];
  const eventsBySession = new Map<string, typeof eventRows>();
  for (const event of eventRows) {
    const items = eventsBySession.get(event.sessionId) ?? [];
    items.push(event);
    eventsBySession.set(event.sessionId, items);
  }

  const sends = await db.select({ sentAt: scanReportDeliveries.sentAt })
    .from(scanReportDeliveries)
    .where(and(
      sql`${scanReportDeliveries.sentAt} is not null`,
      sql`(((${scanReportDeliveries.sentAt} at time zone 'UTC') at time zone 'America/New_York')::date >= ${startDate}::date)`,
      sql`(((${scanReportDeliveries.sentAt} at time zone 'UTC') at time zone 'America/New_York')::date <= ${endDate}::date)`,
    ))
    .orderBy(desc(scanReportDeliveries.sentAt));

  const sessions = sessionRows.map((session) => {
    const events = eventsBySession.get(session.id) ?? [];
    return {
      id: session.id.slice(0, 8),
      startedAt: session.startedAt,
      lastSeenAt: session.lastSeenAt,
      entryPath: session.entryPath,
      referrerHost: session.referrerHost,
      source: session.source,
      city: session.city,
      region: session.region,
      country: session.country,
      device: session.device,
      pageViewCount: session.pageViewCount,
      activeSeconds: session.activeSeconds,
      actionCount: session.actionCount,
      quality: websiteSessionQuality(session),
      journey: events
        .filter((event) => event.eventType !== "active_time")
        .map((event) => ({ type: event.eventType, path: event.path, occurredAt: event.occurredAt })),
    };
  });
  const counts = sessions.reduce((totals, session) => {
    totals[session.quality] += 1;
    return totals;
  }, { meaningful: 0, brief: 0, automated: 0, internal: 0 });

  return {
    dateRange: { startDate, endDate },
    detailedTrackingStartedAt: sessionRows.length
      ? sessionRows.reduce((value, session) => session.startedAt < value ? session.startedAt : value, sessionRows[0]!.startedAt)
      : null,
    summary: {
      credibleSessions: counts.meaningful + counts.brief,
      meaningfulSessions: counts.meaningful,
      briefSessions: counts.brief,
      filteredSessions: counts.automated + counts.internal,
      automatedSessions: counts.automated,
      internalSessions: counts.internal,
    },
    sessions,
    emailSends: sends.flatMap((send) => send.sentAt ? [{ sentAt: send.sentAt }] : []),
    retentionDays: WEBSITE_ACTIVITY_RETENTION_DAYS,
    generatedAt: new Date().toISOString(),
  };
}
