/**
 * Bootstrap Orchestrator
 *
 * Handles all post-startup initialization in a controlled, environment-aware way.
 * This is the ONLY place that calls seed/init functions.
 *
 * Seeding is gated on the VIVA_AUTO_SEED environment variable:
 *   - Development (NODE_ENV !== "production"): auto-seed defaults to TRUE
 *   - Production  (NODE_ENV === "production"):  auto-seed defaults to FALSE
 *     → Set VIVA_AUTO_SEED=true explicitly to opt in
 *
 * To run seeds manually without starting the server, use:
 *   npx tsx scripts/seed.ts
 *
 * To trigger seeds via HTTP (with secret auth), use:
 *   POST /api/admin/seed-all  (requires X-Seed-Secret header)
 */

import { db } from "./db";
import { sql } from "drizzle-orm";
import { seedAdminUser } from "./features/admin/prod-seed";
import { seedDevUsers } from "./features/admin/dev-seed";
import { seedCrmStatuses } from "./features/crm/seed";
import { seedPipelineStages } from "./features/pipeline/seed";
import { seedOnboardingTemplates } from "./features/onboarding/seed";
import { seedIntegrations } from "./features/integrations/seed";
import { seedDocs } from "./features/docs/seed";

const TAG = "[bootstrap]";

// ── DB health check ───────────────────────────────────────────────────

async function checkDbConnectivity(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    console.log(`${TAG} database connectivity: OK`);
    return true;
  } catch (err: any) {
    console.error(`${TAG} database connectivity: FAILED — ${err.message}`);
    return false;
  }
}

// ── Seed gate logic ───────────────────────────────────────────────────

/**
 * Pure function — exported for unit testing.
 * Accepts an env object so it can be tested without mutating process.env.
 */
export function shouldAutoSeed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const flag = env.VIVA_AUTO_SEED;
  if (flag !== undefined) {
    return flag.toLowerCase() === "true" || flag === "1";
  }
  // Implicit default: auto-seed in dev, skip in prod
  return env.NODE_ENV !== "production";
}

// ── User seeds (prod + dev users from env vars) ───────────────────────

async function runUserSeeds(): Promise<void> {
  await seedAdminUser().catch((err) =>
    console.error(`${TAG} prod-seed error:`, err.message),
  );
  await seedDevUsers().catch((err) =>
    console.error(`${TAG} dev-seed error:`, err.message),
  );
}

// ── Feature seeds (config data: statuses, stages, templates, etc.) ───

export interface SeedResult {
  domain: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Runs all feature seeds and returns per-seed results.
 * Errors are caught per-seed so one failure does not block the rest.
 */
export async function runFeatureSeeds(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  const seeds: Array<{ domain: string; fn: () => Promise<Record<string, unknown>> }> = [
    { domain: "crm-statuses",          fn: () => seedCrmStatuses() as Promise<Record<string, unknown>> },
    { domain: "pipeline-stages",       fn: () => seedPipelineStages() as Promise<Record<string, unknown>> },
    { domain: "onboarding-templates",  fn: () => seedOnboardingTemplates() as Promise<Record<string, unknown>> },
    { domain: "integrations",          fn: () => seedIntegrations() as Promise<Record<string, unknown>> },
    { domain: "docs",                  fn: () => seedDocs() as Promise<Record<string, unknown>> },
  ];

  for (const seed of seeds) {
    try {
      const data = await seed.fn();
      results.push({ domain: seed.domain, ok: true, data });
    } catch (err: any) {
      console.error(`${TAG} ${seed.domain} error:`, err.message);
      results.push({ domain: seed.domain, ok: false, error: err.message });
    }
  }

  return results;
}

// ── Main bootstrap entry point ────────────────────────────────────────

export async function runBootstrap(): Promise<void> {
  const env = process.env.NODE_ENV ?? "development";
  console.log(`${TAG} environment: ${env}`);

  const dbOk = await checkDbConnectivity();
  if (!dbOk) {
    console.error(`${TAG} WARNING: database is not reachable — skipping seeds`);
    return;
  }

  // Schema management note: this project uses Drizzle's `db:push` workflow.
  // Run `npm run db:push` to apply schema changes before seeding.
  console.log(`${TAG} schema management: drizzle push model (run 'npm run db:push' for schema changes)`);

  if (!shouldAutoSeed(process.env)) {
    console.log(
      `${TAG} auto-seed: SKIPPED (set VIVA_AUTO_SEED=true or run 'npx tsx scripts/seed.ts' to seed manually)`,
    );
    return;
  }

  console.log(`${TAG} auto-seed: RUNNING (VIVA_AUTO_SEED=${process.env.VIVA_AUTO_SEED ?? "<implicit dev default>"})`);

  await runUserSeeds();
  await runFeatureSeeds();

  console.log(`${TAG} bootstrap complete`);
}
