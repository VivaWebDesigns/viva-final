/**
 * Profile Routes Integration Tests
 *
 * Validates:
 * 1. Endpoint availability and routing
 * 2. Input validation (UUID format on :id params)
 * 3. Auth enforcement — unauthenticated requests are rejected
 * 4. Role-based access control (admin/developer = unrestricted; sales_rep/lead_gen = scoped)
 * 5. 404 propagation from service layer
 * 6. DTO shape when service returns successfully
 *
 * The profile service and DB are mocked so tests focus on route behavior only.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import http from "node:http";

// ── Hoist mock identifiers ────────────────────────────────────────────────────

const { mockGetSession, mockGetProfileByCompanyId, mockGetProfileByLeadId, mockGetProfileByOpportunityId, mockDbSelect } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockGetProfileByCompanyId: vi.fn(),
    mockGetProfileByLeadId: vi.fn(),
    mockGetProfileByOpportunityId: vi.fn(),
    mockDbSelect: vi.fn(),
  }));

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../server/features/auth/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: (h: unknown) => h,
}));

vi.mock("../../server/features/profiles/service", () => ({
  getProfileByCompanyId: mockGetProfileByCompanyId,
  getProfileByLeadId: mockGetProfileByLeadId,
  getProfileByOpportunityId: mockGetProfileByOpportunityId,
}));

// Mock DB for access-check queries inside the routes
vi.mock("../../server/db", () => ({
  db: {
    select: mockDbSelect,
  },
}));

// Pass through drizzle-orm entirely — schema.ts uses sql, desc, etc. at module level
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    eq: vi.fn((_col: unknown, _val: unknown) => ({ type: "eq" })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  };
});

// Minimal schema stub — routes only use table references as drizzle tokens
vi.mock("../../shared/schema", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    crmLeads: { id: "crmLeads.id", assignedTo: "crmLeads.assignedTo", companyId: "crmLeads.companyId" },
    pipelineOpportunities: { id: "pipelineOpportunities.id", assignedTo: "pipelineOpportunities.assignedTo" },
  };
});

import { requireAuth, requireRole } from "../../server/features/auth/middleware";
import profileRoutes from "../../server/features/profiles/routes";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
const OTHER_UUID = "22222222-2222-2222-2222-222222222222";
const INVALID_ID  = "not-a-uuid";

const STUB_PROFILE = {
  identity: { company: { id: VALID_UUID, name: "Test Co" }, primaryContact: null, contacts: [] },
  sales: { sourceLead: null, leadHistory: [], activeOpportunity: null, opportunities: [] },
  work: { tasks: [], nextAction: null },
  timeline: { events: [] },
  service: { onboarding: [], billingSummary: { hasStripe: false, stripeCustomerId: null }, files: [] },
  derived: { owner: null, status: null, health: "unknown", stage: null, value: null, lastActivityAt: null },
};

function makeSession(role: string, id = "user-1") {
  return { session: {}, user: { id, role, name: "Test User" } };
}

// ── App builder ───────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(requireAuth);
  app.use("/profiles", profileRoutes);
  return app;
}

function request(
  app: express.Express,
  method: "GET",
  path: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const req = http.request({ hostname: "127.0.0.1", port, path, method }, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          server.close();
          try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode ?? 0, body: data }); }
        });
      });
      req.on("error", reject);
      req.end();
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /profiles/company/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid UUID", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${INVALID_ID}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 for sales_rep with no assigned lead on the company", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "user-rep"));
    // DB returns no owned lead for this company
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 with profile for admin (bypasses ownership check)", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByCompanyId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    expect(res.status).toBe(200);
    expect((res.body as typeof STUB_PROFILE).identity.company.id).toBe(VALID_UUID);
  });

  it("returns 200 with profile for developer (bypasses ownership check)", async () => {
    mockGetSession.mockResolvedValue(makeSession("developer"));
    mockGetProfileByCompanyId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  it("returns 200 for sales_rep when they have a lead assigned to the company", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "user-rep"));
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: "lead-1" }]) }) }),
    });
    mockGetProfileByCompanyId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 when service throws not-found error", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByCompanyId.mockRejectedValue(new Error(`Company not found: ${VALID_UUID}`));
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    expect(res.status).toBe(404);
  });

  it("returns DTO with all required top-level sections", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByCompanyId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/company/${VALID_UUID}`);
    const body = res.body as typeof STUB_PROFILE;
    expect(body).toHaveProperty("identity");
    expect(body).toHaveProperty("sales");
    expect(body).toHaveProperty("work");
    expect(body).toHaveProperty("timeline");
    expect(body).toHaveProperty("service");
    expect(body).toHaveProperty("derived");
  });
});

describe("GET /profiles/lead/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${INVALID_ID}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 for sales_rep whose lead.assignedTo differs", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "user-rep"));
    // Lead exists but is assigned to someone else
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ assignedTo: "other-user" }]) }) }),
    });
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${VALID_UUID}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for lead_gen whose lead is not assigned to them", async () => {
    mockGetSession.mockResolvedValue(makeSession("lead_gen", "user-gen"));
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${VALID_UUID}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for sales_rep when lead is assigned to them", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "user-rep"));
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ assignedTo: "user-rep" }]) }) }),
    });
    mockGetProfileByLeadId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  it("returns 200 for admin (no ownership check)", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByLeadId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 when service throws not-found", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByLeadId.mockRejectedValue(new Error("Lead not found: " + VALID_UUID));
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/lead/${VALID_UUID}`);
    expect(res.status).toBe(404);
  });
});

describe("GET /profiles/opportunity/:id", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/opportunity/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid UUID", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/opportunity/${INVALID_ID}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 for sales_rep when opportunity is not assigned to them", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "user-rep"));
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ assignedTo: OTHER_UUID }]) }) }),
    });
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/opportunity/${VALID_UUID}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for sales_rep when opportunity is assigned to them", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "user-rep"));
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ assignedTo: "user-rep" }]) }) }),
    });
    mockGetProfileByOpportunityId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/opportunity/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  it("returns 200 for developer (no ownership check)", async () => {
    mockGetSession.mockResolvedValue(makeSession("developer"));
    mockGetProfileByOpportunityId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/opportunity/${VALID_UUID}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 when service throws not-found", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByOpportunityId.mockRejectedValue(new Error("Opportunity not found: " + VALID_UUID));
    const app = buildApp();
    const res = await request(app, "GET", `/profiles/opportunity/${VALID_UUID}`);
    expect(res.status).toBe(404);
  });

  it("returns consistent DTO shape across all three entry points", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin"));
    mockGetProfileByCompanyId.mockResolvedValue(STUB_PROFILE);
    mockGetProfileByLeadId.mockResolvedValue(STUB_PROFILE);
    mockGetProfileByOpportunityId.mockResolvedValue(STUB_PROFILE);
    const app = buildApp();

    const [rc, rl, ro] = await Promise.all([
      request(app, "GET", `/profiles/company/${VALID_UUID}`),
      request(app, "GET", `/profiles/lead/${VALID_UUID}`),
      request(app, "GET", `/profiles/opportunity/${VALID_UUID}`),
    ]);

    for (const res of [rc, rl, ro]) {
      expect(res.status).toBe(200);
      const body = res.body as typeof STUB_PROFILE;
      expect(body).toHaveProperty("identity");
      expect(body).toHaveProperty("sales");
      expect(body).toHaveProperty("work");
      expect(body).toHaveProperty("timeline");
      expect(body).toHaveProperty("service");
      expect(body).toHaveProperty("derived");
    }
  });
});
