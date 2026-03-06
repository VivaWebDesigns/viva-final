import * as onboardingStorage from "./storage";

const DEFAULT_TEMPLATE_ITEMS = [
  { category: "contract", label: "Contract received and signed", description: "Signed service agreement or SOW on file", isRequired: true },
  { category: "payment", label: "Initial payment confirmed", description: "First invoice paid or payment method on file", isRequired: true },
  { category: "branding", label: "Logo and brand assets received", description: "Logo files, brand colors, fonts, and style guide", isRequired: true },
  { category: "domain_dns", label: "Domain/DNS access received", description: "Domain registrar credentials or DNS management access", isRequired: true },
  { category: "website", label: "Website hosting access received", description: "CPanel, FTP, or hosting dashboard credentials", isRequired: false },
  { category: "google_business", label: "Google Business Profile access", description: "Manager or owner access to Google Business listing", isRequired: false },
  { category: "google_ads", label: "Google Ads account access", description: "Admin access to Google Ads account", isRequired: false },
  { category: "meta_facebook", label: "Meta/Facebook access granted", description: "Facebook Business Manager or page admin access", isRequired: false },
  { category: "social", label: "Social media account access", description: "Login credentials or admin access for social platforms", isRequired: false },
  { category: "content", label: "Content and assets received", description: "Photos, copy, testimonials, and other website content", isRequired: true },
  { category: "kickoff", label: "Kickoff call scheduled", description: "Initial project kickoff meeting scheduled with client", isRequired: true },
  { category: "kickoff", label: "Kickoff call completed", description: "Kickoff call held, project scope and timeline confirmed", isRequired: true },
];

export async function seedOnboardingTemplates() {
  const template = await onboardingStorage.upsertTemplate({
    name: "Standard Web Design Onboarding",
    slug: "standard-web-design",
    description: "Default onboarding checklist for new web design clients",
    items: DEFAULT_TEMPLATE_ITEMS.map((item, idx) => ({ ...item, sortOrder: idx })),
  });
  return { templates: 1, templateId: template.id };
}
