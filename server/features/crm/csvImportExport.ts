import { parseCSV, generateCSV, type ImportResult, type ImportRowResult } from "../../lib/csv";
import {
  getLeads,
  enrichLeads,
  findContactByEmail,
  findContactByPhone,
  findCompanyByName,
  createLead,
  createContact,
  createCompany,
} from "./storage";
import { db } from "../../db";
import { crmContacts, crmCompanies } from "@shared/schema";
import { asc, inArray } from "drizzle-orm";
import type { CrmContact, CrmCompany } from "@shared/schema";

const LEAD_EXPORT_HEADERS = [
  "id", "title", "source", "value", "notes", "status",
  "contact_first_name", "contact_last_name", "contact_email", "contact_phone",
  "company_name", "company_website", "assigned_to", "created_at",
];

const CONTACT_EXPORT_HEADERS = [
  "id", "first_name", "last_name", "email", "phone", "alt_phone",
  "title", "company_name", "preferred_language", "notes", "created_at",
];

export async function exportLeadsToCSV(): Promise<string> {
  const result = await getLeads({ limit: 10000, page: 1 });
  const enriched = await enrichLeads(result.items);

  const rows = enriched.map((lead) => [
    lead.id,
    lead.title,
    lead.source ?? "",
    lead.value ?? "",
    lead.notes ?? "",
    lead.status?.name ?? "",
    lead.contact?.firstName ?? "",
    lead.contact?.lastName ?? "",
    lead.contact?.email ?? "",
    lead.contact?.phone ?? "",
    lead.company?.name ?? "",
    lead.company?.website ?? "",
    lead.assignedTo ?? "",
    lead.createdAt ? new Date(lead.createdAt).toISOString().split("T")[0] : "",
  ]);

  return generateCSV(LEAD_EXPORT_HEADERS, rows);
}

export async function exportContactsToCSV(): Promise<string> {
  const allContacts = await db
    .select()
    .from(crmContacts)
    .orderBy(asc(crmContacts.createdAt));

  if (allContacts.length === 0) return generateCSV(CONTACT_EXPORT_HEADERS, []);

  const companyIds = Array.from(
    new Set(allContacts.map((c) => c.companyId).filter((id): id is string => id !== null))
  );

  const companies: Pick<CrmCompany, "id" | "name">[] =
    companyIds.length > 0
      ? await db
          .select({ id: crmCompanies.id, name: crmCompanies.name })
          .from(crmCompanies)
          .where(inArray(crmCompanies.id, companyIds))
      : [];

  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  const rows = allContacts.map((c) => [
    c.id,
    c.firstName,
    c.lastName ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.altPhone ?? "",
    c.title ?? "",
    c.companyId ? (companyMap[c.companyId] ?? "") : "",
    c.preferredLanguage ?? "es",
    c.notes ?? "",
    c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : "",
  ]);

  return generateCSV(CONTACT_EXPORT_HEADERS, rows);
}

export async function importLeadsFromCSV(csvText: string): Promise<ImportResult> {
  const { headers, rows } = parseCSV(csvText);

  if (!headers.includes("title")) {
    throw new Error('CSV must include a "title" column. Got: ' + headers.join(", "));
  }

  const details: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const titleRaw = row["title"]?.trim();
    if (!titleRaw) {
      details.push({ row: rowNum, status: "error", reason: 'Missing required field: "title"' });
      continue;
    }

    const valueRaw = row["value"]?.trim();
    let value: string | null = null;
    if (valueRaw) {
      const num = parseFloat(valueRaw.replace(/[$,\s]/g, ""));
      if (isNaN(num)) {
        details.push({ row: rowNum, status: "error", reason: `"value" must be a number, got: "${valueRaw}"` });
        continue;
      }
      value = String(num);
    }

    try {
      let companyId: string | null = null;
      const companyName = row["company_name"]?.trim();
      if (companyName) {
        const existing = await findCompanyByName(companyName);
        if (existing) {
          companyId = existing.id;
        } else {
          const website = row["company_website"]?.trim() || null;
          const created = await createCompany({ name: companyName, website });
          companyId = created.id;
        }
      }

      let contactId: string | null = null;
      const contactEmail = row["contact_email"]?.trim().toLowerCase() || null;
      const contactPhone = row["contact_phone"]?.trim() || null;
      const contactFirstName = row["contact_first_name"]?.trim() || null;
      const contactLastName = row["contact_last_name"]?.trim() || null;

      if (contactEmail) {
        const existing = await findContactByEmail(contactEmail);
        if (existing) {
          contactId = existing.id;
        } else if (contactFirstName) {
          const created = await createContact({
            firstName: contactFirstName,
            lastName: contactLastName,
            email: contactEmail,
            phone: contactPhone,
            companyId,
          });
          contactId = created.id;
        }
      } else if (contactPhone) {
        const existing = await findContactByPhone(contactPhone);
        if (existing) {
          contactId = existing.id;
        } else if (contactFirstName) {
          const created = await createContact({
            firstName: contactFirstName,
            lastName: contactLastName,
            phone: contactPhone,
            companyId,
          });
          contactId = created.id;
        }
      } else if (contactFirstName) {
        const created = await createContact({
          firstName: contactFirstName,
          lastName: contactLastName,
          companyId,
        });
        contactId = created.id;
      }

      const source = row["source"]?.trim() || null;
      const notes = row["notes"]?.trim() || null;

      const lead = await createLead({
        title: titleRaw,
        source,
        value,
        notes,
        companyId,
        contactId,
      });

      details.push({ row: rowNum, status: "imported", id: lead.id, name: lead.title });
    } catch (err: any) {
      details.push({ row: rowNum, status: "error", reason: err.message ?? "Unknown error" });
    }
  }

  return {
    imported: details.filter((d) => d.status === "imported").length,
    skipped: details.filter((d) => d.status === "skipped").length,
    errors: details.filter((d) => d.status === "error").length,
    details,
  };
}

export async function importContactsFromCSV(csvText: string): Promise<ImportResult> {
  const { headers, rows } = parseCSV(csvText);

  if (!headers.includes("first_name")) {
    throw new Error('CSV must include a "first_name" column. Got: ' + headers.join(", "));
  }

  const details: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const firstNameRaw = row["first_name"]?.trim();
    if (!firstNameRaw) {
      details.push({ row: rowNum, status: "error", reason: 'Missing required field: "first_name"' });
      continue;
    }

    try {
      const email = row["email"]?.trim().toLowerCase() || null;
      if (email) {
        const existing = await findContactByEmail(email);
        if (existing) {
          details.push({
            row: rowNum,
            status: "skipped",
            reason: `Contact with email "${email}" already exists`,
            id: existing.id,
            name: `${existing.firstName} ${existing.lastName ?? ""}`.trim(),
          });
          continue;
        }
      }

      let companyId: string | null = null;
      const companyName = row["company_name"]?.trim();
      if (companyName) {
        const existing = await findCompanyByName(companyName);
        if (existing) {
          companyId = existing.id;
        } else {
          const created = await createCompany({ name: companyName });
          companyId = created.id;
        }
      }

      const contact = await createContact({
        firstName: firstNameRaw,
        lastName: row["last_name"]?.trim() || null,
        email,
        phone: row["phone"]?.trim() || null,
        altPhone: row["alt_phone"]?.trim() || null,
        title: row["title"]?.trim() || null,
        preferredLanguage: row["preferred_language"]?.trim() || "es",
        notes: row["notes"]?.trim() || null,
        companyId,
      });

      details.push({
        row: rowNum,
        status: "imported",
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName ?? ""}`.trim(),
      });
    } catch (err: any) {
      details.push({ row: rowNum, status: "error", reason: err.message ?? "Unknown error" });
    }
  }

  return {
    imported: details.filter((d) => d.status === "imported").length,
    skipped: details.filter((d) => d.status === "skipped").length,
    errors: details.filter((d) => d.status === "error").length,
    details,
  };
}
