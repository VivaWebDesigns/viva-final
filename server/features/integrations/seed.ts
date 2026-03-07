import * as intStorage from "./storage";

const INTEGRATIONS = [
  {
    provider: "stripe",
    enabled: false,
    configComplete: false,
    settings: {
      name: "Stripe",
      description: "Payment processing and subscription management",
      docsUrl: "https://stripe.com/docs",
      requiredEnvVars: ["STRIPE_SECRET_KEY"],
      optionalEnvVars: ["STRIPE_WEBHOOK_SECRET"],
      icon: "CreditCard",
      featureFlag: "planned",
      setupInstructions: [
        "Create a Stripe account at stripe.com",
        "Navigate to Developers → API Keys in your Stripe Dashboard",
        "Copy your Secret Key (starts with sk_test_ or sk_live_)",
        "Set STRIPE_SECRET_KEY in your environment variables",
        "For webhook events, set STRIPE_WEBHOOK_SECRET from the webhook endpoint settings",
      ],
      operationalNotes: "Stripe will power client billing, invoice generation, and payment tracking. Webhook events will be logged for payment status updates. Use test mode keys during development.",
      usedBy: ["Payments (planned)", "Client Billing (planned)", "Invoice Generation (planned)"],
    },
  },
  {
    provider: "mailgun",
    enabled: false,
    configComplete: false,
    settings: {
      name: "Mailgun",
      description: "Transactional email delivery for notifications",
      docsUrl: "https://documentation.mailgun.com",
      requiredEnvVars: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
      optionalEnvVars: ["MAILGUN_FROM_EMAIL", "MAILGUN_FROM_NAME"],
      icon: "Mail",
      featureFlag: "active",
      setupInstructions: [
        "Create a Mailgun account at mailgun.com",
        "Add and verify your sending domain",
        "Navigate to API Keys and copy your Private API Key",
        "Set MAILGUN_API_KEY and MAILGUN_DOMAIN in your environment variables",
        "Optionally set MAILGUN_FROM_EMAIL and MAILGUN_FROM_NAME for custom sender identity",
      ],
      operationalNotes: "Mailgun handles notification emails for new leads, assignment alerts, stage changes, and system alerts. When not configured, the system gracefully skips email delivery and uses in-app notifications only. Email status is tracked per notification (sent/failed/skipped).",
      usedBy: ["Lead Notifications", "Assignment Alerts", "Stage Change Emails", "System Alerts"],
    },
  },
  {
    provider: "openai",
    enabled: false,
    configComplete: false,
    settings: {
      name: "OpenAI",
      description: "AI intelligence for future internal features",
      docsUrl: "https://platform.openai.com/docs",
      requiredEnvVars: ["OPENAI_API_KEY"],
      optionalEnvVars: [],
      icon: "Brain",
      featureFlag: "scaffold",
      setupInstructions: [
        "Create an OpenAI account at platform.openai.com",
        "Navigate to API Keys and create a new secret key",
        "Set OPENAI_API_KEY in your environment variables",
        "Ensure your account has API credits or a payment method configured",
      ],
      operationalNotes: "OpenAI is scaffolded for future internal intelligence features. Planned capabilities include: AI-assisted lead scoring, automated content generation for proposals, and intelligent activity summaries. No active API calls are made until these features are built.",
      usedBy: ["AI Lead Scoring (planned)", "Content Generation (planned)", "Activity Summaries (planned)"],
    },
  },
  {
    provider: "cloudflare-r2",
    enabled: false,
    configComplete: false,
    settings: {
      name: "Cloudflare R2",
      description: "Object storage for files, media, and documents",
      docsUrl: "https://developers.cloudflare.com/r2",
      requiredEnvVars: ["CLOUDFLARE_R2_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_KEY", "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_ENDPOINT"],
      optionalEnvVars: ["CLOUDFLARE_R2_PUBLIC_URL"],
      icon: "Cloud",
      featureFlag: "planned",
      setupInstructions: [
        "Log into your Cloudflare Dashboard",
        "Navigate to R2 Object Storage and create a bucket",
        "Go to Manage R2 API Tokens and create an API token with read/write access",
        "Set CLOUDFLARE_R2_ACCESS_KEY (Access Key ID) and CLOUDFLARE_R2_SECRET_KEY (Secret Access Key)",
        "Set CLOUDFLARE_R2_BUCKET to your bucket name",
        "Set CLOUDFLARE_R2_ENDPOINT to your account's R2 endpoint URL",
        "Optionally set CLOUDFLARE_R2_PUBLIC_URL for public file access",
      ],
      operationalNotes: "Cloudflare R2 is the exclusive file storage provider for this platform. It will handle file uploads, invoice document storage, and chat attachments. R2 uses the S3-compatible API — no separate S3 configuration is needed. Files are organized by type prefix (invoices/, uploads/, attachments/).",
      usedBy: ["File Uploads (planned)", "Invoice Storage (planned)", "Chat Attachments (planned)"],
    },
  },
];

export async function seedIntegrations() {
  for (const integration of INTEGRATIONS) {
    await intStorage.upsertIntegration(integration);
  }
  return { count: INTEGRATIONS.length };
}
