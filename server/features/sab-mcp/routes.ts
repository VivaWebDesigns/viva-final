import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";
import { db } from "../../db";
import { user } from "@shared/schema";
import {
  createSabSheetsRepositoryFactoryFromEnv,
  createSabWorkflowCreatorFromEnv,
} from "./sheets";
import { createSabMcpServer } from "./server";

const ALLOWED_ROLES = new Set(["admin", "developer"]);

function oauthMetadataUrl(req: Request) {
  const configured = process.env.BETTER_AUTH_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);
  const origin = configured || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/$/, "")}/api/auth/.well-known/oauth-protected-resource`;
}

function unauthorized(req: Request, res: Response) {
  const metadata = oauthMetadataUrl(req);
  return res
    .status(401)
    .set("WWW-Authenticate", `Bearer resource_metadata="${metadata}"`)
    .set("Access-Control-Expose-Headers", "WWW-Authenticate")
    .json({
      jsonrpc: "2.0",
      error: { code: -32003, message: "Unauthorized: authentication required" },
      id: null,
    });
}

async function authenticateMcpRequest(req: Request, res: Response) {
  const token = await auth.api.getMcpSession({
    headers: fromNodeHeaders(req.headers),
  });
  const tokenExpiresAt = token?.accessTokenExpiresAt
    ? new Date(token.accessTokenExpiresAt).getTime()
    : 0;
  const scopes = new Set((token?.scopes || "").split(/\s+/).filter(Boolean));
  if (
    !token?.userId
    || !tokenExpiresAt
    || tokenExpiresAt <= Date.now()
    || !scopes.has("sab:read")
    || !scopes.has("sab:write")
  ) {
    unauthorized(req, res);
    return null;
  }

  const [actor] = await db
    .select({ email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, token.userId))
    .limit(1);

  if (!actor || !ALLOWED_ROLES.has(actor.role)) {
    res.status(403).json({
      jsonrpc: "2.0",
      error: { code: -32003, message: "Forbidden: SAB MCP access requires an admin or developer account" },
      id: null,
    });
    return null;
  }

  const allowedEmails = (process.env.SAB_MCP_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length > 0 && !allowedEmails.includes(actor.email.toLowerCase())) {
    res.status(403).json({
      jsonrpc: "2.0",
      error: { code: -32003, message: "Forbidden: account is not allowlisted for SAB MCP access" },
      id: null,
    });
    return null;
  }

  return actor;
}

export function registerSabMcpRoutes(app: Express) {
  // Better Auth is mounted under /api/auth, while MCP discovery starts at the
  // site origin. These aliases expose the same provider metadata at the
  // standards-defined root locations Claude checks first.
  app.get("/.well-known/oauth-authorization-server", async (req, res) => {
    const metadata = await auth.api.getMcpOAuthConfig({
      headers: fromNodeHeaders(req.headers),
    });
    res
      .set("Access-Control-Allow-Origin", "*")
      .set("Cache-Control", "public, max-age=300")
      .json(metadata);
  });

  app.get("/.well-known/oauth-protected-resource", async (req, res) => {
    const metadata = await auth.api.getMCPProtectedResource({
      headers: fromNodeHeaders(req.headers),
    });
    res
      .set("Access-Control-Allow-Origin", "*")
      .set("Cache-Control", "public, max-age=300")
      .json(metadata);
  });

  app.post("/mcp", async (req, res) => {
    const actor = await authenticateMcpRequest(req, res);
    if (!actor || res.headersSent) return;

    let repositoryFactory;
    let workflowCreator;
    try {
      repositoryFactory = createSabSheetsRepositoryFactoryFromEnv();
      workflowCreator = createSabWorkflowCreatorFromEnv();
    } catch (error) {
      const message = error instanceof Error ? error.message : "SAB MCP is not configured";
      return res.status(503).json({
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      });
    }

    const server = createSabMcpServer(repositoryFactory, workflowCreator, actor.email);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[sab-mcp] request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal SAB MCP error" },
          id: null,
        });
      }
    } finally {
      await transport.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });

  app.delete("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });
}
