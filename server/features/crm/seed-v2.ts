import * as crmStorage from "./storage";
import * as pipelineStorage from "../pipeline/storage";
import * as onboardingStorage from "../onboarding/storage";
import { db } from "../../db";
import { user as userTable } from "@shared/schema";
import { eq } from "drizzle-orm";

const CLIENTS = [
  { name: "Acme Corp", industry: "Manufacturing", contact: { first: "John", last: "Doe", email: "john@acme.com" }, leadTitle: "Acme Website Redesign", value: "15000", status: "qualified", stage: "discovery" },
  { name: "Global Tech", industry: "Software", contact: { first: "Jane", last: "Smith", email: "jane@globaltech.io" }, leadTitle: "Global Tech SEO Campaign", value: "8000", status: "proposal", stage: "proposal" },
  { name: "Sunnyside Bakery", industry: "Food & Beverage", contact: { first: "Bob", last: "Baker", email: "bob@sunnyside.com" }, leadTitle: "E-commerce Shop for Bakery", value: "12000", status: "won", stage: "closed-won", onboard: true },
  { name: "Elite Law Firm", industry: "Legal", contact: { first: "Sarah", last: "Counsel", email: "sarah@elitelaw.com" }, leadTitle: "Legal Firm Landing Page", value: "5000", status: "new", stage: "discovery" },
  { name: "Green Energy Co", industry: "Renewables", contact: { first: "Alice", last: "Green", email: "alice@greenenergy.com" }, leadTitle: "Corporate Site for Green Energy", value: "25000", status: "contacted", stage: "negotiation" },
  { name: "Urban Fitness", industry: "Health", contact: { first: "Mike", last: "Iron", email: "mike@urbanfitness.com" }, leadTitle: "Gym Member Portal", value: "18000", status: "proposal", stage: "proposal" },
  { name: "Sparkle Cleaning", industry: "Services", contact: { first: "Lucy", last: "Clean", email: "lucy@sparkle.com" }, leadTitle: "Booking System for Cleaning", value: "9500", status: "won", stage: "closed-won", onboard: true },
  { name: "Tech Ventures", industry: "Finance", contact: { first: "David", last: "Investor", email: "david@techventures.vc" }, leadTitle: "Venture Capital Portfolio Site", value: "30000", status: "qualified", stage: "negotiation" },
  { name: "Cozy Coffee", industry: "Food & Beverage", contact: { first: "Emma", last: "Bean", email: "emma@cozycoffee.com" }, leadTitle: "Coffee Shop Mobile App", value: "22000", status: "new", stage: "discovery" },
  { name: "Blue Sky Travel", industry: "Tourism", contact: { first: "Tom", last: "Voyage", email: "tom@bluesky.com" }, leadTitle: "Travel Booking Platform", value: "45000", status: "contacted", stage: "proposal" },
  { name: "Rapid Logistics", industry: "Logistics", contact: { first: "Chris", last: "Speed", email: "chris@rapid.com" }, leadTitle: "Logistics Dashboard", value: "35000", status: "won", stage: "closed-won", onboard: true },
  { name: "Creative Studio", industry: "Design", contact: { first: "Mia", last: "Art", email: "mia@creativestudio.com" }, leadTitle: "Portfolio Site for Agency", value: "11000", status: "lost", stage: "closed-lost" },
  { name: "Prime Real Estate", industry: "Real Estate", contact: { first: "Kevin", last: "Home", email: "kevin@primerealestate.com" }, leadTitle: "Real Estate Listing Portal", value: "28000", status: "won", stage: "closed-won", onboard: true },
  { name: "Health First", industry: "Healthcare", contact: { first: "Dr. Amy", last: "Care", email: "amy@healthfirst.org" }, leadTitle: "Patient Management System", value: "55000", status: "qualified", stage: "discovery" },
  { name: "Bright Minds Tutor", industry: "Education", contact: { first: "Leo", last: "Learn", email: "leo@brightminds.edu" }, leadTitle: "Tutoring Platform Web App", value: "14000", status: "contacted", stage: "negotiation" },
  { name: "Style Icon", industry: "Fashion", contact: { first: "Chloe", last: "Chic", email: "chloe@styleicon.com" }, leadTitle: "Fashion Brand Webshop", value: "19000", status: "new", stage: "discovery" },
  { name: "Auto Pros", industry: "Automotive", contact: { first: "Gary", last: "Gear", email: "gary@autopros.com" }, leadTitle: "Auto Repair Booking", value: "7500", status: "proposal", stage: "proposal" },
  { name: "Pet Paradise", industry: "Pet Services", contact: { first: "Bella", last: "Bark", email: "bella@petparadise.com" }, leadTitle: "Pet Hotel Management", value: "13500", status: "won", stage: "closed-won", onboard: true },
  { name: "Smart Home Tech", industry: "IoT", contact: { first: "Jason", last: "Link", email: "jason@smarthome.io" }, leadTitle: "IoT Dashboard UI", value: "40000", status: "qualified", stage: "negotiation" },
  { name: "Fresh Blooms", industry: "Retail", contact: { first: "Rose", last: "Petal", email: "rose@freshblooms.com" }, leadTitle: "Florist Delivery Site", value: "6000", status: "won", stage: "closed-won", onboard: true }
];

export async function seedFullDatabase() {
  const [admin] = await db.select().from(userTable).where(eq(userTable.email, "admin@vivawebdesigns.com"));
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
    });

    if (client.onboard && templateId) {
      await pipelineStorage.updateOpportunity(opp.id, { status: "won" });
      await onboardingStorage.convertOpportunityToOnboarding(opp.id, templateId, adminId);
    }
  }
}
