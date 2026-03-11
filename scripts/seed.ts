#!/usr/bin/env tsx
/**
 * Standalone Seed Script
 *
 * Runs all seed routines directly against the database.
 * Safe to run multiple times — all seeds are fully idempotent.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Required environment variables:
 *   DATABASE_URL           — PostgreSQL connection string
 *   SEED_ADMIN_EMAIL       — Admin user email
 *   SEED_ADMIN_PASSWORD    — Admin user password
 *   SEED_DEV_EMAIL         — Developer user email (optional)
 *   SEED_DEV_PASSWORD      — Developer user password (optional)
 *   SEED_SALES_EMAIL       — Sales rep user email (optional)
 *   SEED_SALES_PASSWORD    — Sales rep user password (optional)
 */

import { seedAdminUser } from "../server/features/admin/prod-seed";
import { seedDevUsers } from "../server/features/admin/dev-seed";
import { seedCrmStatuses } from "../server/features/crm/seed";
import { seedPipelineStages } from "../server/features/pipeline/seed";
import { seedOnboardingTemplates } from "../server/features/onboarding/seed";
import { seedIntegrations } from "../server/features/integrations/seed";
import { seedDocs } from "../server/features/docs/seed";

async function main() {
  console.log("[seed-script] Starting seed run...");
  const start = Date.now();

  try {
    console.log("[seed-script] Seeding admin/prod users...");
    await seedAdminUser();
  } catch (err: any) {
    console.error("[seed-script] prod-seed error:", err.message);
  }

  try {
    console.log("[seed-script] Seeding dev users...");
    await seedDevUsers();
  } catch (err: any) {
    console.error("[seed-script] dev-seed error:", err.message);
  }

  try {
    console.log("[seed-script] Seeding CRM statuses...");
    const result = await seedCrmStatuses();
    console.log(`[seed-script] CRM statuses: ${result.count} records`);
  } catch (err: any) {
    console.error("[seed-script] crm-statuses error:", err.message);
  }

  try {
    console.log("[seed-script] Seeding pipeline stages...");
    const result = await seedPipelineStages();
    console.log(`[seed-script] Pipeline stages: ${result.count} records`);
  } catch (err: any) {
    console.error("[seed-script] pipeline-stages error:", err.message);
  }

  try {
    console.log("[seed-script] Seeding onboarding templates...");
    const result = await seedOnboardingTemplates();
    console.log(`[seed-script] Onboarding templates: ${result.templates} template(s)`);
  } catch (err: any) {
    console.error("[seed-script] onboarding-templates error:", err.message);
  }

  try {
    console.log("[seed-script] Seeding integrations...");
    const result = await seedIntegrations();
    console.log(`[seed-script] Integrations: ${result.count} records`);
  } catch (err: any) {
    console.error("[seed-script] integrations error:", err.message);
  }

  try {
    console.log("[seed-script] Seeding App Docs...");
    const result = await seedDocs();
    console.log(`[seed-script] Docs: ${result.categories} categories, ${result.articles} articles`);
  } catch (err: any) {
    console.error("[seed-script] docs error:", err.message);
  }

  const elapsed = Date.now() - start;
  console.log(`[seed-script] Seed run complete in ${elapsed}ms`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-script] Fatal error:", err);
  process.exit(1);
});
