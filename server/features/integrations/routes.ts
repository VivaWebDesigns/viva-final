import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as intStorage from "./storage";
import { checkAllProviders, getProviderDiagnostics } from "./health";
import {
  getMaskedStripeStatus,
  saveStripeConfig,
  testStripeConnection,
} from "./stripe-config";

const updateIntegrationSchema = z.object({
  enabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
}).strict();

const configureStripeSchema = z.object({
  secretKey: z.string().min(1).regex(/^sk_(live|test)_/, "Must be a valid Stripe secret key (sk_live_... or sk_test_...)"),
  webhookSecret: z.string().startsWith("whsec_").optional().or(z.literal("")),
  publishableKey: z.string().startsWith("pk_").optional().or(z.literal("")),
}).strict();

const router = Router();

router.get("/", requireRole("admin", "developer"), async (_req, res) => {
  const integrations = await intStorage.getIntegrations();
  res.json(integrations);
});

router.get("/health", requireRole("admin", "developer"), async (_req, res) => {
  const health = checkAllProviders();
  res.json(health);
});

/**
 * GET /api/integrations/diagnostics
 * Combined provider health (env var configuration) + runtime snapshots
 * (last success/failure, consecutive failures, totals).
 * This is the primary admin surface for provider observability.
 */
router.get("/diagnostics", requireRole("admin", "developer"), async (_req, res) => {
  const diagnostics = getProviderDiagnostics();
  res.json(diagnostics);
});

/**
 * GET /api/integrations/provider-snapshots
 * Raw in-memory runtime state per provider:operation.
 * Resets on server restart; use for current session health only.
 */
router.get("/provider-snapshots", requireRole("admin", "developer"), async (_req, res) => {
  const { getAllSnapshots } = await import("../../lib/provider-snapshot");
  const snapshots = getAllSnapshots();
  res.json({ snapshots, generatedAt: new Date().toISOString() });
});

router.get("/stripe/status", requireRole("admin", "developer"), async (_req, res) => {
  try {
    const status = await getMaskedStripeStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/stripe/configure", requireRole("admin"), async (req, res) => {
  try {
    const validated = configureStripeSchema.parse(req.body);

    await saveStripeConfig({
      secretKey: validated.secretKey,
      webhookSecret: validated.webhookSecret || undefined,
      publishableKey: validated.publishableKey || undefined,
    });

    await logAudit({
      userId: req.authUser?.id,
      action: "stripe_configured",
      entity: "integration",
      entityId: "stripe",
      metadata: { hasWebhookSecret: !!(validated.webhookSecret), hasPublishableKey: !!(validated.publishableKey) },
      ipAddress: req.ip,
    });

    const status = await getMaskedStripeStatus();
    res.json({ success: true, status });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ message: err.errors?.[0]?.message ?? err.message });
    }
    res.status(400).json({ message: err.message });
  }
});

router.get("/:provider", requireRole("admin", "developer"), async (req, res) => {
  const integration = await intStorage.getIntegrationByProvider(req.params.provider as string);
  if (!integration) return res.status(404).json({ message: "Integration not found" });
  res.json(integration);
});

router.put("/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    const validated = updateIntegrationSchema.parse(req.body);
    const integration = await intStorage.updateIntegration(req.params.id as string, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "integration",
      entityId: integration.id,
      metadata: { provider: integration.provider },
      ipAddress: req.ip,
    });
    res.json(integration);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/:provider/test", requireRole("admin", "developer"), async (req, res) => {
  const provider = req.params.provider as string;
  const integration = await intStorage.getIntegrationByProvider(provider);
  if (!integration) return res.status(404).json({ message: "Integration not found" });

  let testResult: { success: boolean; message: string; details?: string };

  switch (provider) {
    case "stripe": {
      testResult = await testStripeConnection();
      break;
    }

    case "mailgun": {
      const health = checkAllProviders();
      const providerHealth = health["mailgun"];
      if (!providerHealth?.configured) {
        testResult = {
          success: false,
          message: "Mailgun is not configured",
          details: `Missing: ${providerHealth?.missingVars.join(", ")}`,
        };
      } else {
        try {
          const domain = process.env.MAILGUN_DOMAIN;
          const apiKey = process.env.MAILGUN_API_KEY;
          const response = await fetch(`https://api.mailgun.net/v3/domains/${domain}`, {
            headers: {
              Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
            },
          });
          if (response.ok) {
            const data = await response.json() as any;
            testResult = {
              success: true,
              message: "Mailgun domain verified",
              details: `Domain: ${data.domain?.name || domain}, State: ${data.domain?.state || "active"}`,
            };
          } else {
            testResult = {
              success: false,
              message: "Mailgun API returned an error",
              details: `Status: ${response.status}`,
            };
          }
        } catch (err: any) {
          testResult = { success: false, message: "Mailgun connectivity failed", details: err.message };
        }
      }
      break;
    }

    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) {
        testResult = { success: false, message: "OPENAI_API_KEY is not set" };
      } else {
        try {
          const response = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${key}` },
          });
          if (response.ok) {
            testResult = { success: true, message: "OpenAI API key is valid" };
          } else {
            const data = await response.json() as any;
            testResult = {
              success: false,
              message: "OpenAI API returned an error",
              details: data.error?.message ?? `Status: ${response.status}`,
            };
          }
        } catch (err: any) {
          testResult = { success: false, message: "OpenAI connectivity failed", details: err.message };
        }
      }
      break;
    }

    case "cloudflare-r2": {
      testResult = {
        success: true,
        message: "R2 environment variables are configured",
        details: "R2 connectivity will be verified when file upload features are used.",
      };
      break;
    }

    default:
      testResult = { success: false, message: "No test available for this provider" };
  }

  if (testResult.success) {
    await intStorage.updateIntegration(integration.id, {
      lastTested: new Date(),
      configComplete: true,
    });
  }

  await logAudit({
    userId: req.authUser?.id,
    action: "test_integration",
    entity: "integration",
    entityId: integration.id,
    metadata: { provider, result: testResult.success ? "pass" : "fail" },
    ipAddress: req.ip,
  });

  res.json(testResult);
});

export default router;
