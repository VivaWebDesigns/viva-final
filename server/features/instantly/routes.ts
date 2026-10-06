import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import {
  listInstantlyRedrawQueue,
  prepareInstantlyEnrollment,
  previewInstantlyEnrollment,
  pushReadyEnrollmentsToInstantly,
  retryInstantlyImageSyncs,
  summarizeInstantlyEnrollments,
} from "./enrollment";
import { instantlyConfig, parseInstantlyCampaignId } from "./client";
import { handleInstantlyWebhook, isValidInstantlyWebhookSecret } from "./webhook";

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://vivawebdesigns.com").replace(/\/$/, "");

const pushSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500),
  campaign: z.string().trim().min(1),
});

const router = Router();

// Read-only: who would be staged and why others are left out.
router.get("/enrollment/preview", requireRole("admin"), async (_req, res) => {
  try {
    res.json(await previewInstantlyEnrollment());
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Read-only: the reports whose snapshots the bulk redraw page regenerates.
router.get("/enrollment/redraw-queue", requireRole("admin"), async (_req, res) => {
  try {
    res.json(await listInstantlyRedrawQueue());
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Publishes images and stages leads as "ready". Does not contact Instantly.
router.post("/enrollment/prepare", requireRole("admin"), async (req, res) => {
  try {
    const result = await prepareInstantlyEnrollment();
    await logAudit({
      userId: req.authUser!.id,
      action: "instantly_enrollment_prepared",
      entity: "instantly_enrollment",
      entityId: "batch",
      metadata: { prepared: result.prepared, failed: result.failed.length, excluded: result.excludedCount },
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Setup state for the admin page; never returns secret values.
router.get("/status", requireRole("admin"), async (_req, res) => {
  try {
    const config = instantlyConfig();
    res.json({
      apiKeySet: !!config.apiKey,
      defaultCampaignId: config.campaignId,
      webhookUrl: `${PUBLIC_SITE_URL}/api/instantly/webhook`,
      webhookSecretSet: !!config.webhookSecret,
      imageDomainSet: !!process.env.COLD_EMAIL_IMAGE_PUBLIC_URL?.trim(),
      ...(await summarizeInstantlyEnrollments()),
    });
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Sends a small batch of "ready" leads to one Instantly campaign. This is the step that starts outreach.
router.post("/enrollment/push", requireRole("admin"), async (req, res) => {
  try {
    const parsed = pushSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Choose how many leads (1–500) and a campaign." });
    const campaignId = parseInstantlyCampaignId(parsed.data.campaign);
    if (!campaignId) return res.status(400).json({ message: "Paste the campaign link or ID from Instantly." });
    const result = await pushReadyEnrollmentsToInstantly({ campaignId, limit: parsed.data.limit });
    await logAudit({
      userId: req.authUser!.id,
      action: "instantly_enrollment_pushed",
      entity: "instantly_enrollment",
      entityId: campaignId,
      metadata: { campaignId, limit: parsed.data.limit, enrolled: result.enrolled, skipped: result.skipped.length },
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

router.post("/enrollment/retry-image-sync", requireRole("admin"), async (_req, res) => {
  try {
    res.json(await retryInstantlyImageSyncs());
  } catch (error: any) {
    res.status(error?.statusCode ?? 500).json({ message: error.message });
  }
});

// Public: Instantly calls this. Authenticated by the shared secret header set when registering.
router.post("/webhook", async (req, res) => {
  if (!isValidInstantlyWebhookSecret(req.get("x-viva-webhook-secret"), instantlyConfig().webhookSecret)) {
    return res.status(401).json({ message: "Invalid webhook secret" });
  }
  try {
    res.json(await handleInstantlyWebhook(req.body ?? {}));
  } catch (error: any) {
    console.error("[instantly] webhook failed", error);
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

export default router;
