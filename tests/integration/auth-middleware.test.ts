/**
 * Auth Middleware Integration Tests
 *
 * Validates requireAuth and requireRole express middleware in isolation.
 * better-auth is mocked so these tests do not require a database connection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response } from "express";
import http from "node:http";

// ── Hoist mock functions so they are available in the vi.mock factory ─────────
const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("../../server/features/auth/auth", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: (h: unknown) => h,
}));

import { requireAuth, requireAuthBearerFirst, requireRole, requireRoleBearerFirst } from "../../server/features/auth/middleware";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp(middleware: express.RequestHandler[]) {
  const app = express();
  app.use(express.json());
  app.get("/protected", ...middleware, (req: Request, res: Response) => {
    res.json({ ok: true, user: (req as any).authUser });
  });
  return app;
}

function fetchFrom(app: express.Application, path: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      fetch(`http://localhost:${port}${path}`, { headers })
        .then(async (res) => {
          const body = await res.json().catch(() => null);
          server.close(() => resolve({ status: res.status, body }));
        })
        .catch((err) => server.close(() => reject(err)));
    });
  });
}

const ADMIN_USER = { id: "u-1", name: "Admin", email: "admin@viva.com", role: "admin" };
const SALES_USER = { id: "u-2", name: "Sales", email: "sales@viva.com", role: "sales_rep" };

// ── requireAuth ───────────────────────────────────────────────────────────────

describe("requireAuth middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session exists", async () => {
    mockGetSession.mockResolvedValue(null);
    const { status, body } = await fetchFrom(buildApp([requireAuth]), "/protected");
    expect(status).toBe(401);
    expect((body as any).message).toBe("Unauthorized");
  });

  it("returns 401 when session result has no user", async () => {
    mockGetSession.mockResolvedValue({ user: null, session: null });
    const { status } = await fetchFrom(buildApp([requireAuth]), "/protected");
    expect(status).toBe(401);
  });

  it("returns 401 when getSession throws", async () => {
    mockGetSession.mockRejectedValue(new Error("DB timeout"));
    const { status } = await fetchFrom(buildApp([requireAuth]), "/protected");
    expect(status).toBe(401);
  });

  it("passes through and attaches user when session is valid", async () => {
    mockGetSession.mockResolvedValue({ user: ADMIN_USER, session: { id: "s-1", token: "t1" } });
    const { status, body } = await fetchFrom(buildApp([requireAuth]), "/protected");
    expect(status).toBe(200);
    expect((body as any).ok).toBe(true);
    expect((body as any).user.email).toBe("admin@viva.com");
  });

  it("returns 403 when the authenticated user is banned", async () => {
    mockGetSession.mockResolvedValue({
      user: { ...ADMIN_USER, banned: true, banExpires: null },
      session: { id: "s-1", token: "t1" },
    });
    const { status, body } = await fetchFrom(buildApp([requireAuth]), "/protected");
    expect(status).toBe(403);
    expect((body as any).message).toMatch(/account disabled/i);
  });

  it("strips cookies when bearer-first auth is used", async () => {
    mockGetSession.mockResolvedValue({ user: ADMIN_USER, session: { id: "s-1", token: "t1" } });

    const { status } = await fetchFrom(
      buildApp([requireAuthBearerFirst]),
      "/protected",
      {
        authorization: "Bearer worker-token",
        cookie: "session=admin-cookie",
      },
    );

    expect(status).toBe(200);
    const forwardedHeaders = mockGetSession.mock.calls[0]?.[0]?.headers ?? {};
    expect(forwardedHeaders.authorization).toBe("Bearer worker-token");
    expect(forwardedHeaders.cookie).toBeUndefined();
  });
});

// ── requireRole ───────────────────────────────────────────────────────────────

describe("requireRole middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const { status } = await fetchFrom(buildApp([requireRole("admin")]), "/protected");
    expect(status).toBe(401);
  });

  it("returns 403 when authenticated but wrong role", async () => {
    mockGetSession.mockResolvedValue({ user: SALES_USER, session: {} });
    const { status, body } = await fetchFrom(buildApp([requireRole("admin")]), "/protected");
    expect(status).toBe(403);
    expect((body as any).message).toMatch(/forbidden/i);
  });

  it("passes through when role matches exactly", async () => {
    mockGetSession.mockResolvedValue({ user: ADMIN_USER, session: {} });
    const { status } = await fetchFrom(buildApp([requireRole("admin")]), "/protected");
    expect(status).toBe(200);
  });

  it("passes through when one of multiple allowed roles matches", async () => {
    mockGetSession.mockResolvedValue({ user: SALES_USER, session: {} });
    const { status } = await fetchFrom(buildApp([requireRole("admin", "sales_rep")]), "/protected");
    expect(status).toBe(200);
  });

  it("rejects a role not in the allowed list even if authenticated", async () => {
    const devUser = { ...SALES_USER, role: "dev" };
    mockGetSession.mockResolvedValue({ user: devUser, session: {} });
    const { status } = await fetchFrom(buildApp([requireRole("admin", "sales_rep")]), "/protected");
    expect(status).toBe(403);
  });

  it("supports bearer-first role checks", async () => {
    mockGetSession.mockResolvedValue({ user: SALES_USER, session: {} });
    const { status } = await fetchFrom(
      buildApp([requireRoleBearerFirst("admin", "sales_rep")]),
      "/protected",
      {
        authorization: "Bearer worker-token",
        cookie: "session=admin-cookie",
      },
    );
    expect(status).toBe(200);
    const forwardedHeaders = mockGetSession.mock.calls[0]?.[0]?.headers ?? {};
    expect(forwardedHeaders.cookie).toBeUndefined();
  });
});
