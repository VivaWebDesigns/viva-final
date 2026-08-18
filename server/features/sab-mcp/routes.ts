import { json as jsonBodyParser, type Express, type Request, type Response } from "express";
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
const REQUIRED_SAB_MCP_SCOPES = ["sab:read", "sab:write"] as const;

export function includeRequiredSabMcpScopes(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }

  const currentScopes = Array.isArray((metadata as { scopes_supported?: unknown }).scopes_supported)
    ? (metadata as { scopes_supported: unknown[] }).scopes_supported.filter(
      (scope): scope is string => typeof scope === "string",
    )
    : [];

  return {
    ...metadata,
    scopes_supported: [
      ...currentScopes,
      ...REQUIRED_SAB_MCP_SCOPES.filter((scope) => !currentScopes.includes(scope)),
    ],
  };
}

function oauthMetadataUrl(req: Request) {
  const configured = process.env.BETTER_AUTH_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);
  const origin = configured || `${req.protocol}://${req.get("host")}`;
  return `${origin.replace(/\/$/, "")}/.well-known/oauth-protected-resource`;
}

function oauthChallenge(
  req: Request,
  options: { error?: string; errorDescription?: string } = {},
) {
  const parts = [
    `Bearer resource_metadata="${oauthMetadataUrl(req)}"`,
    `scope="${REQUIRED_SAB_MCP_SCOPES.join(" ")}"`,
  ];
  if (options.error) parts.push(`error="${options.error}"`);
  if (options.errorDescription) {
    parts.push(`error_description="${options.errorDescription}"`);
  }
  return parts.join(", ");
}

function unauthorized(req: Request, res: Response) {
  return res
    .status(401)
    .set("WWW-Authenticate", oauthChallenge(req))
    .set("Access-Control-Expose-Headers", "WWW-Authenticate")
    .json({
      jsonrpc: "2.0",
      error: { code: -32003, message: "Unauthorized: authentication required" },
      id: null,
    });
}

export function isSabMcpDiscoveryRequest(body: unknown) {
  if (Array.isArray(body)) {
    return body.length > 0 && body.every(isSabMcpDiscoveryRequest);
  }
  if (!body || typeof body !== "object") return false;
  const method = (body as { method?: unknown }).method;
  // This server exposes no resources or prompts. Every protocol method can be
  // used for handshake/discovery except tools/call, which is the sole boundary
  // where SAB data access or mutation can occur.
  return typeof method === "string" && method !== "tools/call";
}

export function sabMcpAuthRequiredResult(req: Request) {
  return {
    jsonrpc: "2.0",
    id: req.body?.id ?? null,
    result: {
      content: [{
        type: "text",
        text: "Authentication required: connect your Viva account to continue.",
      }],
      _meta: {
        "mcp/www_authenticate": [oauthChallenge(req, {
          error: "insufficient_scope",
          errorDescription: "Viva SAB Workflow requires sab:read and sab:write access.",
        })],
      },
      isError: true,
    },
  };
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
      .json(includeRequiredSabMcpScopes(metadata));
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

  // OpenAI's connector scanner sends JSON-RPC payloads as
  // application/octet-stream. The app-wide JSON middleware intentionally
  // ignores that media type, so parse it only on the MCP endpoint.
  app.post("/mcp", jsonBodyParser({
    type: "application/octet-stream",
    limit: "1mb",
  }), async (req, res) => {
    const requestContentType = req.get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (requestContentType === "application/octet-stream") {
      // The body is JSON despite the scanner's generic media type. Normalize it
      // after parsing so the MCP SDK's content-type validation accepts it. The
      // SDK's Node adapter rebuilds a Web Request from rawHeaders, so update both
      // header representations.
      req.headers["content-type"] = "application/json";
      for (let index = 0; index < req.rawHeaders.length; index += 2) {
        if (req.rawHeaders[index]?.toLowerCase() === "content-type") {
          req.rawHeaders[index + 1] = "application/json";
        }
      }
    }
    const isDiscoveryRequest = isSabMcpDiscoveryRequest(req.body);
    const hasBearerToken = typeof req.headers.authorization === "string"
      && req.headers.authorization.toLowerCase().startsWith("bearer ");
    const actor = hasBearerToken ? await authenticateMcpRequest(req, res) : null;
    if (res.headersSent) return;
    if (!actor && !isDiscoveryRequest) {
      if (req.body?.method === "tools/call") {
        return res.status(200).json(sabMcpAuthRequiredResult(req));
      }
      console.warn("[sab-mcp] unauthenticated non-discovery request", {
        bodyType: Array.isArray(req.body)
          ? "array"
          : Buffer.isBuffer(req.body)
            ? "buffer"
            : typeof req.body,
        method: req.body?.method ?? null,
        contentType: req.get("content-type") || null,
        contentEncoding: req.get("content-encoding") || null,
        contentLength: req.get("content-length") || null,
        topLevelKeys: req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? Object.keys(req.body).slice(0, 10)
          : [],
      });
      return unauthorized(req, res);
    }

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

    const server = createSabMcpServer(
      repositoryFactory,
      workflowCreator,
      actor?.email || "unauthenticated",
    );
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
