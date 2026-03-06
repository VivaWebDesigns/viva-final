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
      icon: "CreditCard",
    },
  },
  {
    provider: "mailgun",
    enabled: false,
    configComplete: false,
    settings: {
      name: "Mailgun",
      description: "Transactional and marketing email delivery",
      docsUrl: "https://documentation.mailgun.com",
      requiredEnvVars: ["MAILGUN_API_KEY"],
      icon: "Mail",
    },
  },
  {
    provider: "openai",
    enabled: false,
    configComplete: false,
    settings: {
      name: "OpenAI",
      description: "AI text generation and language processing",
      docsUrl: "https://platform.openai.com/docs",
      requiredEnvVars: ["OPENAI_API_KEY"],
      icon: "Brain",
    },
  },
  {
    provider: "cloudflare-r2",
    enabled: false,
    configComplete: false,
    settings: {
      name: "Cloudflare R2",
      description: "Object storage for files and media",
      docsUrl: "https://developers.cloudflare.com/r2",
      requiredEnvVars: ["CLOUDFLARE_R2_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_KEY", "CLOUDFLARE_R2_BUCKET", "CLOUDFLARE_R2_ENDPOINT"],
      icon: "Cloud",
    },
  },
];

export async function seedIntegrations() {
  for (const integration of INTEGRATIONS) {
    await intStorage.upsertIntegration(integration);
  }
  return { count: INTEGRATIONS.length };
}
