import * as crmStorage from "./storage";
import * as pipelineStorage from "../pipeline/storage";
import { executeStageAutomations } from "../automations/trigger";
import { logAudit } from "../audit/service";
import { notifyNewLead } from "../notifications/triggers";
import { normalizePhoneDigits } from "@shared/phone";
import type { UtmAttribution } from "@shared/schema";

interface WebsiteFormData {
  name: string;
  email?: string;
  phone: string;
  business?: string;
  city?: string;
  trade?: string;
  service?: string;
  message?: string;
  zipCode?: string;
}

interface IngestResult {
  leadId: string;
  contactId: string;
  companyId: string | null;
  isDuplicateContact: boolean;
}

export async function ingestWebsiteFormSubmission(
  formData: WebsiteFormData,
  attribution: UtmAttribution,
  sourceType: "contact_form" | "demo_inquiry" = "contact_form"
): Promise<IngestResult> {
  if (attribution.honeypot) {
    throw new Error("SPAM_DETECTED");
  }

  const normalizedPhone = formData.phone ? normalizePhoneDigits(formData.phone) : formData.phone;

  const nameParts = formData.name.trim().split(/\s+/);
  const firstName = nameParts[0] || formData.name;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

  let existingContact = null;
  let isDuplicateContact = false;

  if (formData.email) {
    existingContact = await crmStorage.findContactByEmail(formData.email);
  }
  if (!existingContact && normalizedPhone) {
    existingContact = await crmStorage.findContactByPhone(normalizedPhone);
  }

  let contact;
  if (existingContact) {
    isDuplicateContact = true;
    contact = existingContact;
    await crmStorage.updateContact(contact.id, {
      ...(normalizedPhone && !contact.phone ? { phone: normalizedPhone } : {}),
      ...(formData.email && !contact.email ? { email: formData.email } : {}),
    });
  } else {
    contact = await crmStorage.createContact({
      firstName,
      lastName,
      email: formData.email || null,
      phone: normalizedPhone,
      preferredLanguage: "es",
      notes: formData.message || null,
    });
  }

  let companyId: string | null = null;
  const businessName = formData.business?.trim();
  const companyLabel = businessName || `${firstName}${lastName ? " " + lastName : ""} (Personal)`;

  let company = businessName
    ? await crmStorage.findCompanyByName(businessName)
    : null;

  if (!company) {
    company = await crmStorage.createCompany({
      name: companyLabel,
      industry: formData.trade || null,
      city: formData.city || formData.zipCode || null,
      preferredLanguage: "es",
    });
  }
  companyId = company.id;

  if (!contact.companyId) {
    await crmStorage.updateContact(contact.id, { companyId: company.id });
  }

  let defaultStatus = await crmStorage.getDefaultLeadStatus();
  if (!defaultStatus) {
    defaultStatus = await crmStorage.getLeadStatusBySlug("new");
  }

  const sourceLabel = sourceType === "demo_inquiry" ? "Demo Site Inquiry" : "Website Contact Form";
  const leadTitle = businessName
    ? `${businessName} - ${firstName}${lastName ? " " + lastName : ""}`
    : `${firstName}${lastName ? " " + lastName : ""}`;

  const lead = await crmStorage.createLead({
    title: leadTitle,
    companyId,
    contactId: contact.id,
    statusId: defaultStatus?.id || null,
    source: sourceType,
    sourceLabel,
    utmSource: attribution.utmSource || null,
    utmMedium: attribution.utmMedium || null,
    utmCampaign: attribution.utmCampaign || null,
    utmTerm: attribution.utmTerm || null,
    utmContent: attribution.utmContent || null,
    referrer: attribution.referrer || null,
    landingPage: attribution.landingPage || null,
    formPageUrl: attribution.formPageUrl || null,
    fromWebsiteForm: true,
    notes: formData.message || null,
  });

  const noteDetails = [
    `Source: ${sourceLabel}`,
    formData.email ? `Email: ${formData.email}` : null,
    formData.phone ? `Phone: ${formData.phone}` : null,
    formData.city ? `City: ${formData.city}` : null,
    formData.trade ? `Trade: ${formData.trade}` : null,
    formData.service ? `Service: ${formData.service}` : null,
    isDuplicateContact ? "Note: Contact already existed in CRM (duplicate detected)" : null,
  ].filter(Boolean).join("\n");

  await crmStorage.addLeadNote({
    leadId: lead.id,
    type: "system",
    content: `Lead created from ${sourceLabel.toLowerCase()}.\n${noteDetails}`,
  });

  const newLeadStage = await pipelineStorage.getStageBySlug("new-lead");
  if (newLeadStage) {
    try {
      const opp = await pipelineStorage.createOpportunity({
        title: leadTitle,
        leadId: lead.id,
        companyId,
        contactId: contact.id,
        stageId: newLeadStage.id,
        status: "open",
        sourceLeadTitle: leadTitle,
        notes: formData.message || null,
      });
      executeStageAutomations({
        opportunityId: opp.id,
        leadId: lead.id,
        contactId: contact.id,
        companyId,
        stageSlug: "new-lead",
      }).catch((err: unknown) => {
        console.error("[crm/ingest] executeStageAutomations failed:", err);
      });
    } catch (oppErr) {
      console.error("[crm/ingest] opportunity creation failed:", oppErr);
    }
  }

  await logAudit({
    action: "crm_lead_created",
    entity: "crm_lead",
    entityId: lead.id,
    metadata: {
      source: sourceType,
      contactId: contact.id,
      companyId,
      isDuplicate: isDuplicateContact,
      utmSource: attribution.utmSource,
    },
  });

  try { notifyNewLead({ id: lead.id, title: lead.title, source: sourceType }); } catch (_) {}

  return {
    leadId: lead.id,
    contactId: contact.id,
    companyId,
    isDuplicateContact,
  };
}
