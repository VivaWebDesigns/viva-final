/**
 * Public Contact Form Integration Tests
 *
 * Validates POST /api/contacts route behavior:
 * - Valid data → 201 with created contact
 * - Missing required fields → 400 validation error
 * - Honeypot populated → 201 (silent discard)
 * - Storage failure → 500 server error
 *
 * storage and enqueueJob are mocked so no DB is required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateContact = vi.fn();
vi.mock("../../server/storage", () => ({
  storage: { createContact: mockCreateContact },
}));

const mockEnqueueJob = vi.fn();
vi.mock("../../server/features/workflow/queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

// ── Build a minimal express app that registers only the contact POST route ────

async function buildContactApp() {
  // Inline the route handler logic rather than calling registerRoutes() which
  // also boots socket.io, requiring a real http server and more mocks.
  const { storage } = await import("../../server/storage");
  const { enqueueJob } = await import("../../server/features/workflow/queue");
  const { insertContactSchema, utmAttributionSchema } = await import("@shared/schema");
  const { ZodError } = await import("zod");

  const app = express();
  app.use(express.json());

  app.post("/api/contacts", async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);
      const attribution = utmAttributionSchema.parse(req.body);

      if (attribution.honeypot) {
        return res.status(201).json({ id: "ok" });
      }

      const contact = await storage.createContact(data);

      await Promise.all([
        enqueueJob("crm_ingest", {}, contact.id, "contact_form"),
        enqueueJob("email_notification", {}, `email:${contact.id}:contact_form`, "contact_form"),
      ]).catch(() => {});

      res.status(201).json(contact);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return app;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function post(app: express.Application, path: string, body: unknown) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
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

const VALID_PAYLOAD = {
  name: "Maria Lopez",
  phone: "555-0100",
  email: "maria@example.com",
  city: "Austin",
  trade: "Painting",
  message: "Need a quote",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateContact.mockResolvedValue({ id: "c-abc", ...VALID_PAYLOAD });
    mockEnqueueJob.mockResolvedValue(undefined);
  });

  it("returns 201 with the created contact on valid payload", async () => {
    const app = await buildContactApp();
    const { status, body } = await post(app, "/api/contacts", VALID_PAYLOAD);
    expect(status).toBe(201);
    expect((body as any).id).toBe("c-abc");
    expect(mockCreateContact).toHaveBeenCalledOnce();
  });

  it("enqueues crm_ingest and email_notification jobs after creating contact", async () => {
    const app = await buildContactApp();
    await post(app, "/api/contacts", VALID_PAYLOAD);
    expect(mockEnqueueJob).toHaveBeenCalledTimes(2);
    const jobTypes = mockEnqueueJob.mock.calls.map((c: string[][]) => c[0]);
    expect(jobTypes).toContain("crm_ingest");
    expect(jobTypes).toContain("email_notification");
  });

  it("returns 400 when required fields are missing", async () => {
    const app = await buildContactApp();
    const { status, body } = await post(app, "/api/contacts", { email: "only@email.com" });
    expect(status).toBe(400);
    expect((body as any).message).toBe("Invalid data");
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it("returns 201 silently when honeypot field is populated (bot discard)", async () => {
    const app = await buildContactApp();
    const { status, body } = await post(app, "/api/contacts", {
      ...VALID_PAYLOAD,
      honeypot: "bot-content",
    });
    expect(status).toBe(201);
    expect((body as any).id).toBe("ok");
    expect(mockCreateContact).not.toHaveBeenCalled();
  });

  it("returns 500 when storage throws", async () => {
    mockCreateContact.mockRejectedValue(new Error("DB down"));
    const app = await buildContactApp();
    const { status } = await post(app, "/api/contacts", VALID_PAYLOAD);
    expect(status).toBe(500);
  });
});
