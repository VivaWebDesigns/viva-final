import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as intStorage from "./storage";

const router = Router();

router.get("/", requireRole("admin", "developer"), async (_req, res) => {
  const integrations = await intStorage.getIntegrations();
  res.json(integrations);
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

export default router;
