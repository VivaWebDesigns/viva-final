import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { getOverdueSummary } from "./overdue";

const router = Router();

router.get("/overdue-summary", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const summary = await getOverdueSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
