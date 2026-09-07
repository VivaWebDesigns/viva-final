import { Router, type Request } from "express";
import { createHmac, randomBytes } from "node:crypto";
import { lt } from "drizzle-orm";
import { z } from "zod";
import { fromNodeHeaders } from "better-auth/node";
import { googleOAuthStates } from "@shared/schema";
import { db } from "../../db";
import { auth } from "../auth/auth";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import {
  createGoogleOAuthClient,
  createOAuthState,
  decryptGoogleToken,
  encryptGoogleToken,
  GOOGLE_PROVIDERS,
  googleAuthorizationUrl,
  googleBusinessProfileEnabled,
  googleIntegrationConfigStatus,
  hashOAuthState,
} from "./googleAuth";
import {
  discoverGoogleBusinessLocations,
  fetchGoogleBusinessReviews,
  getGoogleAnalyticsDashboard,
} from "./googleApi";
import * as storage from "./storage";
import {
  getWebsiteActivityDashboard,
  recordWebsiteActivity,
  websiteActivityBatchSchema,
} from "./websiteActivity";

const router = Router();
const providerSchema = z.enum(GOOGLE_PROVIDERS);
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "543529736";
const analyticsCache = new Map<string, { expiresAt: number; data: unknown }>();
const activityRateLimits = new Map<string, { count: number; resetAt: number }>();
const activityRateSalt = randomBytes(32);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function sameSiteActivityRequest(req: Request) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const hostname = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "vivawebdesigns.com" || hostname === req.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
}

function withinActivityRateLimit(key: string, limit: number) {
  const now = Date.now();
  const current = activityRateLimits.get(key);
  if (!current || current.resetAt <= now) {
    activityRateLimits.set(key, { count: 1, resetAt: now + 10 * 60 * 1_000 });
    if (activityRateLimits.size > 5_000) {
      for (const [key, value] of activityRateLimits) if (value.resetAt <= now) activityRateLimits.delete(key);
    }
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function ephemeralNetworkRateKey(req: Request) {
  const forwarded = req.get("cf-connecting-ip") || req.ip || "unknown";
  return `network:${createHmac("sha256", activityRateSalt).update(forwarded).digest("hex")}`;
}

async function isAuthenticatedInternalBrowser(req: Request) {
  if (!req.headers.cookie || !req.headers.cookie.includes("better-auth.session_token")) return false;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    return session?.user?.role === "admin" || session?.user?.role === "developer";
  } catch {
    return false;
  }
}

function easternDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function googleAnalyticsDateRange(query: Record<string, unknown>) {
  if (query.startDate !== undefined || query.endDate !== undefined) {
    const parsed = z.object({
      startDate: isoDateSchema,
      endDate: isoDateSchema,
    }).safeParse(query);
    if (!parsed.success) {
      throw Object.assign(new Error("Choose a valid start and end date."), { statusCode: 400 });
    }
    const { startDate, endDate } = parsed.data;
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (!Number.isFinite(days) || days < 1 || days > 1_825) {
      throw Object.assign(new Error("Choose a date range between 1 and 1,825 days."), { statusCode: 400 });
    }
    return { startDate, endDate, days, label: `${startDate} to ${endDate}` };
  }
  const days = z.coerce.number().int().min(1).max(365).catch(30).parse(query.days);
  return {
    startDate: easternDate(-(days - 1)),
    endDate: easternDate(),
    days,
    label: days === 1 ? "Today" : `Last ${days} days`,
  };
}

function googleErrorMessage(error: any): string {
  return error?.response?.data?.error?.message
    || error?.response?.data?.error_description
    || error?.message
    || "Google API request failed";
}

function publicConnection(connection: Awaited<ReturnType<typeof storage.getGoogleConnection>> | null) {
  if (!connection) return null;
  return {
    provider: connection.provider,
    connected: true,
    accountEmail: connection.accountEmail,
    externalAccountId: connection.externalAccountId,
    propertyId: connection.propertyId,
    locationId: connection.locationId,
    locationTitle: connection.locationTitle,
    status: connection.status,
    lastSyncedAt: connection.lastSyncedAt,
    lastError: connection.lastError,
    updatedAt: connection.updatedAt,
  };
}

async function syncBusinessReviews() {
  const connection = await storage.getGoogleConnection("business_profile");
  if (!connection) throw new Error("Google Business Profile is not connected");
  if (!connection.externalAccountId || !connection.locationId) {
    throw new Error("Choose a Google Business Profile location first");
  }
  try {
    const reviews = await fetchGoogleBusinessReviews(
      connection,
      connection.externalAccountId,
      connection.locationId,
    );
    await storage.upsertGoogleReviews(connection.id, reviews);
    await storage.updateGoogleConnection("business_profile", {
      status: "connected",
      lastSyncedAt: new Date(),
      lastError: null,
    });
    return reviews.length;
  } catch (error) {
    const message = googleErrorMessage(error);
    await storage.updateGoogleConnection("business_profile", {
      status: /permission|access|quota|403/i.test(message) ? "approval_required" : "error",
      lastError: message,
    });
    throw new Error(message);
  }
}

router.post("/website-activity/collect", async (req, res) => {
  try {
    if (!sameSiteActivityRequest(req)) return res.status(403).json({ message: "Forbidden origin" });
    const input = websiteActivityBatchSchema.parse(req.body);
    if (input.events.some((event) => event.path.split("?")[0]?.startsWith("/admin"))) {
      return res.status(204).end();
    }
    if (!withinActivityRateLimit(`session:${input.sessionId}`, 60) || !withinActivityRateLimit(ephemeralNetworkRateKey(req), 300)) {
      return res.status(429).json({ message: "Too many activity updates" });
    }
    const result = await recordWebsiteActivity(input, {
      headers: req.headers,
      userAgent: req.get("user-agent"),
      isInternal: await isAuthenticatedInternalBrowser(req),
    });
    res.setHeader("Cache-Control", "no-store");
    res.status(202).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid activity update" });
    res.status(500).json({ message: "Activity could not be recorded" });
  }
});

router.get("/website-activity", requireRole("admin", "developer"), async (req, res) => {
  try {
    const dateRange = googleAnalyticsDateRange(req.query);
    res.setHeader("Cache-Control", "no-store");
    res.json(await getWebsiteActivityDashboard(dateRange.startDate, dateRange.endDate));
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode === 400 ? 400 : 500;
    res.status(status).json({ message: status === 400 ? (error as Error).message : "Website activity could not be loaded" });
  }
});

router.get("/status", requireRole("admin", "developer"), async (_req, res) => {
  const businessProfileEnabled = googleBusinessProfileEnabled();
  const [analytics, businessProfile] = await Promise.all([
    storage.getGoogleConnection("analytics"),
    businessProfileEnabled ? storage.getGoogleConnection("business_profile") : Promise.resolve(null),
  ]);
  res.json({
    config: googleIntegrationConfigStatus(),
    analytics: publicConnection(analytics),
    businessProfile: publicConnection(businessProfile),
  });
});

router.get("/oauth/start/:provider", requireRole("admin"), async (req, res) => {
  try {
    const provider = providerSchema.parse(req.params.provider);
    if (provider === "business_profile" && !googleBusinessProfileEnabled()) {
      return res.status(404).json({ message: "Google Business Profile integration is disabled" });
    }
    const state = createOAuthState();
    await db.delete(googleOAuthStates).where(lt(googleOAuthStates.expiresAt, new Date()));
    await storage.createGoogleOAuthState({
      stateHash: hashOAuthState(state),
      provider,
      userId: req.authUser!.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    res.json({ url: googleAuthorizationUrl(provider, state) });
  } catch (error) {
    res.status(400).json({ message: googleErrorMessage(error) });
  }
});

router.get("/oauth/callback", requireRole("admin"), async (req, res) => {
  const fallback = "/admin/analytics";
  try {
    if (typeof req.query.error === "string") throw new Error(req.query.error);
    const code = z.string().min(1).parse(req.query.code);
    const state = z.string().min(1).parse(req.query.state);
    const savedState = await storage.consumeGoogleOAuthState(hashOAuthState(state));
    if (!savedState || savedState.userId !== req.authUser!.id) {
      throw new Error("Google authorization expired or could not be verified");
    }
    const provider = providerSchema.parse(savedState.provider);
    if (provider === "business_profile" && !googleBusinessProfileEnabled()) {
      throw new Error("Google Business Profile integration is disabled");
    }
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code);
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const existing = await storage.getGoogleConnection(provider);
      if (existing) refreshToken = decryptGoogleToken(existing.encryptedRefreshToken);
    }
    if (!refreshToken) throw new Error("Google did not return offline access. Reconnect and approve access again.");
    client.setCredentials(tokens);
    const userInfo = tokens.access_token
      ? await client.request<{ email?: string }>({ url: "https://openidconnect.googleapis.com/v1/userinfo" })
      : null;
    const connection = await storage.upsertGoogleConnection({
      provider,
      encryptedRefreshToken: encryptGoogleToken(refreshToken),
      scopes: tokens.scope || "",
      accountEmail: userInfo?.data.email || null,
      propertyId: provider === "analytics" ? GA4_PROPERTY_ID : null,
    });

    if (provider === "business_profile") {
      try {
        const locations = await discoverGoogleBusinessLocations(connection);
        const preferred = locations.find((location) =>
          /viva web designs/i.test(location.title)
          || /vivawebdesigns\.com/i.test(location.websiteUri || ""),
        ) || locations[0];
        if (preferred) {
          await storage.updateGoogleConnection(provider, {
            externalAccountId: preferred.accountId,
            locationId: preferred.locationId,
            locationTitle: preferred.title,
            status: "connected",
            lastError: null,
          });
        } else {
          await storage.updateGoogleConnection(provider, {
            status: "needs_location",
            lastError: "No Google Business Profile locations were found for this account",
          });
        }
      } catch (error) {
        await storage.updateGoogleConnection(provider, {
          status: "approval_required",
          lastError: googleErrorMessage(error),
        });
      }
    }

    analyticsCache.clear();
    await logAudit({
      userId: req.authUser!.id,
      action: "google_integration_connected",
      entity: "integration",
      entityId: provider,
      metadata: { provider, accountEmail: userInfo?.data.email || null },
      ipAddress: req.ip,
    });
    res.redirect(303, `${fallback}?google=${encodeURIComponent(provider)}&status=connected`);
  } catch (error) {
    res.redirect(303, `${fallback}?status=error&message=${encodeURIComponent(googleErrorMessage(error))}`);
  }
});

router.get("/ga4", requireRole("admin", "developer"), async (req, res) => {
  try {
    const dateRange = googleAnalyticsDateRange(req.query);
    const connection = await storage.getGoogleConnection("analytics");
    if (!connection) return res.status(409).json({ message: "Connect Google Analytics first" });
    const cacheKey = `${connection.updatedAt.toISOString()}:${dateRange.startDate}:${dateRange.endDate}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);
    const gaData = await getGoogleAnalyticsDashboard(connection, dateRange);
    const outreachTrend = await storage.getReportSendTrend(
      dateRange.startDate,
      dateRange.endDate,
      gaData.timeZone || "America/New_York",
    );
    const data = { ...gaData, outreachTrend };
    analyticsCache.clear();
    analyticsCache.set(cacheKey, { data, expiresAt: Date.now() + 5 * 60 * 1000 });
    await storage.updateGoogleConnection("analytics", { status: "connected", lastError: null });
    res.json(data);
  } catch (error) {
    const message = googleErrorMessage(error);
    if ((error as { statusCode?: number })?.statusCode === 400) return res.status(400).json({ message });
    await storage.updateGoogleConnection("analytics", { status: "error", lastError: message });
    res.status(502).json({ message });
  }
});

router.get("/report-outreach", requireRole("admin", "developer"), async (req, res) => {
  try {
    const days = z.coerce.number().int().min(7).max(365).catch(30).parse(req.query.days);
    res.json(await storage.getReportOutreachAnalytics(days));
  } catch (error) {
    res.status(500).json({ message: googleErrorMessage(error) });
  }
});

router.use("/business", (_req, res, next) => {
  if (!googleBusinessProfileEnabled()) {
    return res.status(404).json({ message: "Google Business Profile integration is disabled" });
  }
  next();
});

router.get("/business/locations", requireRole("admin", "developer"), async (_req, res) => {
  const connection = await storage.getGoogleConnection("business_profile");
  if (!connection) return res.status(409).json({ message: "Connect Google Business Profile first" });
  try {
    const locations = await discoverGoogleBusinessLocations(connection);
    res.json({ locations });
  } catch (error) {
    const message = googleErrorMessage(error);
    await storage.updateGoogleConnection("business_profile", {
      status: /permission|access|quota|403/i.test(message) ? "approval_required" : "error",
      lastError: message,
    });
    res.status(502).json({ message });
  }
});

router.post("/business/location", requireRole("admin"), async (req, res) => {
  try {
    const input = z.object({
      accountId: z.string().startsWith("accounts/"),
      locationId: z.string().startsWith("locations/"),
    }).parse(req.body);
    const connection = await storage.getGoogleConnection("business_profile");
    if (!connection) return res.status(409).json({ message: "Connect Google Business Profile first" });
    const locations = await discoverGoogleBusinessLocations(connection);
    const selected = locations.find((location) =>
      location.accountId === input.accountId && location.locationId === input.locationId,
    );
    if (!selected) return res.status(404).json({ message: "Google Business Profile location not found" });
    await storage.updateGoogleConnection("business_profile", {
      externalAccountId: selected.accountId,
      locationId: selected.locationId,
      locationTitle: selected.title,
      status: "connected",
      lastError: null,
    });
    const synced = await syncBusinessReviews();
    res.json({ selected, synced });
  } catch (error) {
    res.status(400).json({ message: googleErrorMessage(error) });
  }
});

router.post("/business/sync", requireRole("admin", "developer"), async (req, res) => {
  try {
    const synced = await syncBusinessReviews();
    await logAudit({
      userId: req.authUser!.id,
      action: "google_business_reviews_synced",
      entity: "integration",
      entityId: "business_profile",
      metadata: { synced },
      ipAddress: req.ip,
    });
    res.json({ synced, syncedAt: new Date().toISOString() });
  } catch (error) {
    res.status(502).json({ message: googleErrorMessage(error) });
  }
});

router.get("/business/reviews", requireRole("admin", "developer"), async (_req, res) => {
  const connection = await storage.getGoogleConnection("business_profile");
  if (!connection) return res.status(409).json({ message: "Connect Google Business Profile first" });
  if (!connection.locationId) return res.status(409).json({ message: "Choose a Google Business Profile location" });

  let syncError: string | null = null;
  if (!connection.lastSyncedAt || Date.now() - connection.lastSyncedAt.getTime() > 15 * 60 * 1000) {
    try {
      await syncBusinessReviews();
    } catch (error) {
      syncError = googleErrorMessage(error);
    }
  }

  const reviews = await storage.listStoredGoogleReviews(connection.locationId);
  const total = reviews.length;
  const averageRating = total > 0
    ? Math.round((reviews.reduce((sum, review) => sum + review.starRating, 0) / total) * 10) / 10
    : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => review.starRating === rating).length,
  }));
  res.json({
    location: { id: connection.locationId, title: connection.locationTitle },
    summary: {
      total,
      averageRating,
      unreplied: reviews.filter((review) => !review.replyComment).length,
      ratingDistribution,
    },
    reviews,
    lastSyncedAt: (await storage.getGoogleConnection("business_profile"))?.lastSyncedAt ?? connection.lastSyncedAt,
    syncError,
  });
});

export default router;
