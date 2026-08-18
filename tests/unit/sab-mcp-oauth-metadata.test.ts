import { describe, expect, it } from "vitest";
import { includeRequiredSabMcpScopes } from "../../server/features/sab-mcp/routes";

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
});
