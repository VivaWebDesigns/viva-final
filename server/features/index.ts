import { Router } from "express";
import { default as userRoutes } from "./auth/routes";
import { adminRoutes } from "./admin";
import { docsRoutes } from "./docs";
import { integrationsRoutes } from "./integrations";
import { crmRoutes } from "./crm";
import { requireRole } from "./auth/middleware";
import { seedDocs } from "./docs/seed";
import { seedIntegrations } from "./integrations/seed";
import { seedCrmStatuses } from "./crm/seed";

const router = Router();

router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/docs", docsRoutes);
router.use("/integrations", integrationsRoutes);
router.use("/crm", crmRoutes);

router.post("/admin/seed", requireRole("admin"), async (_req, res) => {
  try {
    const docs = await seedDocs();
    const integrations = await seedIntegrations();
    const crm = await seedCrmStatuses();
    res.json({ message: "Seed complete", docs, integrations, crm });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});


export default router;
