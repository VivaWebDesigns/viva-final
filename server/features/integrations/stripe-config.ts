/**
 * Stripe Configuration Service
 *
 * Config precedence (highest to lowest):
 *   1. DB-stored config (integration_records.settings for provider=stripe)
 *   2. Environment variables (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
 *
 * Secrets are never logged. On reads, keys are masked except the last 4 chars.
 */

import { db } from "../../db";
import { integrationRecords } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface StripeStoredConfig {
  secretKey?: string;
  webhookSecret?: string;
  publishableKey?: string;
}

export interface StripeLiveConfig {
  secretKey: string | null;
  webhookSecret: string | null;
  publishableKey: string | null;
  mode: "live" | "test" | "unknown";
  source: "database" | "environment" | "none";
}

export interface StripeMaskedStatus {
  configured: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasPublishableKey: boolean;
  mode: "live" | "test" | "unknown";
  source: "database" | "environment" | "none";
  secretKeyMasked: string | null;
  webhookSecretMasked: string | null;
  publishableKeyMasked: string | null;
}

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 7) + "•••" + key.slice(-4);
}

function deriveMode(secretKey: string | null | undefined): "live" | "test" | "unknown" {
  if (!secretKey) return "unknown";
  if (secretKey.startsWith("sk_live_")) return "live";
  if (secretKey.startsWith("sk_test_")) return "test";
  return "unknown";
}

async function getDbStripeConfig(): Promise<StripeStoredConfig | null> {
  try {
    const [record] = await db
      .select()
      .from(integrationRecords)
      .where(eq(integrationRecords.provider, "stripe"))
      .limit(1);
    if (!record) return null;
    const settings = record.settings as any;
    if (settings?.secretKey) {
      return {
        secretKey: settings.secretKey || undefined,
        webhookSecret: settings.webhookSecret || undefined,
        publishableKey: settings.publishableKey || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getLiveStripeConfig(): Promise<StripeLiveConfig> {
  const dbConfig = await getDbStripeConfig();

  if (dbConfig?.secretKey) {
    return {
      secretKey: dbConfig.secretKey,
      webhookSecret: dbConfig.webhookSecret ?? null,
      publishableKey: dbConfig.publishableKey ?? null,
      mode: deriveMode(dbConfig.secretKey),
      source: "database",
    };
  }

  const envKey = process.env.STRIPE_SECRET_KEY ?? null;
  const envWebhook = process.env.STRIPE_WEBHOOK_SECRET ?? null;

  return {
    secretKey: envKey,
    webhookSecret: envWebhook,
    publishableKey: null,
    mode: deriveMode(envKey),
    source: envKey ? "environment" : "none",
  };
}

export async function getMaskedStripeStatus(): Promise<StripeMaskedStatus> {
  const live = await getLiveStripeConfig();
  return {
    configured: !!live.secretKey,
    hasSecretKey: !!live.secretKey,
    hasWebhookSecret: !!live.webhookSecret,
    hasPublishableKey: !!live.publishableKey,
    mode: live.mode,
    source: live.source,
    secretKeyMasked: maskKey(live.secretKey),
    webhookSecretMasked: maskKey(live.webhookSecret),
    publishableKeyMasked: maskKey(live.publishableKey),
  };
}

export async function saveStripeConfig(config: StripeStoredConfig): Promise<void> {
  const [existing] = await db
    .select()
    .from(integrationRecords)
    .where(eq(integrationRecords.provider, "stripe"))
    .limit(1);

  const currentSettings = (existing?.settings as any) ?? {};

  const updatedSettings = {
    ...currentSettings,
    secretKey: config.secretKey ?? currentSettings.secretKey,
    webhookSecret: config.webhookSecret !== undefined ? config.webhookSecret : currentSettings.webhookSecret,
    publishableKey: config.publishableKey !== undefined ? config.publishableKey : currentSettings.publishableKey,
  };

  if (existing) {
    await db
      .update(integrationRecords)
      .set({
        settings: updatedSettings,
        configComplete: !!updatedSettings.secretKey,
        enabled: !!updatedSettings.secretKey,
        updatedAt: new Date(),
      })
      .where(eq(integrationRecords.provider, "stripe"));
  } else {
    await db.insert(integrationRecords).values({
      provider: "stripe",
      enabled: !!config.secretKey,
      configComplete: !!config.secretKey,
      settings: updatedSettings,
    });
  }
}

export async function testStripeConnection(): Promise<{ success: boolean; message: string; details?: string }> {
  const live = await getLiveStripeConfig();
  if (!live.secretKey) {
    return { success: false, message: "Stripe secret key is not configured" };
  }
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${live.secretKey}` },
    });
    if (response.ok) {
      const data = await response.json() as any;
      const available = data.available?.[0];
      const modeLabel = live.mode === "live" ? "Live" : live.mode === "test" ? "Test" : "";
      return {
        success: true,
        message: `Stripe ${modeLabel} API key is valid`,
        details: available ? `Balance: ${(available.amount / 100).toFixed(2)} ${available.currency?.toUpperCase()}` : undefined,
      };
    } else {
      const data = await response.json() as any;
      return {
        success: false,
        message: "Stripe API returned an error",
        details: data.error?.message ?? `HTTP ${response.status}`,
      };
    }
  } catch (err: any) {
    return { success: false, message: "Stripe connectivity failed", details: err.message };
  }
}
