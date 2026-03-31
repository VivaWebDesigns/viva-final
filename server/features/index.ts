import { Router } from "express";
import { default as userRoutes } from "./auth/routes";
import { adminRoutes } from "./admin";
import { docsRoutes } from "./docs";
import { integrationsRoutes } from "./integrations";
import { crmRoutes } from "./crm";
import { pipelineRoutes } from "./pipeline";
import { onboardingRoutes } from "./onboarding";
import { notificationRoutes } from "./notifications";
import { reportRoutes } from "./reports";
import { requireRole } from "./auth/middleware";
import chatRoutes from "./chat/routes";
import clientsRoutes from "./clients/routes";
import taskRoutes from "./tasks/routes";
import historyRoutes from "./history/routes";
import workflowRoutes from "./workflow/routes";
import billingRoutes from "./billing/routes";
import attachmentRoutes from "./attachments/routes";
import demoConfigRoutes from "./demo/routes";
import profileRoutes from "./profiles/routes";
import { automationRoutes } from "./automations";
import quoRoutes from "./quo/routes";
import { seedDocs } from "./docs/seed";
import { seedIntegrations } from "./integrations/seed";
import { seedCrmStatuses } from "./crm/seed";
import { seedPipelineStages } from "./pipeline/seed";
import { seedOnboardingTemplates } from "./onboarding/seed";

const router = Router();

router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/docs", docsRoutes);
router.use("/integrations", integrationsRoutes);
router.use("/crm", crmRoutes);
router.use("/pipeline", pipelineRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reports", reportRoutes);
router.use("/chat", chatRoutes);
router.use("/clients", clientsRoutes);
router.use("/tasks", taskRoutes);
router.use("/history", historyRoutes);
router.use("/workflow", workflowRoutes);
router.use("/billing", billingRoutes);
router.use("/attachments", attachmentRoutes);
router.use("/demo-configs", demoConfigRoutes);
router.use("/profiles", profileRoutes);
router.use("/automations", automationRoutes);
router.use("/quo", quoRoutes);

router.post("/admin/seed", requireRole("admin"), async (_req, res) => {
  try {
    const docs = await seedDocs();
    const integrations = await seedIntegrations();
    const crm = await seedCrmStatuses();
    const pipeline = await seedPipelineStages();
    const onboarding = await seedOnboardingTemplates();
    res.json({ message: "Seed complete", docs, integrations, crm, pipeline, onboarding });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});


export default router;
