import { isConfigured as isMailgunConfigured } from "../notifications/mailgun";

export interface ProviderHealth {
  provider: string;
  configured: boolean;
  missingVars: string[];
  presentVars: string[];
  status: "ready" | "partial" | "not_configured";
  featureFlag: "active" | "planned" | "scaffold";
  notes: string;
  usedBy: string[];
}

function checkEnvVars(vars: string[]): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const v of vars) {
    if (process.env[v]) present.push(v);
    else missing.push(v);
  }
  return { present, missing };
}

function deriveStatus(present: string[], required: string[]): "ready" | "partial" | "not_configured" {
  if (present.length === required.length) return "ready";
  if (present.length > 0) return "partial";
  return "not_configured";
}

export function checkStripeHealth(): ProviderHealth {
  const required = ["STRIPE_SECRET_KEY"];
  const optional = ["STRIPE_WEBHOOK_SECRET"];
  const all = [...required, ...optional];
  const { present, missing } = checkEnvVars(all);
  const reqCheck = checkEnvVars(required);

  return {
    provider: "stripe",
    configured: reqCheck.missing.length === 0,
    missingVars: missing,
    presentVars: present,
    status: deriveStatus(reqCheck.present, required),
    featureFlag: "planned",
    notes: "Stripe integration is planned for billing and payment processing. Connect your Stripe account and set STRIPE_SECRET_KEY to enable. STRIPE_WEBHOOK_SECRET is needed for webhook event verification.",
    usedBy: ["Payments (planned)", "Client Billing (planned)"],
  };
}

export function checkMailgunHealth(): ProviderHealth {
  const required = ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"];
  const optional = ["MAILGUN_FROM_EMAIL", "MAILGUN_FROM_NAME"];
  const all = [...required, ...optional];
  const { present, missing } = checkEnvVars(all);
  const reqCheck = checkEnvVars(required);

  return {
    provider: "mailgun",
    configured: isMailgunConfigured(),
    missingVars: missing,
    presentVars: present,
    status: deriveStatus(reqCheck.present, required),
    featureFlag: "active",
    notes: "Mailgun powers notification emails for lead alerts, assignment notifications, and system alerts. When not configured, notifications fall back to in-app only (emails are skipped gracefully).",
    usedBy: ["Notification System", "Lead Alerts", "Assignment Emails"],
  };
}

export function checkOpenAIHealth(): ProviderHealth {
  const required = ["OPENAI_API_KEY"];
  const { present, missing } = checkEnvVars(required);

  return {
    provider: "openai",
    configured: missing.length === 0,
    missingVars: missing,
    presentVars: present,
    status: deriveStatus(present, required),
    featureFlag: "scaffold",
    notes: "OpenAI is scaffolded for future internal intelligence features such as lead scoring, content generation, and automated summaries. No active usage yet — set OPENAI_API_KEY when ready to enable AI features.",
    usedBy: ["AI Lead Scoring (planned)", "Content Generation (planned)"],
  };
}

export function checkR2Health(): ProviderHealth {
  const required = ["CLOUDFLARE_R2_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_KEY", "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_ENDPOINT"];
  const optional = ["CLOUDFLARE_R2_PUBLIC_URL"];
  const all = [...required, ...optional];
  const { present, missing } = checkEnvVars(all);
  const reqCheck = checkEnvVars(required);

  return {
    provider: "cloudflare-r2",
    configured: reqCheck.missing.length === 0,
    missingVars: missing,
    presentVars: present,
    status: deriveStatus(reqCheck.present, required),
    featureFlag: "planned",
    notes: "Cloudflare R2 is the exclusive file storage provider. It will be used for file uploads, invoice storage, and chat attachments. R2 is S3-compatible — no separate S3 logic needed.",
    usedBy: ["File Uploads (planned)", "Invoice Storage (planned)", "Chat Attachments (planned)"],
  };
}

export function checkAllProviders(): Record<string, ProviderHealth> {
  return {
    stripe: checkStripeHealth(),
    mailgun: checkMailgunHealth(),
    openai: checkOpenAIHealth(),
    "cloudflare-r2": checkR2Health(),
  };
}
