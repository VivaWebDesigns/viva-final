import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  crmLeads,
  crmContacts,
  crmLeadStatuses,
  crmLeadNotes,
  crmCompanies,
  pipelineOpportunities,
  pipelineStages,
  user,
} from "@shared/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { scoreHispanicName } from "./nameScore";
import * as crmStorage from "../crm/storage";
import * as pipelineStorage from "../pipeline/storage";
import { logAudit } from "../audit/service";
import { executeStageAutomations } from "../automations/trigger";

const router = Router();

function normalizeSellerUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

const US_STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago",    AK: "America/Anchorage",  AZ: "America/Phoenix",
  AR: "America/Chicago",    CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York",   DE: "America/New_York",   FL: "America/New_York",
  GA: "America/New_York",   HI: "Pacific/Honolulu",   ID: "America/Denver",
  IL: "America/Chicago",    IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago",    KY: "America/New_York",   LA: "America/Chicago",
  ME: "America/New_York",   MD: "America/New_York",   MA: "America/New_York",
  MI: "America/New_York",   MN: "America/Chicago",    MS: "America/Chicago",
  MO: "America/Chicago",    MT: "America/Denver",     NE: "America/Chicago",
  NV: "America/Los_Angeles",NH: "America/New_York",   NJ: "America/New_York",
  NM: "America/Denver",     NY: "America/New_York",   NC: "America/New_York",
  ND: "America/Chicago",    OH: "America/New_York",   OK: "America/Chicago",
  OR: "America/Los_Angeles",PA: "America/New_York",   RI: "America/New_York",
  SC: "America/New_York",   SD: "America/Chicago",    TN: "America/Chicago",
  TX: "America/Chicago",    UT: "America/Denver",     VT: "America/New_York",
  VA: "America/New_York",   WA: "America/Los_Angeles",WV: "America/New_York",
  WI: "America/Chicago",    WY: "America/Denver",
};

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

router.post(
  "/precheck",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({
      sellerName: z.string().min(2),
      sellerProfileUrl: z.string().url(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);
    const score = scoreHispanicName(parsed.data.sellerName);
    const { normalizedName, firstName, lastName, hispanicNameScore, spanishOutreachRecommended } = score;

    if (hispanicNameScore < 70) {
      return res.json({
        shouldContinue: false,
        reason: "name_score_below_threshold",
        normalizedName,
        firstName,
        lastName,
        hispanicNameScore,
        spanishOutreachRecommended,
        sellerExistsInCrm: false,
      });
    }

    const [row] = await db
      .select({
        leadId: crmLeads.id,
        leadFirstName: crmContacts.firstName,
        leadLastName: crmContacts.lastName,
      })
      .from(crmLeads)
      .innerJoin(crmContacts, eq(crmLeads.contactId, crmContacts.id))
      .where(
        sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedUrl}`
      )
      .orderBy(desc(crmLeads.createdAt))
      .limit(1);

    if (row) {
      const existingLeadName =
        [row.leadFirstName, row.leadLastName].filter(Boolean).join(" ") || null;
      return res.json({
        shouldContinue: false,
        reason: "seller_already_in_crm",
        normalizedName,
        firstName,
        lastName,
        hispanicNameScore,
        spanishOutreachRecommended,
        sellerExistsInCrm: true,
        existingLeadId: row.leadId,
        existingLeadName,
      });
    }

    return res.json({
      shouldContinue: true,
      reason: "passed",
      normalizedName,
      firstName,
      lastName,
      hispanicNameScore,
      spanishOutreachRecommended,
      sellerExistsInCrm: false,
    });
  }
);

router.post(
  "/create-outreach-lead",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({
      sellerName:                 z.string().min(1),
      sellerProfileUrl:           z.string().url(),
      adUrl:                      z.string().url(),
      trade:                      z.string().min(1),
      city:                       z.string().min(1),
      state:                      z.string().length(2),
      hispanicNameScore:          z.number().int().min(0).max(100),
      spanishOutreachRecommended: z.boolean(),
      firstOutreachMessage:       z.string().min(1),
      firstOutreachSentAt:        z.string().datetime(),
      phone:                      z.string().optional().nullable(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const normalizedSellerUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);
    const normalizedAdUrl = normalizeSellerUrl(parsed.data.adUrl);

    const [existing] = await db
      .select({ id: crmLeads.id })
      .from(crmLeads)
      .where(
        sql`lower(regexp_replace(trim(${crmLeads.sellerProfileUrl}), '/+$', '')) = ${normalizedSellerUrl}`
      )
      .limit(1);

    if (existing) {
      return res.status(409).json({
        message: "Seller already exists in CRM",
        existingLeadId: existing.id,
      });
    }

    const { firstName: rawFirstName, lastName: rawLastName } = scoreHispanicName(parsed.data.sellerName);
    const toTitleCase = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
    const firstName = toTitleCase(rawFirstName);
    const lastName = rawLastName ? toTitleCase(rawLastName) : null;
    const sellerNameNormalized = parsed.data.sellerName.trim();
    const stateCode = parsed.data.state.trim().toUpperCase();

    const defaultStatus = await crmStorage.getDefaultLeadStatus();

    const { lead, contact, company } = await db.transaction(async (tx) => {
      let [contact] = await tx
        .select()
        .from(crmContacts)
        .where(
          lastName
            ? and(
                ilike(crmContacts.firstName, firstName),
                ilike(crmContacts.lastName, lastName)
              )
            : and(
                ilike(crmContacts.firstName, firstName),
                sql`${crmContacts.lastName} is null`
              )
        )
        .limit(1);

      if (!contact) {
        [contact] = await tx
          .insert(crmContacts)
          .values({
            firstName,
            lastName,
            phone: parsed.data.phone || null,
            preferredLanguage: "es",
          })
          .returning();
      } else if (!contact.phone && parsed.data.phone) {
        await tx
          .update(crmContacts)
          .set({ phone: parsed.data.phone })
          .where(eq(crmContacts.id, contact.id));
        contact = { ...contact, phone: parsed.data.phone };
      }

      let [company] = await tx
        .select()
        .from(crmCompanies)
        .where(
          and(
            ilike(crmCompanies.name, sellerNameNormalized),
            eq(crmCompanies.state, stateCode)
          )
        )
        .limit(1);

      if (!company) {
        [company] = await tx
          .insert(crmCompanies)
          .values({
            name: sellerNameNormalized,
            industry: parsed.data.trade,
            city: parsed.data.city,
            state: stateCode,
          })
          .returning();
      }

      if (!contact.companyId) {
        await tx
          .update(crmContacts)
          .set({ companyId: company.id })
          .where(eq(crmContacts.id, contact.id));
        contact = { ...contact, companyId: company.id };
      }

      const [lead] = await tx
        .insert(crmLeads)
        .values({
          title:                      sellerNameNormalized,
          companyId:                  company.id,
          contactId:                  contact.id,
          statusId:                   defaultStatus?.id ?? null,
          source:                     "outreach",
          sourceLabel:                "Outreach",
          city:                       parsed.data.city,
          state:                      stateCode,
          timezone:                   US_STATE_TIMEZONES[stateCode] ?? null,
          sellerProfileUrl:           normalizedSellerUrl,
          adUrl:                      normalizedAdUrl,
          hispanicNameScore:          parsed.data.hispanicNameScore,
          spanishOutreachRecommended: parsed.data.spanishOutreachRecommended,
          firstOutreachSentAt:        new Date(parsed.data.firstOutreachSentAt),
          fromWebsiteForm:            false,
          assignedTo:                 req.authUser!.id,
        })
        .returning();

      await tx.insert(crmLeadNotes).values({
        leadId:   lead.id,
        userId:   req.authUser!.id,
        type:     "system",
        content:  parsed.data.firstOutreachMessage,
        metadata: { noteType: "system", source: "marketplace", createdBy: req.authUser!.id },
      });

      return { lead, contact, company };
    });

    const newLeadStage = await pipelineStorage.getStageBySlug("new-lead");
    if (newLeadStage) {
      const opp = await pipelineStorage.createOpportunity({
        title:           lead.title,
        leadId:          lead.id,
        companyId:       company.id,
        contactId:       contact.id,
        stageId:         newLeadStage.id,
        status:          "open",
        sourceLeadTitle: lead.title,
        assignedTo:      req.authUser!.id,
      });
      try {
        await executeStageAutomations({
          opportunityId: opp.id,
          leadId:        lead.id,
          contactId:     contact.id,
          companyId:     company.id,
          assignedTo:    req.authUser!.id,
          stageSlug:     "new-lead",
          actorId:       req.authUser!.id,
        });
      } catch (err: unknown) {
        console.error("[marketplace/create-outreach-lead] executeStageAutomations failed:", err);
      }
    }

    await logAudit({
      userId:    req.authUser?.id,
      action:    "create",
      entity:    "crm_lead",
      entityId:  lead.id,
      metadata:  { title: lead.title, source: "marketplace-bot" },
      ipAddress: req.ip,
    });

    return res.status(201).json({ leadId: lead.id, lead });
  }
);

export default router;
