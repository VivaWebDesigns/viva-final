import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, sql } from "drizzle-orm";
import * as z from "zod/v4";
import { instantlyEnrollments, instantlyWebhookEvents, type GoogleIntegrationConnection } from "@shared/schema";
import { db } from "../../db";
import {
  LANDING_PAGE_DIMENSION_FILTER,
  runGaReport,
  tableRows,
  type GoogleAnalyticsDateRange,
} from "./googleApi";

const MODEL = "claude-opus-5-5";

/** Cities within roughly 15 miles of uptown Charlotte, as GA4 names them. Edit this list to change the target area. */
export const TARGET_AREA_CITIES = [
  "Charlotte",
  "Matthews",
  "Mint Hill",
  "Pineville",
  "Huntersville",
  "Cornelius",
  "Harrisburg",
  "Stallings",
  "Indian Trail",
  "Weddington",
  "Belmont",
  "Mount Holly",
  "Cramerton",
  "Fort Mill",
  "Tega Cay",
  "Lake Wylie",
];

const TARGET_REGIONS = ["North Carolina", "South Carolina"];
const targetCitySet = new Set(TARGET_AREA_CITIES.map((city) => city.toLowerCase()));

const TARGET_AREA_FILTER = {
  andGroup: {
    expressions: [
      { filter: { fieldName: "city", inListFilter: { values: TARGET_AREA_CITIES, caseSensitive: false } } },
      { filter: { fieldName: "region", inListFilter: { values: TARGET_REGIONS, caseSensitive: false } } },
    ],
  },
};

function both(...filters: unknown[]) {
  return { andGroup: { expressions: filters } };
}

function isTargetCity(city: unknown, region: unknown) {
  return typeof city === "string" && typeof region === "string"
    && targetCitySet.has(city.toLowerCase()) && TARGET_REGIONS.includes(region);
}

/** GA4 events that every visit fires; they say nothing about what the visitor did. */
const AUTOMATIC_EVENTS = new Set(["page_view", "session_start", "first_visit", "user_engagement"]);

const SUMMARY_METRICS = ["sessions", "engagedSessions", "bounceRate", "averageSessionDuration", "screenPageViews", "keyEvents"];
const PAGE_METRICS = ["sessions", "engagedSessions", "bounceRate", "averageSessionDuration", "keyEvents"];

const easternDateSql = (column: typeof instantlyWebhookEvents.createdAt | typeof instantlyEnrollments.enrolledAt) =>
  sql`(((${column} at time zone 'UTC') at time zone 'America/New_York')::date)`;

/** Instantly activity in the range: leads added to a campaign and webhook events by type and day. */
export async function getEmailActivity(startDate: string, endDate: string) {
  const eventDate = easternDateSql(instantlyWebhookEvents.createdAt);
  const enrolledDate = easternDateSql(instantlyEnrollments.enrolledAt);
  const [events, enrolled] = await Promise.all([
    db.select({
      date: sql<string>`${eventDate}::text`,
      eventType: instantlyWebhookEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
      .from(instantlyWebhookEvents)
      .where(and(sql`${eventDate} >= ${startDate}::date`, sql`${eventDate} <= ${endDate}::date`))
      .groupBy(eventDate, instantlyWebhookEvents.eventType)
      .orderBy(eventDate),
    db.select({
      date: sql<string>`${enrolledDate}::text`,
      count: sql<number>`count(*)::int`,
    })
      .from(instantlyEnrollments)
      .where(and(sql`${enrolledDate} >= ${startDate}::date`, sql`${enrolledDate} <= ${endDate}::date`))
      .groupBy(enrolledDate)
      .orderBy(enrolledDate),
  ]);
  const totals: Record<string, number> = {};
  for (const row of events) totals[row.eventType] = (totals[row.eventType] ?? 0) + row.count;
  return {
    leadsAddedToCampaign: enrolled.reduce((sum, row) => sum + row.count, 0),
    leadsAddedByDay: enrolled,
    webhookEventTotals: totals,
    webhookEventsByDay: events,
  };
}

export async function getCampaignSnapshot(connection: GoogleIntegrationConnection, dateRange: GoogleAnalyticsDateRange) {
  const [targetSummary, allSummary, cityReport, pageReport, deviceReport, eventReport, email] = await Promise.all([
    runGaReport(connection, dateRange, { metrics: SUMMARY_METRICS, dimensionFilter: TARGET_AREA_FILTER }),
    runGaReport(connection, dateRange, { metrics: ["sessions"] }),
    runGaReport(connection, dateRange, {
      dimensions: ["city", "region"],
      metrics: ["sessions", "bounceRate", "averageSessionDuration"],
      orderMetric: "sessions",
      limit: 25,
    }),
    runGaReport(connection, dateRange, {
      dimensions: ["landingPagePlusQueryString"],
      metrics: PAGE_METRICS,
      dimensionFilter: both(TARGET_AREA_FILTER, LANDING_PAGE_DIMENSION_FILTER),
      orderMetric: "sessions",
      limit: 15,
    }),
    runGaReport(connection, dateRange, {
      dimensions: ["deviceCategory"],
      metrics: PAGE_METRICS,
      dimensionFilter: TARGET_AREA_FILTER,
      orderMetric: "sessions",
    }),
    runGaReport(connection, dateRange, {
      dimensions: ["eventName"],
      metrics: ["eventCount"],
      dimensionFilter: TARGET_AREA_FILTER,
      orderMetric: "eventCount",
      limit: 30,
    }),
    getEmailActivity(dateRange.startDate, dateRange.endDate),
  ]);

  const summary = tableRows(targetSummary, [], SUMMARY_METRICS)[0] ?? {};
  const totalSessions = Number(tableRows(allSummary, [], ["sessions"])[0]?.sessions ?? 0);
  return {
    dateRange,
    targetCities: TARGET_AREA_CITIES,
    summary: { ...summary, outsideSessions: Math.max(0, totalSessions - Number(summary.sessions ?? 0)) },
    cities: tableRows(cityReport, ["city", "region"], ["sessions", "bounceRate", "averageSessionDuration"])
      .map((row) => ({ ...row, inTarget: isTargetCity(row.city, row.region) })),
    landingPages: tableRows(pageReport, ["landingPagePlusQueryString"], PAGE_METRICS),
    devices: tableRows(deviceReport, ["deviceCategory"], PAGE_METRICS),
    actions: tableRows(eventReport, ["eventName"], ["eventCount"])
      .filter((row) => !AUTOMATIC_EVENTS.has(String(row.eventName))),
    email,
  };
}

// ─── Ask ────────────────────────────────────────────────────────────

const GA_DIMENSIONS = [
  "date", "dateHour", "hour", "dayOfWeekName",
  "city", "region",
  "landingPagePlusQueryString", "pagePathPlusQueryString", "pageTitle",
  "deviceCategory", "browser", "operatingSystem",
  "sessionSource", "sessionMedium", "sessionDefaultChannelGroup",
  "newVsReturning", "eventName",
] as const;

const GA_METRICS = [
  "sessions", "engagedSessions", "bounceRate", "engagementRate",
  "averageSessionDuration", "userEngagementDuration", "screenPageViews",
  "screenPageViewsPerSession", "activeUsers", "newUsers", "eventCount", "keyEvents",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SYSTEM_PROMPT = `You answer questions about how the Viva Web Designs website (vivawebdesigns.com) is performing. Viva builds websites for local service businesses.

Context:
- The site is new and gets almost no organic traffic. Nearly all real visits come from an Instantly cold email campaign sent to businesses within about 15 miles of Charlotte, NC.
- Visits from the target area are the ones that matter. Target cities (as GA4 names them): ${TARGET_AREA_CITIES.join(", ")}. Visits from elsewhere are usually bots, email security scanners or unrelated people.
- Data comes from Google Analytics 4 (run_ga4_report) and from Instantly webhooks and campaign enrollments (get_email_activity). Instantly only sends the webhook events it is configured to send, so missing event types may simply not be set up.

How to answer:
- Use the tools to get the numbers. Never estimate or invent a figure; if the data cannot answer the question, say so.
- Bounce rate is GA4's bounceRate: the share of sessions that were not engaged (under 10 seconds, one page, no key event). GA4 returns rates as fractions; show them as percentages.
- GA4 location comes from IP address and is approximate, and today's GA4 data can lag by a few hours. Mention these only when they matter for the answer.
- With small numbers (a handful of sessions), say so rather than drawing strong conclusions.
- Lead with the direct answer, then the supporting numbers, then one or two practical observations if they are useful.
- Write plain text for a busy business owner: short paragraphs and "- " bullet lists. No markdown headings, tables or bold.`;

export class CampaignAskError extends Error {}

export interface CampaignAskTurn { role: "user" | "assistant"; text: string }

export async function askCampaignQuestion(
  connection: GoogleIntegrationConnection,
  input: { question: string; history: CampaignAskTurn[]; today: string },
) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new CampaignAskError("ANTHROPIC_API_KEY is not set on the server. Add it in Railway to ask questions.");
  }

  const gaReport = betaZodTool({
    name: "run_ga4_report",
    description: "Run a Google Analytics 4 report for the website. Returns one row per combination of the chosen dimensions. Leave dimensions empty for overall totals. Set targetAreaOnly to limit results to visits from the Charlotte target cities.",
    inputSchema: z.object({
      startDate: isoDate.describe("YYYY-MM-DD, inclusive"),
      endDate: isoDate.describe("YYYY-MM-DD, inclusive"),
      dimensions: z.array(z.enum(GA_DIMENSIONS)).max(4),
      metrics: z.array(z.enum(GA_METRICS)).min(1).max(8),
      targetAreaOnly: z.boolean(),
      eventNames: z.array(z.string()).max(20).optional().describe("Only include these GA4 event names (use with the eventName dimension or eventCount metric)"),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (args) => {
      const filters: unknown[] = [];
      if (args.targetAreaOnly) filters.push(TARGET_AREA_FILTER);
      if (args.eventNames?.length) {
        filters.push({ filter: { fieldName: "eventName", inListFilter: { values: args.eventNames, caseSensitive: true } } });
      }
      try {
        const report = await runGaReport(connection, { ...args, label: "", days: 0 }, {
          dimensions: args.dimensions,
          metrics: args.metrics,
          dimensionFilter: filters.length > 1 ? both(...filters) : filters[0],
          orderMetric: args.metrics[0],
          limit: args.limit ?? 50,
        });
        return JSON.stringify(tableRows(report, args.dimensions, args.metrics));
      } catch (error: any) {
        return `GA4 error: ${error?.response?.data?.error?.message || error?.message || "request failed"}`;
      }
    },
  });

  const emailActivity = betaZodTool({
    name: "get_email_activity",
    description: "Get Instantly campaign activity for a date range: leads added to a campaign per day, and Instantly webhook events (replies, interested, meetings booked, bounces, unsubscribes and any others configured) per type and day.",
    inputSchema: z.object({ startDate: isoDate, endDate: isoDate }),
    run: async (args) => JSON.stringify(await getEmailActivity(args.startDate, args.endDate)),
  });

  const client = new Anthropic();
  try {
    const message = await client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      max_iterations: 10,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM_PROMPT,
      tools: [gaReport, emailActivity],
      messages: [
        ...input.history.map((turn) => ({ role: turn.role, content: turn.text })),
        { role: "user", content: `Today is ${input.today} (America/New_York).\n\n${input.question}` },
      ],
    });
    const answer = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (message.stop_reason === "refusal" || !answer) {
      throw new CampaignAskError("Claude did not return an answer. Try rephrasing the question.");
    }
    return answer;
  } catch (error) {
    if (error instanceof CampaignAskError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new CampaignAskError("The ANTHROPIC_API_KEY on the server was rejected.");
    if (error instanceof Anthropic.RateLimitError) throw new CampaignAskError("Claude is rate limited right now. Try again in a minute.");
    if (error instanceof Anthropic.APIError) throw new CampaignAskError(`Claude API error ${error.status ?? ""}: ${error.message}`.trim());
    throw error;
  }
}
