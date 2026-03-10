import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { getHistory } from "./service";

const router = Router();

router.get("/:entityType/:entityId", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { entityType, entityId } = req.params as Record<string, string>;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const events = await getHistory(entityType, entityId, Math.min(limit, 200));
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
