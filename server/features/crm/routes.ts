import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as crmStorage from "./storage";
import {
  insertCrmCompanySchema, insertCrmContactSchema, insertCrmLeadSchema,
  insertCrmLeadNoteSchema, insertCrmTagSchema,
} from "@shared/schema";

const router = Router();

router.get("/leads", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { search, statusId, source, assignedTo, fromWebsiteForm, page, limit } = req.query;
    const result = await crmStorage.getLeads({
      search: search as string | undefined,
      statusId: statusId as string | undefined,
      source: source as string | undefined,
      assignedTo: assignedTo as string | undefined,
      fromWebsiteForm: fromWebsiteForm === "true" ? true : fromWebsiteForm === "false" ? false : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/leads", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmLeadSchema.parse(req.body);
    const lead = await crmStorage.createLead(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title },
      ipAddress: req.ip,
    });
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const lead = await crmStorage.getLeadById(id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });
  res.json(lead);
});

router.put("/leads/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getLeadById(id);
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    const lead = await crmStorage.updateLead(id, req.body);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title },
      ipAddress: req.ip,
    });
    res.json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id/notes", requireRole("admin", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const notes = await crmStorage.getLeadNotes(id);
  res.json(notes);
});

router.post("/leads/:id/notes", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const data = insertCrmLeadNoteSchema.parse({
      ...req.body,
      leadId: id,
      userId: req.authUser?.id || null,
    });
    const note = await crmStorage.addLeadNote(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead_note",
      entityId: note.id,
      metadata: { leadId: id, type: note.type },
      ipAddress: req.ip,
    });
    res.status(201).json(note);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id/tags", requireRole("admin", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const tags = await crmStorage.getLeadTags(id);
  res.json(tags);
});

router.put("/leads/:id/tags", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    await crmStorage.setLeadTags(id, req.body.tagIds || []);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_lead_tags",
      entityId: id,
      metadata: { tagIds: req.body.tagIds },
      ipAddress: req.ip,
    });
    res.json({ message: "Tags updated" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/companies", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await crmStorage.getCompanies({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/companies", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmCompanySchema.parse(req.body);
    const company = await crmStorage.createCompany(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_company",
      entityId: company.id,
      metadata: { name: company.name },
      ipAddress: req.ip,
    });
    res.status(201).json(company);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/companies/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const company = await crmStorage.getCompanyById(id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(company);
});

router.put("/companies/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getCompanyById(id);
    if (!existing) return res.status(404).json({ message: "Company not found" });
    const company = await crmStorage.updateCompany(id, req.body);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_company",
      entityId: company.id,
      metadata: { name: company.name },
      ipAddress: req.ip,
    });
    res.json(company);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/contacts", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await crmStorage.getContacts({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/contacts", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmContactSchema.parse(req.body);
    const contact = await crmStorage.createContact(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { name: `${contact.firstName} ${contact.lastName || ""}`.trim() },
      ipAddress: req.ip,
    });
    res.status(201).json(contact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/contacts/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const contact = await crmStorage.getContactById(id);
  if (!contact) return res.status(404).json({ message: "Contact not found" });
  res.json(contact);
});

router.put("/contacts/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getContactById(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    const contact = await crmStorage.updateContact(id, req.body);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { name: `${contact.firstName} ${contact.lastName || ""}`.trim() },
      ipAddress: req.ip,
    });
    res.json(contact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/statuses", requireRole("admin", "sales_rep"), async (_req, res) => {
  const statuses = await crmStorage.getLeadStatuses();
  res.json(statuses);
});

router.get("/tags", requireRole("admin", "sales_rep"), async (_req, res) => {
  const tags = await crmStorage.getTags();
  res.json(tags);
});

router.post("/tags", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmTagSchema.parse(req.body);
    const tag = await crmStorage.createTag(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_tag",
      entityId: tag.id,
      metadata: { name: tag.name },
      ipAddress: req.ip,
    });
    res.status(201).json(tag);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
