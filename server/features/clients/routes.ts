import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { db } from "../../db";
import { crmCompanies, crmContacts, crmLeads, crmLeadStatuses, pipelineOpportunities, pipelineStages, onboardingRecords, user, clientNotes } from "@shared/schema";
import { sql, desc, ilike, or, SQL, eq } from "drizzle-orm";
import { z } from "zod";
import { logAudit } from "../audit/service";
import { appendHistorySafe } from "../history/service";

const router = Router();

const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  dba: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  clientStatus: z.enum(["active", "inactive", "at_risk", "churned", "prospect"]).nullable().optional(),
  accountOwnerId: z.string().nullable().optional(),
  nextFollowUpDate: z.string().nullable().transform(v => v ? new Date(v) : null).optional(),
  preferredContactMethod: z.enum(["email", "phone", "text", "in_person"]).nullable().optional(),
}).strict();

const createNoteSchema = z.object({
  type: z.enum(["general", "call", "meeting", "internal"]),
  content: z.string().min(1),
  isPinned: z.boolean().optional(),
}).strict();

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
}).strict();

router.get("/", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const search = (req.query.search as string || "").trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
    const offset = (page - 1) * limit;

    const searchPattern = `%${search}%`;
    const whereClause: SQL | undefined = search
      ? or(
          ilike(crmCompanies.name, searchPattern),
          ilike(crmCompanies.industry, searchPattern),
          ilike(crmCompanies.city, searchPattern),
        )
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id: crmCompanies.id,
          name: crmCompanies.name,
          dba: crmCompanies.dba,
          industry: crmCompanies.industry,
          city: crmCompanies.city,
          state: crmCompanies.state,
          phone: crmCompanies.phone,
          email: crmCompanies.email,
          website: crmCompanies.website,
          clientStatus: crmCompanies.clientStatus,
          createdAt: crmCompanies.createdAt,
          contactCount: sql<number>`(
            SELECT count(*)::int FROM crm_contacts WHERE company_id = ${crmCompanies.id}
          )`,
          leadCount: sql<number>`(
            SELECT count(*)::int FROM crm_leads WHERE company_id = ${crmCompanies.id}
          )`,
          opportunityValue: sql<number>`(
            SELECT coalesce(sum(value::numeric), 0) FROM pipeline_opportunities WHERE company_id = ${crmCompanies.id}
          )`,
          opportunityCount: sql<number>`(
            SELECT count(*)::int FROM pipeline_opportunities WHERE company_id = ${crmCompanies.id}
          )`,
          activeOnboardings: sql<number>`(
            SELECT count(*)::int FROM onboarding_records WHERE company_id = ${crmCompanies.id} AND status NOT IN ('completed', 'on_hold')
          )`,
        })
        .from(crmCompanies)
        .$dynamic()
        .where(whereClause)
        .orderBy(desc(crmCompanies.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: sql<number>`count(*)::int` })
        .from(crmCompanies)
        .$dynamic()
        .where(whereClause),
    ]);

    res.json({ items: rows, total, page, limit });
  } catch (err: any) {
    console.error("Clients list error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;

    const [company] = await db
      .select({
        company: crmCompanies,
        accountOwner: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(crmCompanies)
      .leftJoin(user, eq(crmCompanies.accountOwnerId, user.id))
      .where(eq(crmCompanies.id, id))
      .limit(1);

    if (!company) {
      return res.status(404).json({ message: "Client not found" });
    }

    const [contacts, leads, opportunities, onboardings, recentNotes] = await Promise.all([
      db.select().from(crmContacts).where(eq(crmContacts.companyId, id)).orderBy(desc(crmContacts.isPrimary), desc(crmContacts.createdAt)),
      db.select({
        id: crmLeads.id,
        title: crmLeads.title,
        status: {
          name: crmLeadStatuses.name,
          color: crmLeadStatuses.color,
        },
        createdAt: crmLeads.createdAt,
      })
      .from(crmLeads)
      .leftJoin(crmLeadStatuses, eq(crmLeads.statusId, crmLeadStatuses.id))
      .where(eq(crmLeads.companyId, id))
      .orderBy(desc(crmLeads.createdAt))
      .limit(10),
      db.select({
        id: pipelineOpportunities.id,
        title: pipelineOpportunities.title,
        stage: pipelineStages.name,
        value: pipelineOpportunities.value,
        createdAt: pipelineOpportunities.createdAt,
      })
      .from(pipelineOpportunities)
      .leftJoin(pipelineStages, eq(pipelineOpportunities.stageId, pipelineStages.id))
      .where(eq(pipelineOpportunities.companyId, id))
      .orderBy(desc(pipelineOpportunities.createdAt))
      .limit(10),
      db.select().from(onboardingRecords).where(eq(onboardingRecords.companyId, id)).orderBy(desc(onboardingRecords.createdAt)),
      db.select({
        id: clientNotes.id,
        type: clientNotes.type,
        content: clientNotes.content,
        isPinned: clientNotes.isPinned,
        createdAt: clientNotes.createdAt,
        user: {
          id: user.id,
          name: user.name,
        }
      })
      .from(clientNotes)
      .leftJoin(user, eq(clientNotes.userId, user.id))
      .where(eq(clientNotes.companyId, id))
      .orderBy(desc(clientNotes.isPinned), desc(clientNotes.createdAt))
      .limit(20),
    ]);

    res.json({
      ...company.company,
      accountOwner: company.accountOwner,
      contacts,
      leads,
      opportunities,
      onboardings,
      recentNotes,
    });
  } catch (err: any) {
    console.error("Client profile error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, id)).limit(1);
    if (!existing) return res.status(404).json({ message: "Client not found" });

    const validated = updateClientSchema.parse(req.body);
    const [updated] = await db.update(crmCompanies).set(validated).where(eq(crmCompanies.id, id)).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_updated",
      entity: "crm_company",
      entityId: id,
      metadata: { changes: validated },
      ipAddress: req.ip,
    });

    const actor = req.authUser ? { actorId: req.authUser.id, actorName: req.authUser.name } : {};

    if (validated.clientStatus !== undefined && validated.clientStatus !== existing.clientStatus) {
      appendHistorySafe({
        entityType: "client",
        entityId: id,
        event: "status_changed",
        fieldName: "clientStatus",
        fromValue: (existing.clientStatus as string) ?? null,
        toValue: (validated.clientStatus as string) ?? null,
        ...actor
      });
    }

    if (validated.accountOwnerId !== undefined && validated.accountOwnerId !== existing.accountOwnerId) {
      appendHistorySafe({
        entityType: "client",
        entityId: id,
        event: "owner_changed",
        fieldName: "accountOwnerId",
        fromValue: (existing.accountOwnerId as string) ?? null,
        toValue: (validated.accountOwnerId as string) ?? null,
        ...actor
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.get("/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const notes = await db
      .select({
        id: clientNotes.id,
        type: clientNotes.type,
        content: clientNotes.content,
        isPinned: clientNotes.isPinned,
        createdAt: clientNotes.createdAt,
        user: {
          id: user.id,
          name: user.name,
        }
      })
      .from(clientNotes)
      .leftJoin(user, eq(clientNotes.userId, user.id))
      .where(eq(clientNotes.companyId, id))
      .orderBy(desc(clientNotes.isPinned), desc(clientNotes.createdAt));

    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/notes", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const validated = createNoteSchema.parse(req.body);

    const [note] = await db.insert(clientNotes).values({
      companyId: id,
      userId: req.authUser?.id,
      type: validated.type,
      content: validated.content,
      isPinned: validated.isPinned ?? false,
    }).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_note_added",
      entity: "client_note",
      entityId: note.id,
      metadata: { companyId: id, type: note.type },
      ipAddress: req.ip,
    });

    appendHistorySafe({
      entityType: "client",
      entityId: id,
      event: "note_added",
      metadata: { noteId: note.id, type: note.type },
      actorId: req.authUser?.id,
      actorName: req.authUser?.name,
    });

    res.status(201).json(note);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id/notes/:noteId", requireRole("admin", "developer"), async (req, res) => {
  try {
    const noteId = req.params.noteId;
    await db.delete(clientNotes).where(eq(clientNotes.id, noteId));
    res.status(204).end();
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/:id/contacts", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const validated = contactSchema.parse(req.body);

    if (validated.isPrimary) {
      await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, id));
    }

    const [contact] = await db.insert(crmContacts).values({
      companyId: id,
      firstName: validated.firstName,
      lastName: validated.lastName || null,
      email: validated.email || null,
      phone: validated.phone || null,
      title: validated.title || null,
      preferredLanguage: validated.preferredLanguage || "es",
      isPrimary: validated.isPrimary ?? false,
    }).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_contact_added",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { companyId: id },
      ipAddress: req.ip,
    });

    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.patch("/:id/contacts/:contactId", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id;
    const contactId = req.params.contactId;
    const validated = contactSchema.partial().parse(req.body);

    if (validated.isPrimary) {
      await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, id));
    }

    const [contact] = await db.update(crmContacts).set(validated).where(eq(crmContacts.id, contactId)).returning();

    await logAudit({
      userId: req.authUser?.id,
      action: "client_contact_updated",
      entity: "crm_contact",
      entityId: contactId,
      metadata: { companyId: id },
      ipAddress: req.ip,
    });

    res.json(contact);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
