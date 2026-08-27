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
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(21);
      expect(tools.map((tool) => tool.name)).toContain("get_sab_schema");
      expect(tools.map((tool) => tool.name)).toContain(
        "upgrade_sab_workflow_schema",
      );
      expect(tools.map((tool) => tool.name)).not.toContain(
        "build_sab_competitor_sidecar",
      );
      expect(tools.map((tool) => tool.name)).toContain(
        "create_sab_workflow_from_master_report",
      );
      expect(tools.map((tool) => tool.name)).toContain(
        "analyze_sab_master_centers",
      );
      expect(tools.map((tool) => tool.name)).toContain(
        "evaluate_sab_address_candidate",
      );
      expect(tools.map((tool) => tool.name)).toContain("enrich_sab_businesses");
      expect(tools.map((tool) => tool.name)).toContain(
        "reconcile_sab_scan_history",
      );
      expect(tools.map((tool) => tool.name)).toContain("run_sab_scan_once");
      expect(tools[0]).toMatchObject({
        _meta: {
          securitySchemes: [
            { type: "oauth2", scopes: ["sab:read", "sab:write"] },
          ],
        },
      });
      expect(
        tools.every(
          (tool) =>
            (
              tool._meta?.securitySchemes as
                Array<{ type?: string }> | undefined
            )?.[0]?.type === "oauth2",
        ),
      ).toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("distinguishes canonical, legacy/base, and upgradeable headers in the schema", async () => {
    const server = createSabMcpServer(
      (() => {
        throw new Error(
          "repository access is not expected during schema discovery",
        );
      }) as never,
      {
        createWorkflow: async () => {
          throw new Error("workflow creation is not expected");
        },
      },
      "unauthenticated",
    );
    const client = new Client({ name: "sab-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "get_sab_schema",
        arguments: {},
      });
      const content = result.content as Array<{ type: string; text: string }>;
      const schema = JSON.parse(content[0].text);
      expect(schema.required_headers).toEqual(schema.canonical_headers);
      expect(schema.legacy_base_required_headers).not.toContain("workflow");
      expect(schema.legacy_base_required_headers).not.toContain("contact_tag");
      expect(schema.scale_first_upgradeable_headers).toEqual([
        "workflow",
        "contact_tag",
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("returns the explicitly requested Scale-First v2 CRM contract", async () => {
    const server = createSabMcpServer(
      (() => {
        throw new Error(
          "repository access is not expected during contract discovery",
        );
      }) as never,
      {
        createWorkflow: async () => {
          throw new Error("workflow creation is not expected");
        },
      },
      "unauthenticated",
    );
    const client = new Client({ name: "sab-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "get_sab_crm_import_contract",
        arguments: { workflow: "scale_first_v2" },
      });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(JSON.parse(content[0].text)).toMatchObject({
        contract_version: "2.1",
        workflow: "scale_first_v2",
        writes_data: false,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("marks intermediate Workflow writes as private continuation", async () => {
    const server = createSabMcpServer(
      (() => ({
        saveCompany: async () => ({
          place_id: "place-1",
          company: "Example",
          status: "in_progress",
          updated_at: "2026-08-26T00:00:00.000Z",
          updated_fields: ["research_notes"],
        }),
      })) as never,
      {
        createWorkflow: async () => {
          throw new Error("workflow creation is not expected");
        },
      },
      "matt@vivawebdesigns.com",
    );
    const client = new Client({ name: "sab-mcp-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const result = await client.callTool({
        name: "save_sab_company",
        arguments: {
          workflow_sheet:
            "https://docs.google.com/spreadsheets/d/test-sheet/edit",
          sheet_name: "SAB Workflow",
          place_id: "place-1",
          updates: { research_notes: "Verified durable correction." },
        },
      });
      const content = result.content as Array<{ type: string; text: string }>;
      expect(JSON.parse(content[0].text).response_gate).toEqual({
        user_visible_response_allowed: false,
        supervisor_checkpoint_required_before_user_response: true,
        required_next_action:
          "continue_unblocked_work_or_call_review_sab_checkpoint_privately",
        invalidated_by_any_later_workflow_action: true,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
