import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type SabSheetsRepository } from "./sheets";
import {
  getSabBatchInputSchema,
  getSabCompanyInputSchema,
  getSabProgressInputSchema,
  markSabBlockedInputSchema,
  saveSabCompanyInputSchema,
} from "./schema";

function jsonToolResult(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(value, null, 2),
    }],
  };
}

export function createSabMcpServer(repository: SabSheetsRepository, actorEmail: string) {
  const server = new McpServer({
    name: "viva-sab-workflow",
    version: "1.0.0",
  });

  server.registerTool("get_sab_batch", {
    description:
      "Read the companies assigned to one Charlotte SAB batch. Use this at the start of a chat and after a handoff.",
    inputSchema: getSabBatchInputSchema,
  }, async ({ batch_id, include_completed }) => {
    return jsonToolResult(await repository.getBatch(batch_id, include_completed));
  });

  server.registerTool("get_sab_company", {
    description:
      "Read the current working record for one company using its stable Google Place ID.",
    inputSchema: getSabCompanyInputSchema,
  }, async ({ place_id }) => {
    return jsonToolResult(await repository.getCompany(place_id));
  });

  server.registerTool("save_sab_company", {
    description:
      "Save approved research fields for one SAB company immediately after completing it. Website and review audits must contain 3–6 concise, relevant findings; review findings must preserve company trajectory.",
    inputSchema: saveSabCompanyInputSchema,
  }, async ({ place_id, updates }) => {
    return jsonToolResult(await repository.saveCompany(place_id, updates, actorEmail));
  });

  server.registerTool("mark_sab_blocked", {
    description:
      "Mark a company blocked with a concrete reason. Location precision is not a blocker: use the existing city/state, a reasonable ZIP, and 'Service Area Business' when the address is blank.",
    inputSchema: markSabBlockedInputSchema,
  }, async ({ place_id, reason }) => {
    return jsonToolResult(await repository.markBlocked(place_id, reason, actorEmail));
  });

  server.registerTool("get_sab_progress", {
    description:
      "Return status counts for one SAB batch or for all four batches. Use this for handoffs and final reconciliation.",
    inputSchema: getSabProgressInputSchema,
  }, async ({ batch_id }) => {
    return jsonToolResult(await repository.getProgress(batch_id));
  });

  return server;
}
