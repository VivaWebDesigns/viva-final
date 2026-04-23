import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../../db";
import { demoConfigs, crmLeads, user } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.use(requireAuth, (req, res, next) => {
  if (req.authUser?.role === "extension_worker") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
});

const createDemoConfigSchema = z.object({
  leadId: z.string().optional().nullable(),
  businessName: z.string().min(1),
  trade: z.string().min(1),
  tier: z.string().default("domina"),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  previewUrl: z.string().url(),
  settings: z.string().optional().nullable(),
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const data = createDemoConfigSchema.parse(req.body);
    const [config] = await db.insert(demoConfigs).values({
      ...data,
      createdByUserId: req.authUser?.id ?? null,
    }).returning();
    res.status(201).json(config);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { leadId } = req.query;
    const rows = leadId
      ? await db.select().from(demoConfigs).where(eq(demoConfigs.leadId, leadId as string)).orderBy(desc(demoConfigs.createdAt))
      : await db.select().from(demoConfigs).orderBy(desc(demoConfigs.createdAt)).limit(50);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(demoConfigs).where(eq(demoConfigs.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
