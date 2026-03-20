import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { crmLeads, pipelineOpportunities, type Role } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireRole } from "../auth/middleware";
import {
  getProfileByCompanyId,
  getProfileByLeadId,
  getProfileByOpportunityId,
} from "./service";

const router = Router();

const idSchema = z.string().uuid("Invalid ID format");

function isRestricted(req: Request): boolean {
  const role = req.authUser?.role as Role | undefined;
  return role === "sales_rep" || role === "lead_gen";
}

function userId(req: Request): string {
  return req.authUser!.id;
}

function sendError(res: Response, err: unknown): Response {
  if (err instanceof Error) {
    if (err.message.includes("not found") || err.message.includes("Not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message.includes("Access denied")) {
      return res.status(403).json({ message: err.message });
    }
  }
  return res.status(500).json({ message: "Internal server error" });
}

// ── GET /api/profiles/company/:id ────────────────────────────────────────────

router.get(
  "/company/:id",
  requireRole("admin", "developer", "sales_rep", "lead_gen"),
  async (req: Request, res: Response) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const companyId = parsed.data;

    try {
      if (isRestricted(req)) {
        const [ownedLead] = await db
          .select({ id: crmLeads.id })
          .from(crmLeads)
          .where(and(eq(crmLeads.companyId, companyId), eq(crmLeads.assignedTo, userId(req))))
          .limit(1);
        if (!ownedLead) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const profile = await getProfileByCompanyId(companyId);
      return res.json(profile);
    } catch (err: unknown) {
      return sendError(res, err);
    }
  },
);

// ── GET /api/profiles/lead/:id ────────────────────────────────────────────────

router.get(
  "/lead/:id",
  requireRole("admin", "developer", "sales_rep", "lead_gen"),
  async (req: Request, res: Response) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const leadId = parsed.data;

    try {
      if (isRestricted(req)) {
        const [lead] = await db
          .select({ assignedTo: crmLeads.assignedTo })
          .from(crmLeads)
          .where(eq(crmLeads.id, leadId))
          .limit(1);
        if (!lead || lead.assignedTo !== userId(req)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const profile = await getProfileByLeadId(leadId);
      return res.json(profile);
    } catch (err: unknown) {
      return sendError(res, err);
    }
  },
);

// ── GET /api/profiles/opportunity/:id ─────────────────────────────────────────

router.get(
  "/opportunity/:id",
  requireRole("admin", "developer", "sales_rep", "lead_gen"),
  async (req: Request, res: Response) => {
    const parsed = idSchema.safeParse(req.params.id);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const opportunityId = parsed.data;

    try {
      if (isRestricted(req)) {
        const [opp] = await db
          .select({ assignedTo: pipelineOpportunities.assignedTo })
          .from(pipelineOpportunities)
          .where(eq(pipelineOpportunities.id, opportunityId))
          .limit(1);
        if (!opp || opp.assignedTo !== userId(req)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const profile = await getProfileByOpportunityId(opportunityId);
      return res.json(profile);
    } catch (err: unknown) {
      return sendError(res, err);
    }
  },
);

export default router;
