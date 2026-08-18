import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  includeRequiredSabMcpScopes,
  isSabMcpDiscoveryRequest,
  isSabMcpEmptyProbe,
  sabMcpAuthRequiredResult,
} from "../../server/features/sab-mcp/routes";

describe("SAB MCP OAuth metadata", () => {
  it("advertises the workflow scopes required by MCP requests", () => {
    expect(includeRequiredSabMcpScopes({
      issuer: "https://vivawebdesigns.com",
      scopes_supported: ["openid", "profile", "email", "offline_access"],
    })).toEqual({
      issuer: "https://vivawebdesigns.com",
      scopes_supported: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "sab:read",
        "sab:write",
      ],
    });
  });

  it("does not duplicate scopes already returned by the provider", () => {
    expect(includeRequiredSabMcpScopes({
      scopes_supported: ["openid", "sab:read", "sab:write"],
    })).toEqual({
      scopes_supported: ["openid", "sab:read", "sab:write"],
    });
  });

  it("allows protocol discovery before the user links OAuth", () => {
    expect(isSabMcpDiscoveryRequest({ method: "initialize" })).toBe(true);
    expect(isSabMcpDiscoveryRequest({ method: "tools/list" })).toBe(true);
    expect(isSabMcpDiscoveryRequest({ method: "resources/list" })).toBe(true);
    expect(isSabMcpDiscoveryRequest([
      { method: "initialize" },
      { method: "notifications/initialized" },
    ])).toBe(true);
    expect(isSabMcpDiscoveryRequest({ method: "tools/call" })).toBe(false);
    expect(isSabMcpDiscoveryRequest([
      { method: "tools/list" },
      { method: "tools/call" },
    ])).toBe(false);
  });

  it("recognizes ChatGPT's zero-length connectivity probe", () => {
    expect(isSabMcpEmptyProbe({}, "0")).toBe(true);
    expect(isSabMcpEmptyProbe({}, undefined)).toBe(false);
    expect(isSabMcpEmptyProbe({ method: "initialize" }, "0")).toBe(false);
    expect(isSabMcpEmptyProbe([], "0")).toBe(false);
  });

  it("returns the ChatGPT tool-level OAuth challenge without running a tool", () => {
    const req = {
      body: { id: 7, method: "tools/call" },
      protocol: "https",
      get: () => "vivawebdesigns.com",
    } as unknown as Request;

    expect(sabMcpAuthRequiredResult(req)).toMatchObject({
      jsonrpc: "2.0",
      id: 7,
      result: {
        isError: true,
        _meta: {
          "mcp/www_authenticate": [expect.stringContaining(
            'resource_metadata="https://vivawebdesigns.com/.well-known/oauth-protected-resource"',
          )],
        },
      },
    });
  });
});
