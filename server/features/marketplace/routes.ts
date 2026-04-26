import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth, requireAuthBearerFirst, requireRole, requireRoleBearerFirst } from "../auth/middleware";
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
  MARKETPLACE_PENDING_OUTREACH_STATUSES,
  hispanicNameAdditions,
} from "@shared/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { scoreHispanicName, addNameToRuntime, hasFirstName, hasSurname } from "./nameScore";
import {
  extractPhoneFromText,
  normalizePhone,
} from "./captureReplyHelpers";
import { normalizePhoneDigits } from "@shared/phone";
import * as crmStorage from "../crm/storage";
import * as pipelineStorage from "../pipeline/storage";
import * as marketplaceStorage from "./storage";
import { logAudit } from "../audit/service";
import { executeStageAutomations } from "../automations/trigger";

const router = Router();

function normalizeSellerUrl(url: string): string {
  try {
    const u = new URL(url.trim().toLowerCase());
    u.searchParams.delete("product_id");
    const pathname = u.pathname.replace(/\/+$/, "");
    const search = u.searchParams.size > 0 ? u.search : "";
    return u.origin + pathname + search;
  } catch {
    // Malformed URL fallback: strip ?product_id= from raw string
    return url.trim().toLowerCase().split("?product_id=")[0].replace(/\/+$/, "");
  }
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
  requireAuthBearerFirst,
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
  // DEV: Temporary bypass for Marketplace Assistant Chrome extension.
  // If MARKETPLACE_BOT_SECRET is set and the request carries
  // "Authorization: Bearer <secret>", skip normal session auth and mark as admin bot call.
  // Remove this bypass once the extension uses full token-based login.
  (req, res, next) => {
    const botSecret = process.env.MARKETPLACE_BOT_SECRET;
    if (botSecret) {
      const authHeader = req.headers.authorization ?? "";
      if (authHeader === `Bearer ${botSecret}`) {
        res.locals.isAdminBotCall = true;
        return next();
      }
    }
    res.locals.isAdminBotCall = false;
    return requireRoleBearerFirst("admin", "developer", "lead_gen")(req, res, next);
  },
  async (req, res) => {
    const schema = z.object({
      sellerName: z.string().min(2),
      sellerProfileUrl: z.string().url(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    // adminActionsAllowed: true for bot secret callers and for session-authenticated
    // admin, developer, or lead_gen users. Revert lead_gen here (and in botOrAdminRole
    // below) to restrict the add-name popup back to admin/developer only.
    const adminActionsAllowed: boolean =
      res.locals.isAdminBotCall === true ||
      ["admin", "developer", "lead_gen"].includes(req.authUser?.role ?? "");

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
        adminActionsAllowed,
      });
    }

    // ── Pending outreach duplicate check ─────────────────────────────────────
    // Fetch the single most recent pending outreach record for this seller (all
    // statuses). Block unless that record's status is "skipped" — skipped is the
    // only status that permits re-engagement. This ordering is intentional: if a
    // seller was previously converted and then skipped, the skip takes precedence.
    // Fires before the CRM check so the more informative "already in pipeline"
    // reason takes priority when both apply (e.g. after a CRM lead is deleted).
    const existingOutreach = await marketplaceStorage.findLatestPendingOutreachBySellerUrl(normalizedUrl);
    if (existingOutreach && existingOutreach.messageStatus !== "skipped") {
      return res.json({
        shouldContinue: false,
        reason: "seller_already_in_pending_outreach",
        normalizedName,
        firstName,
        lastName,
        hispanicNameScore,
        spanishOutreachRecommended,
        sellerExistsInCrm: false,
        existingOutreachId:     existingOutreach.id,
        existingOutreachStatus: existingOutreach.messageStatus,
        adminActionsAllowed,
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
        adminActionsAllowed,
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
      adminActionsAllowed,
    });
  }
);

// ─── Admin: Precheck override ──────────────────────────────────────────────
// Registered immediately after /precheck to avoid any route-ordering conflicts.
// Skips the name score fail gate but still enforces CRM duplicate detection.
// Intended for name_score_below_threshold failures only; backend does not
// re-validate the original failure reason — the extension is responsible.

router.post(
  "/precheck-override",
  botOrAdminRole,
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
        adminActionsAllowed: true,
      });
    }

    return res.json({
      shouldContinue: true,
      reason: "override_name_score",
      normalizedName,
      firstName,
      lastName,
      hispanicNameScore,
      spanishOutreachRecommended,
      sellerExistsInCrm: false,
      adminActionsAllowed: true,
    });
  }
);

// ─── Admin: Add names to scoring lists ────────────────────────────────────
// Persists new first names or surnames to the DB and updates runtime sets
// immediately so the change takes effect without a server restart.

router.post(
  "/admin/add-names",
  botOrAdminRole,
  async (req, res) => {
    const schema = z
      .object({
        firstName: z.string().optional(),
        lastName:  z.string().optional(),
      })
      .refine((d) => d.firstName || d.lastName, {
        message: "At least one of firstName or lastName is required",
      });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    function normalizeNameToken(raw: string): string {
      return raw
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z]/g, "");
    }

    const added:         { firstNames: string[]; surnames: string[] } = { firstNames: [], surnames: [] };
    const alreadyExisted: { firstNames: string[]; surnames: string[] } = { firstNames: [], surnames: [] };

    if (parsed.data.firstName) {
      const norm = normalizeNameToken(parsed.data.firstName);
      if (norm) {
        if (hasFirstName(norm)) {
          // Already in runtime set (file constants or previous DB addition)
          alreadyExisted.firstNames.push(norm);
        } else {
          await db.insert(hispanicNameAdditions).values({ type: "first_name", name: norm });
          addNameToRuntime("first_name", norm);
          added.firstNames.push(norm);
        }
      }
    }

    if (parsed.data.lastName) {
      const norm = normalizeNameToken(parsed.data.lastName);
      if (norm) {
        if (hasSurname(norm)) {
          // Already in runtime set (file constants or previous DB addition)
          alreadyExisted.surnames.push(norm);
        } else {
          await db.insert(hispanicNameAdditions).values({ type: "surname", name: norm });
          addNameToRuntime("surname", norm);
          added.surnames.push(norm);
        }
      }
    }

    return res.json({ added, alreadyExisted });
  }
);

router.post(
  "/create-outreach-lead",
  requireRole("admin", "developer", "lead_gen"),
  async (req, res) => {
    const schema = z.object({
      sellerName:                 z.string().trim().min(1),
      companyName:                z.string().trim().min(1),
      email:                      z.string().trim().email(),
      phone:                      z.string().trim().min(1),
      sellerProfileUrl:           z.string().url(),
      adUrl:                      z.string().url(),
      trade:                      z.string().min(1),
      city:                       z.string().min(1),
      state:                      z.string().length(2),
      hispanicNameScore:          z.number().int().min(0).max(100),
      spanishOutreachRecommended: z.boolean(),
      firstOutreachMessage:       z.string().min(1),
      firstOutreachSentAt:        z.string().datetime(),
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
    const companyNameNormalized = parsed.data.companyName.trim();
    const stateCode = parsed.data.state.trim().toUpperCase();

    const defaultStatus = await crmStorage.getDefaultLeadStatus();

    const [defaultRep] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "sales_rep"), eq(user.banned, false)))
      .orderBy(user.createdAt)
      .limit(1);
    const defaultAssignedRepId = defaultRep?.id ?? req.authUser!.id;

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
            phone: parsed.data.phone,
            email: parsed.data.email,
            preferredLanguage: "es",
          })
          .returning();
      } else {
        const contactUpdates: Record<string, string> = {};
        if (!contact.phone) contactUpdates.phone = parsed.data.phone;
        if (!contact.email) contactUpdates.email = parsed.data.email;
        if (Object.keys(contactUpdates).length > 0) {
          await tx.update(crmContacts).set(contactUpdates).where(eq(crmContacts.id, contact.id));
          contact = { ...contact, ...contactUpdates };
        }
      }

      let [company] = await tx
        .select()
        .from(crmCompanies)
        .where(
          and(
            ilike(crmCompanies.name, companyNameNormalized),
            eq(crmCompanies.state, stateCode)
          )
        )
        .limit(1);

      if (!company) {
        [company] = await tx
          .insert(crmCompanies)
          .values({
            name:     companyNameNormalized,
            phone:    parsed.data.phone,
            email:    parsed.data.email,
            industry: parsed.data.trade,
            city:     parsed.data.city,
            state:    stateCode,
          })
          .returning();
      } else {
        const companyUpdates: Record<string, string> = {};
        if (!company.phone)    companyUpdates.phone    = parsed.data.phone;
        if (!company.email)    companyUpdates.email    = parsed.data.email;
        if (!company.industry) companyUpdates.industry = parsed.data.trade;
        if (!company.city)     companyUpdates.city     = parsed.data.city;
        if (Object.keys(companyUpdates).length > 0) {
          await tx.update(crmCompanies).set(companyUpdates).where(eq(crmCompanies.id, company.id));
          company = { ...company, ...companyUpdates };
        }
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
          title:                      companyNameNormalized,
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
          assignedTo:                 defaultAssignedRepId,
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
        assignedTo:      defaultAssignedRepId,
      });
      try {
        await executeStageAutomations({
          opportunityId: opp.id,
          leadId:        lead.id,
          contactId:     contact.id,
          companyId:     company.id,
          assignedTo:    defaultAssignedRepId,
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

// ─── Pending Outreach routes ───────────────────────────────────────────────
// All three routes share the same auth middleware: MARKETPLACE_BOT_SECRET
// bearer bypass, then fall back to requireRole("admin","developer","lead_gen").

function botOrRole(req: Request, res: Response, next: NextFunction) {
  const botSecret = process.env.MARKETPLACE_BOT_SECRET;
  if (botSecret) {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader === `Bearer ${botSecret}`) return next();
  }
  return requireRoleBearerFirst("admin", "developer", "lead_gen")(req, res, next);
}

// Bot secret OR session with admin, developer, or lead_gen role.
// To restrict back to admin/developer only: remove "lead_gen" here and from
// the adminActionsAllowed line in the /precheck handler above.
function botOrAdminRole(req: Request, res: Response, next: NextFunction) {
  const botSecret = process.env.MARKETPLACE_BOT_SECRET;
  if (botSecret) {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader === `Bearer ${botSecret}`) return next();
  }
  return requireRoleBearerFirst("admin", "developer", "lead_gen")(req, res, next);
}

const createPendingOutreachSchema = z.object({
  sellerFullName:   z.string().trim().min(1),
  sellerProfileUrl: z.string().url(),
  listingUrl:       z.string().url().optional(),
  listingTitleRaw:  z.string().optional(),
  city:             z.string().optional(),
  state:            z.string().length(2).optional(),
  tradeGuess:       z.string().optional(),
  facebookJoinYear: z.number().int().optional(),
  nameScore:        z.number().int().min(0).max(100),
  precheckPassed:   z.boolean(),
  precheckReason:   z.string().optional(),
  outreachMessage:  z.string().optional(),
}).strict();

const patchPendingOutreachSchema = z.object({
  messageStatus:    z.enum(MARKETPLACE_PENDING_OUTREACH_STATUSES).optional(),
  outreachMessage:  z.string().optional(),
  outreachSentAt:   z.string().datetime().optional(),
  replyReceivedAt:  z.string().datetime().optional(),
  extractedPhone:   z.string().optional(),
  threadIdentifier: z.string().optional(),
  crmLeadId:        z.string().optional(),
  convertedAt:      z.string().datetime().optional(),
}).strict();

router.post(
  "/pending-outreach",
  botOrRole,
  async (req, res) => {
    const parsed = createPendingOutreachSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const d = parsed.data;
    const normalizedSellerUrl = normalizeSellerUrl(d.sellerProfileUrl);
    const normalizedListingUrl = d.listingUrl ? normalizeSellerUrl(d.listingUrl) : undefined;
    const listingTitleNormalized = d.listingTitleRaw ? d.listingTitleRaw.trim().toLowerCase() : undefined;

    const { firstName: derivedFirstName } = scoreHispanicName(d.sellerFullName);

    const existing = await marketplaceStorage.findActivePendingOutreachBySellerUrl(normalizedSellerUrl);
    if (existing) {
      return res.status(409).json({
        message: "Active pending record already exists",
        existingId: existing.id,
      });
    }

    const createdBy = req.authUser?.id ?? null;

    const record = await marketplaceStorage.createPendingOutreach({
      sellerFullName:         d.sellerFullName,
      sellerFirstName:        derivedFirstName || null,
      sellerProfileUrl:       normalizedSellerUrl,
      listingUrl:             normalizedListingUrl ?? null,
      listingTitleRaw:        d.listingTitleRaw ?? null,
      listingTitleNormalized: listingTitleNormalized ?? null,
      city:                   d.city ?? null,
      state:                  d.state ?? null,
      tradeGuess:             d.tradeGuess ?? null,
      facebookJoinYear:       d.facebookJoinYear ?? null,
      nameScore:              d.nameScore,
      precheckPassed:         d.precheckPassed,
      precheckReason:         d.precheckReason ?? null,
      messageStatus:          "ready_to_message",
      outreachMessage:        d.outreachMessage ?? null,
      createdBy:              createdBy,
    });

    return res.status(201).json(record);
  }
);

// ─── Admin list routes (admin/developer only) ──────────────────────────────
// IMPORTANT: /summary and the list GET must be registered BEFORE /:id to
// prevent the wildcard from swallowing the literal path segment "summary".

router.get(
  "/pending-outreach/summary",
  requireRole("admin", "developer"),
  async (_req, res) => {
    const summary = await marketplaceStorage.getPendingOutreachSummary();
    return res.json(summary);
  }
);

router.get(
  "/pending-outreach/my-leads",
  requireRoleBearerFirst("admin", "developer", "lead_gen"),
  async (req, res) => {
    const VALID_GROUPS = ["open", "converted", "closed"] as const;
    const rawGroup = req.query.statusGroup;
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;

    if (rawGroup !== undefined && !VALID_GROUPS.includes(rawGroup as (typeof VALID_GROUPS)[number])) {
      return res.status(400).json({
        message: `Invalid statusGroup. Must be one of: ${VALID_GROUPS.join(", ")}`,
      });
    }

    const page = Math.max(1, Number(rawPage) || 1);
    const limit = Math.min(100, Math.max(1, Number(rawLimit) || 50));

    const result = await marketplaceStorage.listMyLeads(req.authUser!.id, {
      statusGroup: rawGroup as "open" | "converted" | "closed" | undefined,
      page,
      limit,
    });

    return res.json(result);
  }
);

// ─── Extension lookup: find most recent record by seller URL ───────────────
// Called on every popup open so the extension can resume from the correct stage.
// Returns the most recent record for the seller URL across ALL statuses.
// Auth: bot secret OR session with admin/developer/lead_gen role.
// Registered before /:id to avoid the wildcard swallowing "lookup".

router.get(
  "/pending-outreach/lookup",
  botOrRole,
  async (req, res) => {
    // ── Helper: build the shared record shape ──────────────────────────────
    function buildRecord(r: Awaited<ReturnType<typeof marketplaceStorage.findLatestPendingOutreachBySellerUrl>>) {
      if (!r) return null;
      return {
        id:              r.id,
        messageStatus:   r.messageStatus,
        sellerFullName:  r.sellerFullName,
        nameScore:       r.nameScore,
        city:            r.city,
        state:           r.state,
        listingUrl:      r.listingUrl,
        outreachSentAt:  r.outreachSentAt,
        replyReceivedAt: r.replyReceivedAt,
        convertedAt:     r.convertedAt,
        crmLeadId:       r.crmLeadId,
      };
    }

    // ── Method 1: sellerProfileUrl (listing-page lookup) ──────────────────
    if (req.query.sellerProfileUrl !== undefined) {
      const schema = z.object({ sellerProfileUrl: z.string().url() });
      const parsed = schema.safeParse({ sellerProfileUrl: req.query.sellerProfileUrl });
      if (!parsed.success) {
        return res.status(400).json({ message: "sellerProfileUrl must be a valid URL" });
      }
      const normalizedUrl = normalizeSellerUrl(parsed.data.sellerProfileUrl);
      const record = await marketplaceStorage.findLatestPendingOutreachBySellerUrl(normalizedUrl);
      if (!record) return res.json({ found: false });
      return res.json({ found: true, matchedBy: "sellerProfileUrl", record: buildRecord(record) });
    }

    // ── Method 2: sellerFirstName + listingTitle (Messenger-context lookup) ─
    if (req.query.sellerFirstName !== undefined || req.query.listingTitle !== undefined) {
      const schema = z.object({
        sellerFirstName: z.string().trim().min(1),
        listingTitle:    z.string().trim().min(1),
      });
      const parsed = schema.safeParse({
        sellerFirstName: req.query.sellerFirstName,
        listingTitle:    req.query.listingTitle,
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: "Both sellerFirstName and listingTitle are required for Messenger-context lookup",
        });
      }
      const firstNameNorm   = parsed.data.sellerFirstName.toLowerCase();
      const listingTitleNorm = parsed.data.listingTitle.toLowerCase();
      const result = await marketplaceStorage.findPendingOutreachByMessengerClues(
        firstNameNorm,
        listingTitleNorm
      );
      if (!result || result === "ambiguous") return res.json({ found: false });
      return res.json({ found: true, matchedBy: "messengerClues", record: buildRecord(result) });
    }

    // ── No usable params ──────────────────────────────────────────────────
    return res.status(400).json({
      message: "Provide either sellerProfileUrl (listing-page lookup) or both sellerFirstName and listingTitle (Messenger lookup)",
    });
  }
);

router.get(
  "/pending-outreach",
  requireRole("admin", "developer"),
  async (req, res) => {
    const pageRaw  = Number(req.query.page)  || 1;
    const limitRaw = Number(req.query.limit) || 25;
    const page  = Math.max(1, pageRaw);
    const limit = Math.min(100, Math.max(1, limitRaw));

    const status    = typeof req.query.status   === "string" && req.query.status   ? req.query.status   : undefined;
    const search    = typeof req.query.search   === "string" && req.query.search   ? req.query.search   : undefined;
    const hasPhone  = req.query.hasPhone   === "true" ? true  : req.query.hasPhone   === "false" ? false  : undefined;
    const hasCrmLead = req.query.hasCrmLead === "true" ? true  : req.query.hasCrmLead === "false" ? false : undefined;

    const result = await marketplaceStorage.listPendingOutreach({
      page,
      limit,
      status,
      search,
      hasPhone,
      hasCrmLead,
    });

    return res.json(result);
  }
);

// ─── Bulk action schemas ────────────────────────────────────────────────────

const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
}).strict();

const BULK_SKIP_ELIGIBLE = [
  "ready_to_message", "awaiting_reply", "reply_received", "manual_review_required",
] as const;

// ─── Bulk Skip ──────────────────────────────────────────────────────────────

router.post(
  "/pending-outreach/bulk-skip",
  requireRole("admin", "developer"),
  async (req, res) => {
    const parsed = bulkIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const { ids } = parsed.data;

    const records = await marketplaceStorage.getManyPendingOutreachByIds(ids);

    if (records.length !== ids.length) {
      const foundIds = new Set(records.map(r => r.id));
      const missing  = ids.filter(id => !foundIds.has(id));
      return res.status(404).json({ message: `Records not found: ${missing.join(", ")}` });
    }

    const ineligible = records.filter(
      r => !(BULK_SKIP_ELIGIBLE as readonly string[]).includes(r.messageStatus)
    );
    if (ineligible.length > 0) {
      return res.status(400).json({
        message: `${ineligible.length} selected record(s) cannot be skipped. Only ready_to_message, awaiting_reply, reply_received, and manual_review_required records may be skipped. Ineligible: ${ineligible.map(r => r.sellerFullName).join(", ")}.`,
        ineligibleIds:      ineligible.map(r => r.id),
        ineligibleStatuses: [...new Set(ineligible.map(r => r.messageStatus))],
      });
    }

    const result = await marketplaceStorage.bulkSkipPendingOutreach(ids);
    return res.json(result);
  }
);

// ─── Bulk Approve Match ─────────────────────────────────────────────────────

router.post(
  "/pending-outreach/bulk-approve-match",
  requireRole("admin", "developer"),
  async (req, res) => {
    const parsed = bulkIdsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const { ids } = parsed.data;

    const records = await marketplaceStorage.getManyPendingOutreachByIds(ids);

    if (records.length !== ids.length) {
      const foundIds = new Set(records.map(r => r.id));
      const missing  = ids.filter(id => !foundIds.has(id));
      return res.status(404).json({ message: `Records not found: ${missing.join(", ")}` });
    }

    const ineligible = records.filter(r => r.messageStatus !== "manual_review_required");
    if (ineligible.length > 0) {
      return res.status(400).json({
        message: `${ineligible.length} selected record(s) cannot be approved. Only manual_review_required records may be approved. Ineligible: ${ineligible.map(r => r.sellerFullName).join(", ")}.`,
        ineligibleIds:      ineligible.map(r => r.id),
        ineligibleStatuses: [...new Set(ineligible.map(r => r.messageStatus))],
      });
    }

    const result = await marketplaceStorage.bulkApprovePendingOutreach(ids);
    return res.json(result);
  }
);

router.get(
  "/pending-outreach/:id",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;
    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.json(record);
  }
);

router.patch(
  "/pending-outreach/:id",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;
    const parsed = patchPendingOutreachSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const d = parsed.data;
    const updateData: Parameters<typeof marketplaceStorage.updatePendingOutreach>[1] = {
      ...(d.messageStatus    !== undefined && { messageStatus:    d.messageStatus }),
      ...(d.outreachMessage  !== undefined && { outreachMessage:  d.outreachMessage }),
      ...(d.outreachSentAt   !== undefined && { outreachSentAt:   new Date(d.outreachSentAt) }),
      ...(d.replyReceivedAt  !== undefined && { replyReceivedAt:  new Date(d.replyReceivedAt) }),
      ...(d.extractedPhone   !== undefined && { extractedPhone:   d.extractedPhone }),
      ...(d.threadIdentifier !== undefined && { threadIdentifier: d.threadIdentifier }),
      ...(d.crmLeadId        !== undefined && { crmLeadId:        d.crmLeadId }),
      ...(d.convertedAt      !== undefined && { convertedAt:      new Date(d.convertedAt) }),
    };

    const updated = await marketplaceStorage.updatePendingOutreach(id, updateData);
    if (!updated) {
      return res.status(404).json({ message: "Not found" });
    }
    return res.json(updated);
  }
);

const markMessageSentSchema = z.object({
  outreachMessage: z.string().optional(),
  outreachSentAt:  z.string().datetime().optional(),
}).strict();

const BLOCKED_FOR_MARK_SENT: string[] = ["skipped", "converted"];

router.post(
  "/pending-outreach/:id/mark-message-sent",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;

    const parsed = markMessageSentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }

    if (BLOCKED_FOR_MARK_SENT.includes(record.messageStatus)) {
      return res.status(400).json({
        message: `Cannot mark message sent: record is already ${record.messageStatus}`,
        currentStatus: record.messageStatus,
      });
    }

    const d = parsed.data;
    const updated = await marketplaceStorage.markPendingOutreachMessageSent(id, {
      outreachSentAt:  d.outreachSentAt ? new Date(d.outreachSentAt) : new Date(),
      outreachMessage: d.outreachMessage,
    });

    return res.json(updated);
  }
);

const captureReplySchema = z.object({
  replyText:        z.string().optional(),
  threadIdentifier: z.string().optional(),
  replyReceivedAt:  z.string().datetime().optional(),
  manualPhone:      z.string().optional(),
}).strict();

const ALLOWED_FOR_CAPTURE_REPLY: string[] = [
  "awaiting_reply",
  "manual_review_required",
  "reply_received",
];

router.post(
  "/pending-outreach/:id/capture-reply",
  botOrRole,
  async (req, res) => {
    const id = req.params.id as string;

    const parsed = captureReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }

    if (!ALLOWED_FOR_CAPTURE_REPLY.includes(record.messageStatus)) {
      const message = record.messageStatus === "ready_to_message"
        ? "Cannot capture reply: outreach has not been marked as sent yet."
        : `Cannot capture reply: record is already ${record.messageStatus}`;
      return res.status(400).json({ message, currentStatus: record.messageStatus });
    }

    const d = parsed.data;

    // ── Phone source resolution (optional at capture time) ───────────────
    // Auto-extraction is tried first; manualPhone is the fallback.
    // Phone is no longer required to advance the record — it will be
    // required later at convert-to-crm time instead.
    const rawPhone       = (d.replyText ? extractPhoneFromText(d.replyText) : null) ?? d.manualPhone?.trim() ?? null;
    let normalizedPhone: string | null = null;

    if (rawPhone) {
      // A phone source is present — validate it. Invalid format is still an error.
      const validated = normalizePhone(rawPhone);
      if (!validated) {
        return res.status(400).json({
          message: "Invalid phone number — must be a 10-digit US number.",
        });
      }
      normalizedPhone = validated;
    }
    // If rawPhone is null, normalizedPhone stays null and the record advances
    // without a phone; the extension will supply it at convert-to-crm time.

    // Phase 1 simplified flow: the route is already scoped to a specific
    // record ID — advance directly to reply_received.
    const updated = await marketplaceStorage.captureReplyOnPendingOutreach(id, {
      lastReplyText:        d.replyText ?? null,
      extractedPhone:       rawPhone       ?? undefined,
      replyPhoneNormalized: normalizedPhone ?? undefined,
      replyReceivedAt:      d.replyReceivedAt ? new Date(d.replyReceivedAt) : new Date(),
      ...(d.threadIdentifier !== undefined && { threadIdentifier: d.threadIdentifier }),
    });

    return res.json(updated);
  }
);

// ─── Helper: split "First Rest Of Name" → { firstName, lastName } ─────────
function splitSellerName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName  = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName };
}

// ─── Helper: build Marketplace snapshot note ─────────────────────────────
function buildOutreachSnapshot(record: {
  sellerFullName: string;
  listingTitleRaw: string | null;
  sellerProfileUrl: string;
  listingUrl: string | null;
  lastReplyText: string | null;
  replyPhoneNormalized: string | null;
  extractedPhone: string | null;
  facebookJoinYear: number | null;
}): string {
  const lines: string[] = ["Marketplace Outreach Snapshot", ""];
  const add = (label: string, val: string | number | null | undefined) => {
    if (val !== null && val !== undefined && String(val).trim() !== "") {
      lines.push(`${label}: ${val}`);
    }
  };
  add("Seller Name",        record.sellerFullName);
  add("Listing Title",      record.listingTitleRaw);
  add("Seller Profile URL", record.sellerProfileUrl);
  add("Listing URL",        record.listingUrl);
  add("Reply Text",         record.lastReplyText);
  add("Extracted Phone",    record.replyPhoneNormalized ?? record.extractedPhone);
  add("Facebook Join Year", record.facebookJoinYear);
  return lines.join("\n");
}

const convertToCrmSchema = z.object({
  assignedTo:            z.string().optional(),
  overrideFirstName:     z.string().optional(),
  overrideLastName:      z.string().optional(),
  overrideCompanyName:   z.string().optional(),
  overrideBusinessName:  z.string().optional(),
  overrideTrade:         z.string().optional(),
  overrideCity:          z.string().optional(),
  overrideState:         z.string().optional(),
  overridePhone:         z.string().optional(),
}).strict();

// ─── Approve manual review ─────────────────────────────────────────────────

router.post(
  "/pending-outreach/:id/approve-match",
  requireRole("admin", "developer"),
  async (req, res) => {
    const id = req.params.id as string;

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }
    if (record.messageStatus !== "manual_review_required") {
      return res.status(400).json({
        message: `Cannot approve: record status is "${record.messageStatus}". Only manual_review_required records may be approved.`,
        currentStatus: record.messageStatus,
      });
    }

    const updated = await marketplaceStorage.approveManualReview(id);
    return res.json(updated);
  }
);

// ─── Reject manual review ──────────────────────────────────────────────────

router.post(
  "/pending-outreach/:id/reject-match",
  requireRole("admin", "developer"),
  async (req, res) => {
    const id = req.params.id as string;

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Not found" });
    }
    if (record.messageStatus !== "manual_review_required") {
      return res.status(400).json({
        message: `Cannot reject: record status is "${record.messageStatus}". Only manual_review_required records may be rejected.`,
        currentStatus: record.messageStatus,
      });
    }

    const updated = await marketplaceStorage.rejectManualReview(id);
    return res.json(updated);
  }
);

// ─── Convert to CRM ────────────────────────────────────────────────────────

const ELIGIBLE_FOR_CONVERSION = ["reply_received"] as const;

router.post(
  "/pending-outreach/:id/convert-to-crm",
  botOrRole,
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) {
      return res.status(404).json({ message: "Pending outreach record not found." });
    }

    if (record.messageStatus === "converted") {
      return res.status(400).json({
        message: "This record has already been converted to a CRM lead.",
        currentStatus: record.messageStatus,
        crmLeadId: record.crmLeadId,
      });
    }

    if (!(ELIGIBLE_FOR_CONVERSION as readonly string[]).includes(record.messageStatus)) {
      const hint = record.messageStatus === "manual_review_required"
        ? " Use Approve Match first to accept the reply, then convert."
        : "";
      return res.status(400).json({
        message: `Cannot convert: record status is "${record.messageStatus}". Only reply_received records may be converted.${hint}`,
        currentStatus: record.messageStatus,
      });
    }

    const parsed = convertToCrmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const opts = parsed.data;

    // ── Name resolution ───────────────────────────────────────────────────
    const { firstName: defaultFirst, lastName: defaultLast } = splitSellerName(record.sellerFullName);
    const firstName    = crmStorage.normalizePersonName(opts.overrideFirstName ?? defaultFirst);
    const rawLastName  = opts.overrideLastName ?? defaultLast;
    const lastName     = rawLastName ? crmStorage.normalizePersonName(rawLastName) : null;
    const rawBusinessName = opts.overrideCompanyName?.trim() || opts.overrideBusinessName?.trim() || null;
    const businessName = rawBusinessName ? crmStorage.normalizeCompanyName(rawBusinessName) : null;
    const trade        = opts.overrideTrade        ?? record.tradeGuess ?? null;
    const city         = opts.overrideCity         ?? record.city       ?? null;
    const state        = opts.overrideState        ?? record.state      ?? null;

    // ── Phone resolution ──────────────────────────────────────────────────
    // Resolution order:
    //   1. overridePhone (caller-supplied at convert time — Phase 1 primary path)
    //   2. replyPhoneNormalized stored on the record (captured at reply time)
    //   3. extractedPhone stored on the record (raw auto-extracted fallback)
    //
    // Two distinct error cases:
    //   • No phone source at all → 400 "phone required"
    //   • Phone source exists but is invalid → 400 "invalid phone" (existing behavior)
    let normalizedPhone: string;
    if (opts.overridePhone) {
      // Case: caller supplied a phone at convert time — validate it.
      const validated = normalizePhone(opts.overridePhone.trim());
      if (!validated) {
        return res.status(400).json({
          message: "Invalid overridePhone — must be a 10-digit US number.",
        });
      }
      normalizedPhone = normalizePhoneDigits(validated);
    } else {
      // Case: use whatever was stored during capture-reply.
      const rawPhone = record.replyPhoneNormalized ?? record.extractedPhone ?? null;
      if (!rawPhone) {
        // No phone source at all — block conversion and ask for a phone.
        return res.status(400).json({
          message: "Phone number required — provide a phone number to complete conversion.",
        });
      }
      normalizedPhone = normalizePhoneDigits(rawPhone);
    }

    // ── Assignee ──────────────────────────────────────────────────────────
    const resolvedAssignee = await crmStorage.resolveLeadAssignee(
      opts.assignedTo ?? req.authUser?.id ?? null,
    );

    // ── Duplicate check ───────────────────────────────────────────────────
    const dupCheck = await crmStorage.checkManualLeadDuplicate({
      normalizedPhone,
      firstName,
      lastName:         lastName ?? "",
      businessName:     businessName ?? undefined,
      state:            state ?? "",
      source:           "outreach",
      sellerProfileUrl: record.sellerProfileUrl,
    });
    if (dupCheck.isDuplicate) {
      return res.status(409).json({ code: "DUPLICATE_LEAD", match: dupCheck.match });
    }

    // ── Contact: find or create ───────────────────────────────────────────
    let contact = normalizedPhone
      ? await crmStorage.findContactByPhone(normalizedPhone)
      : null;
    if (!contact) {
      contact = await crmStorage.createContact({
        firstName,
        lastName: lastName ?? null,
        phone:    normalizedPhone || null,
        email:    null,
        notes:    null,
        isPrimary: true,
        preferredLanguage: null,
      });
    }

    // ── Company: find or create ───────────────────────────────────────────
    const fullDisplayName = lastName ? `${firstName} ${lastName}`.trim() : firstName;
    const companyName     = businessName || fullDisplayName;
    let company = await crmStorage.findCompanyByName(companyName);
    if (!company) {
      company = await crmStorage.createCompany({
        name:     companyName,
        industry: trade ?? undefined,
        city:     city ?? null,
        state:    state ?? null,
        website:  null,
        phone:    normalizedPhone || null,
        email:    null,
      });
    }
    const companyId = company.id;
    if (!contact.companyId) {
      await crmStorage.updateContact(contact.id, { companyId });
    }

    // ── Default CRM status ────────────────────────────────────────────────
    const defaultStatus =
      (await crmStorage.getDefaultLeadStatus()) ??
      (await crmStorage.getLeadStatusBySlug("new"));

    // ── Lead title & notes ────────────────────────────────────────────────
    const leadTitle = businessName
      ? `${businessName} – ${fullDisplayName}`
      : fullDisplayName;

    const notes = buildOutreachSnapshot(record);

    // ── Create CRM lead ───────────────────────────────────────────────────
    const lead = await crmStorage.createLead({
      title:            leadTitle,
      companyId,
      contactId:        contact.id,
      statusId:         defaultStatus?.id ?? null,
      source:           "outreach",
      sourceLabel:      "Outreach",
      trade:            trade ?? null,
      notes,
      fromWebsiteForm:  false,
      city:             city ?? null,
      state:            state ?? null,
      timezone:         state ? (US_STATE_TIMEZONES[state] ?? null) : null,
      assignedTo:       resolvedAssignee,
      sellerProfileUrl: record.sellerProfileUrl,
      adUrl:            record.listingUrl ?? null,
    });

    // ── Pipeline opportunity ──────────────────────────────────────────────
    const newLeadStage = await pipelineStorage.getStageBySlug("new-lead");
    if (newLeadStage) {
      const opp = await pipelineStorage.createOpportunity({
        title:           leadTitle,
        leadId:          lead.id,
        companyId,
        contactId:       contact.id,
        stageId:         newLeadStage.id,
        status:          "open",
        sourceLeadTitle: leadTitle,
        notes,
        assignedTo:      resolvedAssignee,
      });
      executeStageAutomations({
        opportunityId: opp.id,
        leadId:        lead.id,
        contactId:     contact.id,
        companyId,
        assignedTo:    resolvedAssignee,
        stageSlug:     "new-lead",
        actorId:       resolvedAssignee,
      }).catch((err: unknown) => {
        console.error("[marketplace/convert-to-crm] executeStageAutomations failed:", err);
      });
    }

    // ── Mark pending outreach as converted ────────────────────────────────
    const convertedRecord = await marketplaceStorage.updatePendingOutreach(id, {
      crmLeadId:            lead.id,
      messageStatus:        "converted",
      convertedAt:          new Date(),
      city:                 city ?? null,
      state:                state ?? null,
      tradeGuess:           trade ?? null,
      replyPhoneNormalized: normalizedPhone || null,
      businessName:         companyName,
    });

    await logAudit({
      userId:    req.authUser?.id,
      action:    "create",
      entity:    "crm_lead",
      entityId:  lead.id,
      metadata:  { title: lead.title, source: "marketplace_outreach", pendingOutreachId: id },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      pendingOutreachId: id,
      crmLeadId:         lead.id,
      messageStatus:     "converted",
      lead,
    });
    } catch (err: unknown) {
      const pgErr = err as { code?: string; message?: string; detail?: string; column?: string; table?: string };
      console.error("[convert-to-crm] DB error", {
        code:    pgErr?.code,
        message: pgErr?.message,
        detail:  pgErr?.detail,
        column:  pgErr?.column,
        table:   pgErr?.table,
      });
      return res.status(500).json({
        message: "Internal server error during conversion.",
        detail:  pgErr?.message ?? "Unknown error",
      });
    }
  }
);

// ─── Delete single record (admin / developer only) ─────────────────────────

router.delete(
  "/pending-outreach/:id",
  requireAuth,
  requireRole("admin", "developer"),
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const record = await marketplaceStorage.getPendingOutreachById(id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const deleted = await marketplaceStorage.deletePendingOutreach(id);
    if (!deleted) return res.status(404).json({ message: "Record not found" });

    await logAudit({
      userId:    req.authUser?.id,
      action:    "delete",
      entity:    "marketplace_pending_outreach",
      entityId:  id,
      metadata:  { sellerFullName: record.sellerFullName, messageStatus: record.messageStatus },
      ipAddress: req.ip,
    });

    return res.status(200).json({ deleted: true, id });
  }
);

// ─── Bulk delete (admin / developer only) ──────────────────────────────────

const bulkDeleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) }).strict();

router.post(
  "/pending-outreach/bulk-delete",
  requireAuth,
  requireRole("admin", "developer"),
  async (req: Request, res: Response) => {
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.flatten() });

    const { ids } = parsed.data;
    const result = await marketplaceStorage.bulkDeletePendingOutreach(ids);
    return res.json(result);
  }
);

export default router;
