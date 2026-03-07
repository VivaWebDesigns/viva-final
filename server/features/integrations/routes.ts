import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as intStorage from "./storage";
import { checkAllProviders } from "./health";

const router = Router();

router.get("/", requireRole("admin", "developer"), async (_req, res) => {
  const integrations = await intStorage.getIntegrations();
  res.json(integrations);
});

router.get("/health", requireRole("admin", "developer"), async (_req, res) => {
  const health = checkAllProviders();
  res.json(health);
});

router.get("/:provider", requireRole("admin", "developer"), async (req, res) => {
  const integration = await intStorage.getIntegrationByProvider(req.params.provider);
  if (!integration) return res.status(404).json({ message: "Integration not found" });
  res.json(integration);
});

router.put("/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    const integration = await intStorage.updateIntegration(req.params.id, req.body);
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
  const integration = await intStorage.getIntegrationByProvider(req.params.provider);
  if (!integration) return res.status(404).json({ message: "Integration not found" });

  const health = checkAllProviders();
  const providerHealth = health[req.params.provider];

  if (!providerHealth) {
    return res.status(404).json({ message: "Unknown provider" });
  }

  let testResult: { success: boolean; message: string; details?: string } = {
    success: false,
    message: "Test not available",
  };

  if (!providerHealth.configured) {
    testResult = {
      success: false,
      message: "Provider is not configured",
      details: `Missing environment variables: ${providerHealth.missingVars.join(", ")}`,
    };
  } else {
    switch (req.params.provider) {
      case "mailgun": {
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
        break;
      }

      case "stripe": {
        try {
          const response = await fetch("https://api.stripe.com/v1/balance", {
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            },
          });
          if (response.ok) {
            testResult = { success: true, message: "Stripe API key is valid" };
          } else {
            const data = await response.json() as any;
            testResult = {
              success: false,
              message: "Stripe API returned an error",
              details: data.error?.message || `Status: ${response.status}`,
            };
          }
        } catch (err: any) {
          testResult = { success: false, message: "Stripe connectivity failed", details: err.message };
        }
        break;
      }

      case "openai": {
        try {
          const response = await fetch("https://api.openai.com/v1/models", {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
          });
          if (response.ok) {
            testResult = { success: true, message: "OpenAI API key is valid" };
          } else {
            const data = await response.json() as any;
            testResult = {
              success: false,
              message: "OpenAI API returned an error",
              details: data.error?.message || `Status: ${response.status}`,
            };
          }
        } catch (err: any) {
          testResult = { success: false, message: "OpenAI connectivity failed", details: err.message };
        }
        break;
      }

      case "cloudflare-r2": {
        testResult = {
          success: true,
          message: "R2 environment variables are configured",
          details: "R2 connectivity will be verified when file upload features are implemented.",
        };
        break;
      }

      default:
        testResult = { success: false, message: "No test available for this provider" };
    }
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
    metadata: { provider: req.params.provider, result: testResult.success ? "pass" : "fail" },
    ipAddress: req.ip,
  });

  res.json(testResult);
});

export default router;
