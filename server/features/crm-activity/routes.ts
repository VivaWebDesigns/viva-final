import { Router } from "express";
import { z } from "zod";
import {
  CRM_ACTIVITY_ENTITY_TYPES,
  CRM_ACTIVITY_EVENT_TYPES,
  CRM_ACTIVITY_SURFACES,
} from "@shared/schema";
import { requireRole } from "../auth/middleware";
import * as activityService from "./service";

const router = Router();

const eventSchema = z.object({
  eventType: z.enum(CRM_ACTIVITY_EVENT_TYPES),
  surface: z.enum(CRM_ACTIVITY_SURFACES),
  entityType: z.enum(CRM_ACTIVITY_ENTITY_TYPES).nullable().optional(),
  entityId: z.string().min(1).nullable().optional(),
  path: z.string().min(1).max(500),
  activeMs: z.number().int().min(0).max(30 * 60 * 1000).optional(),
  metadata: z.unknown().optional(),
}).strict();

router.post("/events", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  try {
    const data = eventSchema.parse(req.body);
    const event = await activityService.createActivityEvent(req.authUser!.id, data);
    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/summary", requireRole("admin", "developer"), async (req, res) => {
  const days = parseInt(req.query.days as string, 10) || 7;
  const summary = await activityService.getActivitySummary(days);
  res.json(summary);
});

export default router;
