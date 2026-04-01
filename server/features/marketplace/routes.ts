import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  crmLeads,
  crmContacts,
  crmLeadStatuses,
  pipelineOpportunities,
  pipelineStages,
  user,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { scoreHispanicName } from "./nameScore";

const router = Router();

function normalizeSellerUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

router.post(
  "/check-seller",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({ sellerProfileUrl: z.string().url() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);

    const [row] = await db
      .select({
        leadId: crmLeads.id,
        leadFirstName: crmContacts.firstName,
        leadLastName: crmContacts.lastName,
        assignedToUserId: user.id,
        assignedToName: user.name,
        stageName: pipelineStages.name,
        statusName: crmLeadStatuses.name,
      })
      .from(crmLeads)
      .innerJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
      .leftJoin(user, eq(crmLeads.assignedTo, user.id))
      .leftJoin(pipelineOpportunities, eq(pipelineOpportunities.leadId, crmLeads.id))
      .leftJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
      .leftJoin(crmLeadStatuses, eq(crmLeads.statusId, crmLeadStatuses.id))
      .where(
        and(
          sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedUrl}`,
          eq(crmLeads.source, "outreach")
        )
      )
      .orderBy(desc(crmLeads.createdAt))
      .limit(1);

    if (!row) {
      return res.json({
        exists: false,
        leadId: null,
        leadName: null,
        assignedTo: null,
        currentStage: null,
      });
    }

    const leadName =
      [row.leadFirstName, row.leadLastName].filter(Boolean).join(" ") || null;

    return res.json({
      exists: true,
      leadId: row.leadId,
      leadName,
      assignedTo: row.assignedToUserId
        ? { name: row.assignedToName, userId: row.assignedToUserId }
        : null,
      currentStage: row.stageName ?? row.statusName ?? null,
    });
  }
);

router.post(
  "/name-score",
  requireAuth,
  async (req, res) => {
    const schema = z.object({ sellerName: z.string().min(2) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const result = scoreHispanicName(parsed.data.sellerName);
    return res.json(result);
  }
);

export default router;
