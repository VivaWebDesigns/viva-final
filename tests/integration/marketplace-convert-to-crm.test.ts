import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";

const authUser = {
  id: "user-1",
  name: "Dev User",
  email: "dev@example.com",
  role: "developer",
};

vi.mock("../../server/features/auth/middleware", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.authUser = authUser;
    next();
  },
  requireRole: () => (req: any, _res: any, next: any) => {
    req.authUser = authUser;
    next();
  },
}));

const mockGetPendingOutreachById = vi.fn();
const mockUpdatePendingOutreach = vi.fn();
vi.mock("../../server/features/marketplace/storage", () => ({
  getPendingOutreachById: mockGetPendingOutreachById,
  updatePendingOutreach: mockUpdatePendingOutreach,
}));

const mockCheckManualLeadDuplicate = vi.fn();
const mockFindContactByPhone = vi.fn();
const mockCreateContact = vi.fn();
const mockFindCompanyByName = vi.fn();
const mockCreateCompany = vi.fn();
const mockUpdateContact = vi.fn();
const mockGetDefaultLeadStatus = vi.fn();
const mockGetLeadStatusBySlug = vi.fn();
const mockCreateLead = vi.fn();
const mockResolveLeadAssignee = vi.fn();
vi.mock("../../server/features/crm/storage", () => ({
  checkManualLeadDuplicate: mockCheckManualLeadDuplicate,
  findContactByPhone: mockFindContactByPhone,
  createContact: mockCreateContact,
  findCompanyByName: mockFindCompanyByName,
  createCompany: mockCreateCompany,
  updateContact: mockUpdateContact,
  getDefaultLeadStatus: mockGetDefaultLeadStatus,
  getLeadStatusBySlug: mockGetLeadStatusBySlug,
  createLead: mockCreateLead,
  resolveLeadAssignee: mockResolveLeadAssignee,
}));

const mockGetStageBySlug = vi.fn();
const mockCreateOpportunity = vi.fn();
vi.mock("../../server/features/pipeline/storage", () => ({
  getStageBySlug: mockGetStageBySlug,
  createOpportunity: mockCreateOpportunity,
}));

const mockLogAudit = vi.fn();
vi.mock("../../server/features/audit/service", () => ({
  logAudit: mockLogAudit,
}));

const mockExecuteStageAutomations = vi.fn();
vi.mock("../../server/features/automations/trigger", () => ({
  executeStageAutomations: mockExecuteStageAutomations,
}));

async function buildApp() {
  vi.resetModules();
  const { default: router } = await import("../../server/features/marketplace/routes");
  const app = express();
  app.use(express.json());
  app.use("/api/marketplace", router);
  return app;
}

function post(app: express.Application, path: string, body: unknown) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      fetch(`http://localhost:${port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (res) => {
        const json = await res.json().catch(() => null);
        server.close(() => resolve({ status: res.status, body: json }));
      }).catch((err) => server.close(() => reject(err)));
    });
  });
}

const BASE_RECORD = {
  id: "pending-1",
  sellerFullName: "Maria Lopez",
  sellerProfileUrl: "https://facebook.com/marketplace/profile/1",
  listingUrl: "https://facebook.com/marketplace/item/1",
  listingTitleRaw: "Kitchen remodel",
  lastReplyText: "Call me at 7045551212",
  replyPhoneNormalized: "7045551212",
  extractedPhone: null,
  facebookJoinYear: 2019,
  tradeGuess: "painting",
  city: "Charlotte",
  state: "NC",
  crmLeadId: null,
  messageStatus: "reply_received",
};

describe("POST /api/marketplace/pending-outreach/:id/convert-to-crm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPendingOutreachById.mockResolvedValue({ ...BASE_RECORD });
    mockUpdatePendingOutreach.mockResolvedValue({ ...BASE_RECORD, messageStatus: "converted" });
    mockCheckManualLeadDuplicate.mockResolvedValue({ isDuplicate: false });
    mockFindContactByPhone.mockResolvedValue(undefined);
    mockCreateContact.mockResolvedValue({
      id: "contact-1",
      companyId: null,
      firstName: "Maria",
      lastName: "Lopez",
      phone: "7045551212",
    });
    mockFindCompanyByName.mockResolvedValue(undefined);
    mockCreateCompany.mockResolvedValue({
      id: "company-1",
      name: "Lopez Painting",
    });
    mockUpdateContact.mockResolvedValue({
      id: "contact-1",
      companyId: "company-1",
      firstName: "Maria",
      lastName: "Lopez",
      phone: "7045551212",
    });
    mockResolveLeadAssignee.mockResolvedValue(authUser.id);
    mockGetDefaultLeadStatus.mockResolvedValue({ id: "status-1" });
    mockGetLeadStatusBySlug.mockResolvedValue(undefined);
    mockCreateLead.mockResolvedValue({
      id: "lead-1",
      title: "Lopez Painting – Maria Lopez",
      trade: "painting",
    });
    mockGetStageBySlug.mockResolvedValue({ id: "stage-1", slug: "new-lead" });
    mockCreateOpportunity.mockResolvedValue({ id: "opp-1" });
    mockLogAudit.mockResolvedValue(undefined);
    mockExecuteStageAutomations.mockResolvedValue(undefined);
  });

  it("creates the lead with a resolved assignee", async () => {
    const app = await buildApp();

    const { status, body } = await post(
      app,
      "/api/marketplace/pending-outreach/pending-1/convert-to-crm",
      { overrideCompanyName: "Lopez Painting" },
    );

    expect(status).toBe(201);
    expect(body.crmLeadId).toBe("lead-1");
    expect(mockResolveLeadAssignee).toHaveBeenCalledWith(authUser.id);
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTo: authUser.id,
      }),
    );
  });

  it("creates the lead with a null assignee when no active assignee exists", async () => {
    mockResolveLeadAssignee.mockResolvedValue(null);

    const app = await buildApp();

    const { status, body } = await post(
      app,
      "/api/marketplace/pending-outreach/pending-1/convert-to-crm",
      {},
    );

    expect(status).toBe(201);
    expect(body.crmLeadId).toBe("lead-1");
    expect(mockCreateLead).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTo: null,
      }),
    );
    expect(mockCreateOpportunity).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedTo: null,
      }),
    );
  });
});
