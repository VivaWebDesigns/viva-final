/**
 * DEV-ONLY: Sample data utility for manual developer use.
 * This file is NOT connected to any API endpoint or server startup.
 * To use: import and call seedFullDatabase() from a one-off script only.
 * NEVER auto-run this file in production or on startup.
 */
import * as crmStorage from "./storage";
import * as pipelineStorage from "../pipeline/storage";
import * as onboardingStorage from "../onboarding/storage";
import { db } from "../../db";
import { user as userTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const CLIENTS = [
  { name: "Rivera Painting LLC",  industry: "Painting",    contact: { first: "Carlos",  last: "Rivera",    phone: "(704) 555-0101", email: "carlos@riverapainting.com"  }, leadTitle: "Painting Website – Domina",   value: "2400", status: "qualified", stage: "new-lead",       pkg: "domina"  },
  { name: "Garcia Plumbing",      industry: "Plumbing",    contact: { first: "Maria",   last: "Garcia",    phone: "(704) 555-0102", email: "maria@garciaplumbing.com"    }, leadTitle: "Plumbing Website – Crece",    value: "1600", status: "contacted", stage: "contacted",      pkg: "crece"   },
  { name: "Lopez Landscaping",    industry: "Landscaping", contact: { first: "Jose",    last: "Lopez",     phone: "(980) 555-0103", email: "jose@lopezlandscaping.com"   }, leadTitle: "Landscaping Site – Domina",  value: "2400", status: "won",       stage: "closed-won",     pkg: "domina",  onboard: true },
  { name: "Hernandez HVAC",       industry: "HVAC",        contact: { first: "Ana",     last: "Hernandez", phone: "(704) 555-0104", email: "ana@hernandezhvac.com"       }, leadTitle: "HVAC Website – Empieza",     value: "900",  status: "new",       stage: "new-lead"                          },
  { name: "Martinez Electrical",  industry: "Electrical",  contact: { first: "Luis",    last: "Martinez",  phone: "(980) 555-0105", email: "luis@martinezelectric.com"   }, leadTitle: "Electrical Site – Crece",    value: "1600", status: "contacted", stage: "demo-scheduled", pkg: "crece"   },
  { name: "Torres Roofing",       industry: "Roofing",     contact: { first: "Rosa",    last: "Torres",    phone: "(704) 555-0106", email: "rosa@torresroofing.com"      }, leadTitle: "Roofing Site – Domina",      value: "2400", status: "proposal",  stage: "demo-completed", pkg: "domina"  },
  { name: "Reyes Cleaning",       industry: "Cleaning",    contact: { first: "Pedro",   last: "Reyes",     phone: "(980) 555-0107", email: "pedro@reyescleaning.com"     }, leadTitle: "Cleaning Website – Empieza", value: "900",  status: "won",       stage: "closed-won",     pkg: "empieza", onboard: true },
  { name: "Sanchez Concrete",     industry: "Concrete",    contact: { first: "Carmen",  last: "Sanchez",   phone: "(704) 555-0108", email: "carmen@sanchezconcrete.com"  }, leadTitle: "Concrete Site – Crece",      value: "1600", status: "qualified", stage: "payment-sent",   pkg: "crece"   },
  { name: "Morales Carpentry",    industry: "Carpentry",   contact: { first: "Jorge",   last: "Morales",   phone: "(980) 555-0109", email: "jorge@moralescarpentry.com"  }, leadTitle: "Carpentry Website – Domina", value: "2400", status: "new",       stage: "new-lead"                          },
  { name: "Flores Tree Service",  industry: "Tree Service",contact: { first: "Elena",   last: "Flores",    phone: "(704) 555-0110", email: "elena@florestrees.com"       }, leadTitle: "Tree Service – Crece",       value: "1600", status: "contacted", stage: "contacted"                         },
  { name: "Vargas Tile & Stone",  industry: "Tile",        contact: { first: "Miguel",  last: "Vargas",    phone: "(980) 555-0111", email: "miguel@vargas-tile.com"      }, leadTitle: "Tile Website – Domina",      value: "2400", status: "won",       stage: "closed-won",     pkg: "domina",  onboard: true },
  { name: "Cruz Auto Detailing",  industry: "Auto",        contact: { first: "Isabel",  last: "Cruz",      phone: "(704) 555-0112", email: "isabel@cruzdetail.com"       }, leadTitle: "Auto Detail – Empieza",      value: "900",  status: "lost",      stage: "closed-lost"                       },
  { name: "Mendoza Fencing",      industry: "Fencing",     contact: { first: "Roberto", last: "Mendoza",   phone: "(980) 555-0113", email: "roberto@mendozafencing.com"  }, leadTitle: "Fencing Site – Crece",       value: "1600", status: "won",       stage: "closed-won",     pkg: "crece",   onboard: true },
  { name: "Ramirez Pest Control", industry: "Pest Control",contact: { first: "Diana",   last: "Ramirez",   phone: "(704) 555-0114", email: "diana@ramirezpest.com"       }, leadTitle: "Pest Control – Empieza",     value: "900",  status: "qualified", stage: "demo-scheduled"                    },
  { name: "Gutierrez Masonry",    industry: "Masonry",     contact: { first: "Hector",  last: "Gutierrez", phone: "(980) 555-0115", email: "hector@gutierrezmasonry.com" }, leadTitle: "Masonry Website – Domina",   value: "2400", status: "contacted", stage: "demo-completed", pkg: "domina"  },
  { name: "Jimenez Irrigation",   industry: "Irrigation",  contact: { first: "Lucia",   last: "Jimenez",   phone: "(704) 555-0116", email: "lucia@jimenezirrig.com"      }, leadTitle: "Irrigation Site – Crece",    value: "1600", status: "new",       stage: "new-lead"                          },
  { name: "Castillo Windows",     industry: "Windows",     contact: { first: "Fernando",last: "Castillo",  phone: "(980) 555-0117", email: "fernando@castillowin.com"    }, leadTitle: "Windows & Doors – Empieza",  value: "900",  status: "proposal",  stage: "payment-sent",   pkg: "empieza" },
  { name: "Medina Pool Service",  industry: "Pool",        contact: { first: "Gloria",  last: "Medina",    phone: "(704) 555-0118", email: "gloria@medinapool.com"       }, leadTitle: "Pool Service – Domina",      value: "2400", status: "won",       stage: "closed-won",     pkg: "domina",  onboard: true },
  { name: "Soto Drywall",         industry: "Drywall",     contact: { first: "Oscar",   last: "Soto",      phone: "(980) 555-0119", email: "oscar@sotodrywall.com"       }, leadTitle: "Drywall Website – Crece",    value: "1600", status: "qualified", stage: "contacted"                         },
  { name: "Aguilar Gutter Co",    industry: "Gutters",     contact: { first: "Silvia",  last: "Aguilar",   phone: "(704) 555-0120", email: "silvia@aguilargutter.com"    }, leadTitle: "Gutter Website – Empieza",   value: "900",  status: "won",       stage: "closed-won",     pkg: "empieza", onboard: true },
];

export async function seedFullDatabase() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || process.env.VITE_DEV_ADMIN_EMAIL;
  const [admin] = adminEmail
    ? await db.select().from(userTable).where(eq(userTable.email, adminEmail))
    : [];
  const adminId = admin?.id || undefined;

  const templates = await onboardingStorage.getTemplates();
  const templateId = templates[0]?.id || null;

  for (const client of CLIENTS) {
    const company = await crmStorage.createCompany({
      name: client.name,
      industry: client.industry,
      email: client.contact.email,
    });

    const contact = await crmStorage.createContact({
      companyId: company.id,
      firstName: client.contact.first,
      lastName: client.contact.last,
      email: client.contact.email,
      phone: (client.contact as any).phone ?? null,
    });

    const status = await crmStorage.getLeadStatusBySlug(client.status);
    const lead = await crmStorage.createLead({
      companyId: company.id,
      contactId: contact.id,
      statusId: status?.id || null,
      title: client.leadTitle,
      value: client.value,
      source: "manual",
      assignedTo: adminId,
    });

    const stage = await pipelineStorage.getStageBySlug(client.stage);
    const opp = await pipelineStorage.convertLeadToOpportunity(lead.id, stage?.id || "", adminId, {
      title: client.leadTitle,
      value: client.value,
      assignedTo: adminId,
      websitePackage: (client as any).pkg ?? null,
    });

    if (client.onboard && templateId) {
      await pipelineStorage.updateOpportunity(opp.id, { status: "won" });
      await onboardingStorage.convertOpportunityToOnboarding(opp.id, templateId, adminId);
    }
  }
}
