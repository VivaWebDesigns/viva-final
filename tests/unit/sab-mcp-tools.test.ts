import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createSabMcpServer } from "../../server/features/sab-mcp/server";

describe("SAB MCP tool discovery", () => {
  it("lists every tool with the OAuth scopes ChatGPT must request", async () => {
    const server = createSabMcpServer(
      (() => {
        throw new Error("repository access is not expected during discovery");
      }) as never,
      {
        createWorkflow: async () => {
          throw new Error("workflow creation is not expected during discovery");
        },
      },
      "unauthenticated",
    );
    const client = new Client({ name: "sab-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(14);
      expect(tools.map((tool) => tool.name)).toContain("get_sab_schema");
      expect(tools[0]).toMatchObject({
        _meta: {
          securitySchemes: [
            { type: "oauth2", scopes: ["sab:read", "sab:write"] },
          ],
        },
      });
      expect(tools.every((tool) => (
        (tool._meta?.securitySchemes as Array<{ type?: string }> | undefined)?.[0]?.type
          === "oauth2"
      ))).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
