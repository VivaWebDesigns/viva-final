import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import {
  crmCompanies,
  crmContacts,
  crmLeads,
  crmLeadNotes,
  pipelineOpportunities,
  pipelineActivities,
  clientNotes,
  followupTasks,
  stripeCustomers,
  stripeWebhookEvents,
  attachments,
  user,
  type Role,
} from "@shared/schema";
import { eq, and, or, desc, asc, inArray, type SQL } from "drizzle-orm";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { appendHistorySafe, getHistory } from "../history/service";
import {
  getProfileByCompanyId,
  getProfileByLeadId,
  getProfileByOpportunityId,
} from "./service";
import { sendProfileError, ProfileLinkageError } from "./errors";

const router = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const idSchema = z.string().uuid("Invalid ID format");

const createNoteSchema = z.object({
  type: z.enum(["general", "call", "meeting", "internal"]),
  content: z.string().min(1),
  isPinned: z.boolean().optional(),
}).strict();

const leadNoteSchema = z.object({
  content: z.string().min(1),
  type: z.string().optional(),
}).strict();

const opportunityNoteSchema = z.object({
  content: z.string().min(1),
  type: z.string().optional(),
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

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().nullable().optional(),
  taskType: z.enum(["follow_up", "onboarding", "billing", "general", "review"]).default("follow_up"),
  dueDate: z.string().min(1, "Valid due date required"),
  assignedTo: z.string().nullable().optional(),
}).strict();

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

const updateAccountHealthSchema = z.object({
  launchDate: z.string().nullable().transform(v => v ? new Date(v) : null).optional(),
  renewalDate: z.string().nullable().transform(v => v ? new Date(v) : null).optional(),
  websiteStatus: z.enum(["live", "maintenance", "down", "building"]).nullable().optional(),
  carePlanStatus: z.enum(["active", "inactive", "none"]).nullable().optional(),
  serviceTier: z.enum(["basic", "standard", "premium"]).nullable().optional(),
  billingNotes: z.string().nullable().optional(),
}).strict();

const assignOwnerSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
}).strict();

const updateStatusSchema = z.object({
  statusId: z.string().min(1),
}).strict();

// ── Utilities ─────────────────────────────────────────────────────────────────

function isRestricted(req: Request): boolean {
  const role = req.authUser?.role as Role | undefined;
  return role === "sales_rep" || role === "lead_gen";
}

function actorId(req: Request): string {
  return req.authUser!.id;
}


// ── GET /api/profiles/company/:id ─────────────────────────────────────────────

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
          .where(and(eq(crmLeads.companyId, companyId), eq(crmLeads.assignedTo, actorId(req))))
          .limit(1);
        if (!ownedLead) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const profile = await getProfileByCompanyId(companyId);
      return res.json(profile);
    } catch (err: unknown) {
      return sendProfileError(res, err);
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
        if (!lead || lead.assignedTo !== actorId(req)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const profile = await getProfileByLeadId(leadId);
      return res.json(profile);
    } catch (err: unknown) {
      return sendProfileError(res, err);
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
        if (!opp || opp.assignedTo !== actorId(req)) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const profile = await getProfileByOpportunityId(opportunityId);
      return res.json(profile);
    } catch (err: unknown) {
      if (err instanceof ProfileLinkageError) {
        // Opportunity exists but has no resolvable company.  Return a
        // structured 422 that includes the opportunity's own data so the
        // client can render a meaningful fallback instead of a blank error.
        try {
          const [opp] = await db
            .select({
              id: pipelineOpportunities.id,
              title: pipelineOpportunities.title,
              value: pipelineOpportunities.value,
              status: pipelineOpportunities.status,
              stageId: pipelineOpportunities.stageId,
              assignedTo: pipelineOpportunities.assignedTo,
              companyId: pipelineOpportunities.companyId,
              leadId: pipelineOpportunities.leadId,
            })
            .from(pipelineOpportunities)
            .where(eq(pipelineOpportunities.id, opportunityId))
            .limit(1);
          return res.status(422).json({
            code: "PROFILE_LINKAGE_ERROR",
            message: err.message,
            opportunityId,
            opportunity: opp ?? null,
          });
        } catch {
          // Secondary fetch failed — fall through to generic error handler.
        }
      }
      return sendProfileError(res, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Company sub-resource READS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/profiles/company/:id/notes ───────────────────────────────────────

router.get(
  "/company/:id/notes",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const notes = await db
        .select({
          id: clientNotes.id,
          type: clientNotes.type,
          content: clientNotes.content,
          isPinned: clientNotes.isPinned,
          createdAt: clientNotes.createdAt,
          user: { id: user.id, name: user.name },
        })
        .from(clientNotes)
        .leftJoin(user, eq(clientNotes.userId, user.id))
        .where(eq(clientNotes.companyId, companyId))
        .orderBy(desc(clientNotes.isPinned), desc(clientNotes.createdAt));
      return res.json(notes);
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── GET /api/profiles/company/:id/tasks ───────────────────────────────────────

router.get(
  "/company/:id/tasks",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const status = req.query.status as string | undefined;

      const leadRows = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.companyId, companyId));
      const oppRows = await db.select({ id: pipelineOpportunities.id }).from(pipelineOpportunities).where(eq(pipelineOpportunities.companyId, companyId));
      const leadIds = leadRows.map((l) => l.id);
      const oppIds = oppRows.map((o) => o.id);

      const conditions: SQL[] = [eq(followupTasks.companyId, companyId)];
      if (leadIds.length > 0) conditions.push(inArray(followupTasks.leadId, leadIds));
      if (oppIds.length > 0) conditions.push(inArray(followupTasks.opportunityId, oppIds));

      const now = new Date();
      const tasks = await db
        .select({
          id: followupTasks.id,
          title: followupTasks.title,
          notes: followupTasks.notes,
          taskType: followupTasks.taskType,
          dueDate: followupTasks.dueDate,
          completed: followupTasks.completed,
          completedAt: followupTasks.completedAt,
          companyId: followupTasks.companyId,
          assignedTo: followupTasks.assignedTo,
          createdBy: followupTasks.createdBy,
          createdAt: followupTasks.createdAt,
          creatorName: user.name,
        })
        .from(followupTasks)
        .leftJoin(user, eq(followupTasks.createdBy, user.id))
        .where(or(...conditions))
        .orderBy(asc(followupTasks.dueDate));

      const enriched = tasks.map((task) => ({
        ...task,
        status: task.completed ? "completed" : task.dueDate < now ? "overdue" : "open",
      }));

      const filtered = status ? enriched.filter((t) => t.status === status) : enriched;
      return res.json(filtered);
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── GET /api/profiles/company/:id/files ───────────────────────────────────────

router.get(
  "/company/:id/files",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const files = await db
        .select({
          id: attachments.id,
          originalName: attachments.originalName,
          mimeType: attachments.mimeType,
          sizeBytes: attachments.sizeBytes,
          url: attachments.url,
          key: attachments.key,
          createdAt: attachments.createdAt,
          uploaderName: user.name,
          uploaderUserId: attachments.uploaderUserId,
        })
        .from(attachments)
        .leftJoin(user, eq(attachments.uploaderUserId, user.id))
        .where(and(eq(attachments.entityType, "client"), eq(attachments.entityId, companyId)))
        .orderBy(desc(attachments.createdAt));
      return res.json(files);
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── GET /api/profiles/company/:id/billing ─────────────────────────────────────

router.get(
  "/company/:id/billing",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const [company] = await db
        .select({ billingNotes: crmCompanies.billingNotes, serviceTier: crmCompanies.serviceTier, carePlanStatus: crmCompanies.carePlanStatus })
        .from(crmCompanies)
        .where(eq(crmCompanies.id, companyId))
        .limit(1);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const [stripeCustomer] = await db
        .select()
        .from(stripeCustomers)
        .where(and(eq(stripeCustomers.entityType, "company"), eq(stripeCustomers.entityId, companyId)))
        .limit(1);

      let recentEvents: unknown[] = [];
      if (stripeCustomer) {
        recentEvents = await db
          .select()
          .from(stripeWebhookEvents)
          .where(eq(stripeWebhookEvents.processed, true))
          .orderBy(desc(stripeWebhookEvents.createdAt))
          .limit(5);
      }

      return res.json({
        billingNotes: company.billingNotes,
        serviceTier: company.serviceTier,
        carePlanStatus: company.carePlanStatus,
        stripeCustomer: stripeCustomer ?? null,
        recentEvents,
      });
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── GET /api/profiles/company/:id/activity ────────────────────────────────────

router.get(
  "/company/:id/activity",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 200) : 50;
      const events = await getHistory("client", companyId, limit);
      return res.json(events);
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Company sub-resource WRITES
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/profiles/company/:id/notes ──────────────────────────────────────

router.post(
  "/company/:id/notes",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const validated = createNoteSchema.parse(req.body);

      const [note] = await db.insert(clientNotes).values({
        companyId,
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
        metadata: { companyId, type: note.type },
        ipAddress: req.ip,
      });

      appendHistorySafe({
        entityType: "client",
        entityId: companyId,
        event: "note_added",
        note: `[${note.type}] ${note.content.slice(0, 120)}`,
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });

      return res.status(201).json(note);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── DELETE /api/profiles/company/:id/notes/:noteId ────────────────────────────

router.delete(
  "/company/:id/notes/:noteId",
  requireRole("admin", "developer"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const noteId = req.params.noteId;

      const [existing] = await db
        .select()
        .from(clientNotes)
        .where(and(eq(clientNotes.id, noteId), eq(clientNotes.companyId, companyId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Note not found" });

      await db.delete(clientNotes).where(and(eq(clientNotes.id, noteId), eq(clientNotes.companyId, companyId)));

      appendHistorySafe({
        entityType: "client",
        entityId: companyId,
        event: "note_deleted",
        note: `[${existing.type}] ${existing.content.slice(0, 120)}`,
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });

      return res.status(204).end();
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── POST /api/profiles/company/:id/contacts ───────────────────────────────────

router.post(
  "/company/:id/contacts",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const validated = contactSchema.parse(req.body);

      if (validated.isPrimary) {
        await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, companyId));
      }

      const [contact] = await db.insert(crmContacts).values({
        companyId,
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
        metadata: { companyId },
        ipAddress: req.ip,
      });

      appendHistorySafe({
        entityType: "client",
        entityId: companyId,
        event: "contact_added",
        note: `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}${contact.email ? " (" + contact.email + ")" : ""}`,
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });

      return res.status(201).json(contact);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/company/:id/contacts/:contactId ───────────────────────

router.patch(
  "/company/:id/contacts/:contactId",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const contactId = req.params.contactId;
      const validated = contactSchema.partial().parse(req.body);

      const [existingContact] = await db.select().from(crmContacts).where(eq(crmContacts.id, contactId)).limit(1);
      const oldFullName = existingContact
        ? `${existingContact.firstName}${existingContact.lastName ? " " + existingContact.lastName : ""}`
        : "";

      if (validated.isPrimary) {
        await db.update(crmContacts).set({ isPrimary: false }).where(eq(crmContacts.companyId, companyId));
      }

      const [contact] = await db.update(crmContacts).set(validated).where(eq(crmContacts.id, contactId)).returning();
      const newFullName = `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}`;

      if (oldFullName !== newFullName) {
        const leads = await db.select({ id: crmLeads.id, title: crmLeads.title })
          .from(crmLeads).where(eq(crmLeads.contactId, contactId));
        for (const lead of leads) {
          if (lead.title && lead.title.includes(oldFullName)) {
            await db.update(crmLeads).set({ title: lead.title.replace(oldFullName, newFullName) }).where(eq(crmLeads.id, lead.id));
          }
        }
        const opps = await db
          .select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
          .from(pipelineOpportunities).where(eq(pipelineOpportunities.contactId, contactId));
        for (const opp of opps) {
          const u: Record<string, string> = {};
          if (opp.title.includes(oldFullName)) u.title = opp.title.replace(oldFullName, newFullName);
          if (opp.sourceLeadTitle?.includes(oldFullName)) u.sourceLeadTitle = opp.sourceLeadTitle.replace(oldFullName, newFullName);
          if (Object.keys(u).length > 0) {
            await db.update(pipelineOpportunities).set(u).where(eq(pipelineOpportunities.id, opp.id));
          }
        }
      }

      await logAudit({
        userId: req.authUser?.id,
        action: "client_contact_updated",
        entity: "crm_contact",
        entityId: contactId,
        metadata: { companyId },
        ipAddress: req.ip,
      });

      type ContactKey = keyof typeof validated;
      const contactKeys: ContactKey[] = ["firstName", "lastName", "email", "phone", "title", "preferredLanguage", "isPrimary"];
      const changedFields = contactKeys.filter((k) => k in validated && existingContact?.[k] !== validated[k]);
      if (changedFields.length > 0) {
        appendHistorySafe({
          entityType: "client",
          entityId: companyId,
          event: "contact_updated",
          note: `${newFullName}: ${changedFields.join(", ")} updated`,
          actorId: req.authUser?.id,
          actorName: req.authUser?.name,
        });
      }

      return res.json(contact);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── POST /api/profiles/company/:id/tasks ──────────────────────────────────────

router.post(
  "/company/:id/tasks",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const [company] = await db.select({ id: crmCompanies.id }).from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const validated = createTaskSchema.parse(req.body);
      const [task] = await db.insert(followupTasks).values({
        title: validated.title,
        notes: validated.notes ?? null,
        taskType: validated.taskType,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(validated.dueDate)
          ? new Date(validated.dueDate + "T00:00:00Z")
          : new Date(validated.dueDate),
        companyId,
        assignedTo: validated.assignedTo ?? null,
        createdBy: req.authUser?.id,
        completed: false,
      }).returning();

      await logAudit({
        userId: req.authUser?.id,
        action: "client_task_created",
        entity: "followup_task",
        entityId: task.id,
        metadata: { companyId, title: task.title, dueDate: task.dueDate },
        ipAddress: req.ip,
      });

      appendHistorySafe({
        entityType: "client",
        entityId: companyId,
        event: "task_created",
        note: `${task.title} [${task.taskType}]`,
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });

      return res.status(201).json(task);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PUT /api/profiles/company/:id/tasks/:taskId/complete ──────────────────────

router.put(
  "/company/:id/tasks/:taskId/complete",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const taskId = req.params.taskId;

      const [existing] = await db
        .select()
        .from(followupTasks)
        .where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)))
        .limit(1);
      if (!existing) return res.status(404).json({ message: "Task not found" });

      const nowCompleted = !existing.completed;
      const outcome = req.body?.outcome as string | undefined;
      const completionNote = req.body?.completionNote as string | undefined;

      const updateFields: Record<string, unknown> = {
        completed: nowCompleted,
        completedAt: nowCompleted ? new Date() : null,
      };
      if (nowCompleted && outcome) updateFields.outcome = outcome;
      if (nowCompleted && completionNote) updateFields.completionNote = completionNote;
      if (!nowCompleted) { updateFields.outcome = null; updateFields.completionNote = null; }

      const [task] = await db
        .update(followupTasks)
        .set(updateFields)
        .where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)))
        .returning();

      await logAudit({
        userId: req.authUser?.id,
        action: nowCompleted ? "client_task_completed" : "client_task_reopened",
        entity: "followup_task",
        entityId: taskId,
        metadata: { companyId, title: task.title },
        ipAddress: req.ip,
      });

      const noteParts = [task.title, `[${task.taskType}]`];
      if (nowCompleted && outcome) noteParts.push(`Outcome: ${outcome}`);
      if (nowCompleted && completionNote) noteParts.push(`Note: ${completionNote}`);
      appendHistorySafe({
        entityType: "client",
        entityId: companyId,
        event: nowCompleted ? "task_completed" : "task_reopened",
        note: noteParts.join(" · "),
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });

      return res.json(task);
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── DELETE /api/profiles/company/:id/tasks/:taskId ────────────────────────────

router.delete(
  "/company/:id/tasks/:taskId",
  requireRole("admin", "developer"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const taskId = req.params.taskId;

      const [existingTask] = await db
        .select()
        .from(followupTasks)
        .where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)))
        .limit(1);
      if (!existingTask) return res.status(404).json({ message: "Task not found" });

      await db.delete(followupTasks).where(and(eq(followupTasks.id, taskId), eq(followupTasks.companyId, companyId)));

      await logAudit({
        userId: req.authUser?.id,
        action: "client_task_deleted",
        entity: "followup_task",
        entityId: taskId,
        metadata: { companyId },
        ipAddress: req.ip,
      });

      appendHistorySafe({
        entityType: "client",
        entityId: companyId,
        event: "task_deleted",
        note: existingTask.title,
        actorId: req.authUser?.id,
        actorName: req.authUser?.name,
      });

      return res.status(204).end();
    } catch (err: unknown) {
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/company/:id/account ───────────────────────────────────

router.patch(
  "/company/:id/account",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const [existing] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Company not found" });

      const validated = updateAccountHealthSchema.parse(req.body);
      const [updated] = await db.update(crmCompanies).set({ ...validated, updatedAt: new Date() }).where(eq(crmCompanies.id, companyId)).returning();

      await logAudit({
        userId: req.authUser?.id,
        action: "client_account_updated",
        entity: "crm_company",
        entityId: companyId,
        metadata: { changes: validated },
        ipAddress: req.ip,
      });

      const actor = { actorId: req.authUser?.id, actorName: req.authUser?.name };
      const fieldLabels: Record<string, string> = {
        launchDate: "Launch date",
        renewalDate: "Renewal date",
        websiteStatus: "Website status",
        carePlanStatus: "Care plan status",
        serviceTier: "Service tier",
        billingNotes: "Billing notes",
      };

      for (const key of Object.keys(fieldLabels) as Array<keyof typeof validated>) {
        if (!(key in validated)) continue;
        const fmt = (v: unknown): string => {
          if (v === null || v === undefined) return "";
          if (v instanceof Date) return v.toISOString().split("T")[0];
          return String(v);
        };
        const oldStr = fmt(existing[key]);
        const newStr = fmt(validated[key]);
        if (oldStr !== newStr) {
          const event = key === "serviceTier" ? "service_tier_changed" as const : "field_updated" as const;
          appendHistorySafe({ entityType: "client", entityId: companyId, event, fieldName: fieldLabels[key], fromValue: oldStr || null, toValue: newStr || null, ...actor });
        }
      }

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/company/:id ───────────────────────────────────────────

router.patch(
  "/company/:id",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const [existing] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Company not found" });

      const validated = updateClientSchema.parse(req.body);
      if (validated.website && !/^https?:\/\//i.test(validated.website)) {
        validated.website = `https://${validated.website}`;
      }
      const [updated] = await db.update(crmCompanies).set(validated).where(eq(crmCompanies.id, companyId)).returning();

      if (validated.name && validated.name !== existing.name) {
        const leads = await db.select({ id: crmLeads.id, title: crmLeads.title }).from(crmLeads).where(eq(crmLeads.companyId, companyId));
        for (const lead of leads) {
          if (lead.title && lead.title.includes(existing.name)) {
            await db.update(crmLeads).set({ title: lead.title.replace(existing.name, validated.name!) }).where(eq(crmLeads.id, lead.id));
          }
        }
        const opps = await db
          .select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
          .from(pipelineOpportunities).where(eq(pipelineOpportunities.companyId, companyId));
        for (const opp of opps) {
          const u: Record<string, string> = {};
          if (opp.title.includes(existing.name)) u.title = opp.title.replace(existing.name, validated.name!);
          if (opp.sourceLeadTitle?.includes(existing.name)) u.sourceLeadTitle = opp.sourceLeadTitle.replace(existing.name, validated.name!);
          if (Object.keys(u).length > 0) {
            await db.update(pipelineOpportunities).set(u).where(eq(pipelineOpportunities.id, opp.id));
          }
        }
      }

      await logAudit({
        userId: req.authUser?.id,
        action: "client_updated",
        entity: "crm_company",
        entityId: companyId,
        metadata: { changes: validated },
        ipAddress: req.ip,
      });

      const actor = req.authUser ? { actorId: req.authUser.id, actorName: req.authUser.name } : {};

      if (validated.clientStatus !== undefined && validated.clientStatus !== existing.clientStatus) {
        appendHistorySafe({
          entityType: "client",
          entityId: companyId,
          event: "status_changed",
          fieldName: "clientStatus",
          fromValue: (existing.clientStatus as string) ?? null,
          toValue: (validated.clientStatus as string) ?? null,
          ...actor,
        });
      }

      if (validated.accountOwnerId !== undefined && validated.accountOwnerId !== existing.accountOwnerId) {
        const ownerIds = [existing.accountOwnerId, validated.accountOwnerId].filter(Boolean) as string[];
        let ownerNames: Record<string, string> = {};
        if (ownerIds.length > 0) {
          const owners = await db.select({ id: user.id, name: user.name }).from(user).where(
            ownerIds.length === 1 ? eq(user.id, ownerIds[0]) : or(eq(user.id, ownerIds[0]), eq(user.id, ownerIds[1]))!
          );
          for (const o of owners) ownerNames[o.id] = o.name;
        }
        const oldName = existing.accountOwnerId ? (ownerNames[existing.accountOwnerId] ?? existing.accountOwnerId) : null;
        const newName = validated.accountOwnerId ? (ownerNames[validated.accountOwnerId] ?? validated.accountOwnerId) : null;
        appendHistorySafe({
          entityType: "client",
          entityId: companyId,
          event: "owner_changed",
          fieldName: "accountOwnerId",
          fromValue: oldName,
          toValue: newName,
          ...actor,
        });
      }

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Lead sub-resource WRITES (for useProfileMutations with lead entry)
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/profiles/lead/:id/notes ─────────────────────────────────────────

router.post(
  "/lead/:id/notes",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const leadId = req.params.id;
      const [lead] = await db.select({ id: crmLeads.id }).from(crmLeads).where(eq(crmLeads.id, leadId)).limit(1);
      if (!lead) return res.status(404).json({ message: "Lead not found" });

      const validated = leadNoteSchema.parse(req.body);
      const [note] = await db.insert(crmLeadNotes).values({
        leadId,
        userId: req.authUser?.id,
        type: validated.type ?? "note",
        content: validated.content,
      }).returning();

      await logAudit({
        userId: req.authUser?.id,
        action: "lead_note_added",
        entity: "crm_lead_note",
        entityId: note.id,
        metadata: { leadId },
        ipAddress: req.ip,
      });

      return res.status(201).json(note);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Opportunity sub-resource WRITES (for useProfileMutations with opportunity entry)
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/profiles/opportunity/:id/notes ──────────────────────────────────

router.post(
  "/opportunity/:id/notes",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const opportunityId = req.params.id;
      const [opp] = await db.select({ id: pipelineOpportunities.id }).from(pipelineOpportunities).where(eq(pipelineOpportunities.id, opportunityId)).limit(1);
      if (!opp) return res.status(404).json({ message: "Opportunity not found" });

      const validated = opportunityNoteSchema.parse(req.body);
      const [activity] = await db.insert(pipelineActivities).values({
        opportunityId,
        userId: req.authUser?.id,
        type: validated.type ?? "note",
        content: validated.content,
      }).returning();

      await logAudit({
        userId: req.authUser?.id,
        action: "opportunity_activity_added",
        entity: "pipeline_activity",
        entityId: activity.id,
        metadata: { opportunityId },
        ipAddress: req.ip,
      });

      return res.status(201).json(activity);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Cross-domain profile mutations (owner, status) — type-parametric
// ─────────────────────────────────────────────────────────────────────────────

// ── PATCH /api/profiles/company/:id/owner ─────────────────────────────────────

router.patch(
  "/company/:id/owner",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const { userId: newOwnerId } = assignOwnerSchema.parse(req.body);

      const [existing] = await db.select({ accountOwnerId: crmCompanies.accountOwnerId }).from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Company not found" });

      const [updated] = await db.update(crmCompanies).set({ accountOwnerId: newOwnerId }).where(eq(crmCompanies.id, companyId)).returning();

      await logAudit({ userId: req.authUser?.id, action: "client_owner_assigned", entity: "crm_company", entityId: companyId, metadata: { newOwnerId }, ipAddress: req.ip });
      appendHistorySafe({ entityType: "client", entityId: companyId, event: "owner_changed", fieldName: "accountOwnerId", fromValue: existing.accountOwnerId ?? null, toValue: newOwnerId, actorId: req.authUser?.id, actorName: req.authUser?.name });

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/lead/:id/owner ───────────────────────────────────────

router.patch(
  "/lead/:id/owner",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const leadId = req.params.id;
      const { userId: newOwnerId } = assignOwnerSchema.parse(req.body);

      const [existing] = await db.select({ assignedTo: crmLeads.assignedTo }).from(crmLeads).where(eq(crmLeads.id, leadId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Lead not found" });

      const [updated] = await db.update(crmLeads).set({ assignedTo: newOwnerId }).where(eq(crmLeads.id, leadId)).returning();

      await logAudit({ userId: req.authUser?.id, action: "lead_owner_assigned", entity: "crm_lead", entityId: leadId, metadata: { newOwnerId }, ipAddress: req.ip });

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/opportunity/:id/owner ─────────────────────────────────

router.patch(
  "/opportunity/:id/owner",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const opportunityId = req.params.id;
      const { userId: newOwnerId } = assignOwnerSchema.parse(req.body);

      const [existing] = await db.select({ assignedTo: pipelineOpportunities.assignedTo }).from(pipelineOpportunities).where(eq(pipelineOpportunities.id, opportunityId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Opportunity not found" });

      const [updated] = await db.update(pipelineOpportunities).set({ assignedTo: newOwnerId }).where(eq(pipelineOpportunities.id, opportunityId)).returning();

      await logAudit({ userId: req.authUser?.id, action: "opportunity_owner_assigned", entity: "pipeline_opportunity", entityId: opportunityId, metadata: { newOwnerId }, ipAddress: req.ip });

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/company/:id/status ────────────────────────────────────

router.patch(
  "/company/:id/status",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const companyId = req.params.id;
      const { statusId } = updateStatusSchema.parse(req.body);

      const allowedStatuses = ["active", "inactive", "at_risk", "churned", "prospect"];
      if (!allowedStatuses.includes(statusId)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${allowedStatuses.join(", ")}` });
      }

      const [existing] = await db.select({ clientStatus: crmCompanies.clientStatus }).from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Company not found" });

      const [updated] = await db.update(crmCompanies).set({ clientStatus: statusId }).where(eq(crmCompanies.id, companyId)).returning();

      await logAudit({ userId: req.authUser?.id, action: "client_status_updated", entity: "crm_company", entityId: companyId, metadata: { from: existing.clientStatus, to: statusId }, ipAddress: req.ip });
      appendHistorySafe({ entityType: "client", entityId: companyId, event: "status_changed", fieldName: "clientStatus", fromValue: existing.clientStatus ?? null, toValue: statusId, actorId: req.authUser?.id, actorName: req.authUser?.name });

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/lead/:id/status ──────────────────────────────────────

router.patch(
  "/lead/:id/status",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const leadId = req.params.id;
      const { statusId } = updateStatusSchema.parse(req.body);

      const [existing] = await db.select({ statusId: crmLeads.statusId }).from(crmLeads).where(eq(crmLeads.id, leadId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Lead not found" });

      const [updated] = await db.update(crmLeads).set({ statusId }).where(eq(crmLeads.id, leadId)).returning();

      await logAudit({ userId: req.authUser?.id, action: "lead_status_updated", entity: "crm_lead", entityId: leadId, metadata: { from: existing.statusId, to: statusId }, ipAddress: req.ip });

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

// ── PATCH /api/profiles/opportunity/:id/status ────────────────────────────────

router.patch(
  "/opportunity/:id/status",
  requireRole("admin", "developer", "sales_rep"),
  async (req: Request, res: Response) => {
    try {
      const opportunityId = req.params.id;
      const { statusId } = updateStatusSchema.parse(req.body);

      const [existing] = await db.select({ stageId: pipelineOpportunities.stageId }).from(pipelineOpportunities).where(eq(pipelineOpportunities.id, opportunityId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Opportunity not found" });

      const [updated] = await db.update(pipelineOpportunities).set({ stageId: statusId }).where(eq(pipelineOpportunities.id, opportunityId)).returning();

      await logAudit({ userId: req.authUser?.id, action: "opportunity_stage_updated", entity: "pipeline_opportunity", entityId: opportunityId, metadata: { from: existing.stageId, to: statusId }, ipAddress: req.ip });

      return res.json(updated);
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      return sendProfileError(res, err);
    }
  },
);

export default router;
