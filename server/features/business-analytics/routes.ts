import { Router } from "express";
import { lt } from "drizzle-orm";
import { z } from "zod";
import { googleOAuthStates } from "@shared/schema";
import { db } from "../../db";
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

const router = Router();
const providerSchema = z.enum(GOOGLE_PROVIDERS);
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || "543529736";
const analyticsCache = new Map<string, { expiresAt: number; data: unknown }>();

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
  const days = z.coerce.number().int().min(7).max(365).catch(30).parse(req.query.days);
  const connection = await storage.getGoogleConnection("analytics");
  if (!connection) return res.status(409).json({ message: "Connect Google Analytics first" });
  const cacheKey = `${connection.updatedAt.toISOString()}:${days}`;
  const cached = analyticsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.data);
  try {
    const data = await getGoogleAnalyticsDashboard(connection, days);
    analyticsCache.clear();
    analyticsCache.set(cacheKey, { data, expiresAt: Date.now() + 5 * 60 * 1000 });
    await storage.updateGoogleConnection("analytics", { status: "connected", lastError: null });
    res.json(data);
  } catch (error) {
    const message = googleErrorMessage(error);
    await storage.updateGoogleConnection("analytics", { status: "error", lastError: message });
    res.status(502).json({ message });
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
