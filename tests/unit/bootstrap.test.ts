import { describe, it, expect, vi } from "vitest";

// Mock all DB-dependent modules so we can import and test shouldAutoSeed()
// in isolation without a real database connection.
vi.mock("../../server/db", () => ({ db: {} }));
vi.mock("../../server/features/admin/prod-seed", () => ({ seedAdminUser: vi.fn() }));
vi.mock("../../server/features/admin/dev-seed", () => ({ seedDevUsers: vi.fn() }));
vi.mock("../../server/features/crm/seed", () => ({ seedCrmStatuses: vi.fn() }));
vi.mock("../../server/features/pipeline/seed", () => ({ seedPipelineStages: vi.fn() }));
vi.mock("../../server/features/onboarding/seed", () => ({ seedOnboardingTemplates: vi.fn() }));
vi.mock("../../server/features/integrations/seed", () => ({ seedIntegrations: vi.fn() }));
vi.mock("../../server/features/docs/seed", () => ({ seedDocs: vi.fn() }));

import { shouldAutoSeed } from "../../server/bootstrap";

describe("shouldAutoSeed (real implementation from server/bootstrap.ts)", () => {
  it("auto-seeds in development when VIVA_AUTO_SEED is not set", () => {
    expect(shouldAutoSeed({ NODE_ENV: "development" })).toBe(true);
  });

  it("skips auto-seed in production when VIVA_AUTO_SEED is not set", () => {
    expect(shouldAutoSeed({ NODE_ENV: "production" })).toBe(false);
  });

  it("auto-seeds in production when VIVA_AUTO_SEED=true", () => {
    expect(shouldAutoSeed({ NODE_ENV: "production", VIVA_AUTO_SEED: "true" })).toBe(true);
  });

  it("auto-seeds when VIVA_AUTO_SEED=1", () => {
    expect(shouldAutoSeed({ NODE_ENV: "production", VIVA_AUTO_SEED: "1" })).toBe(true);
  });

  it("skips auto-seed when VIVA_AUTO_SEED=false explicitly in dev", () => {
    expect(shouldAutoSeed({ NODE_ENV: "development", VIVA_AUTO_SEED: "false" })).toBe(false);
  });

  it("skips auto-seed when VIVA_AUTO_SEED=0", () => {
    expect(shouldAutoSeed({ NODE_ENV: "development", VIVA_AUTO_SEED: "0" })).toBe(false);
  });

  it("VIVA_AUTO_SEED=TRUE is case-insensitive (treated as true)", () => {
    expect(shouldAutoSeed({ NODE_ENV: "production", VIVA_AUTO_SEED: "TRUE" })).toBe(true);
  });

  it("VIVA_AUTO_SEED=True is case-insensitive (treated as true)", () => {
    expect(shouldAutoSeed({ NODE_ENV: "production", VIVA_AUTO_SEED: "True" })).toBe(true);
  });

  it("unknown NODE_ENV without VIVA_AUTO_SEED defaults to auto-seed (non-prod)", () => {
    expect(shouldAutoSeed({ NODE_ENV: undefined })).toBe(true);
  });

  it("empty env object (no NODE_ENV) defaults to auto-seed", () => {
    expect(shouldAutoSeed({})).toBe(true);
  });
});

describe("shouldAutoSeed idempotency", () => {
  it("calling with the same env twice produces the same result", () => {
    const env = { NODE_ENV: "production", VIVA_AUTO_SEED: "true" };
    expect(shouldAutoSeed(env)).toBe(shouldAutoSeed(env));
  });

  it("dev default is stable across repeated calls", () => {
    const devEnv = { NODE_ENV: "development" };
    const results = Array.from({ length: 5 }, () => shouldAutoSeed(devEnv));
    expect(results.every(Boolean)).toBe(true);
  });

  it("prod skip is stable across repeated calls", () => {
    const prodEnv = { NODE_ENV: "production" };
    const results = Array.from({ length: 5 }, () => shouldAutoSeed(prodEnv));
    expect(results.every((r) => r === false)).toBe(true);
  });
});
