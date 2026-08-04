import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type SabSheetsRepositoryFactory } from "./sheets";
import {
  getSabBatchInputSchema,
  getSabCompanyInputSchema,
  getSabProgressInputSchema,
  markSabBlockedInputSchema,
  SAB_HEADERS,
  SAB_QUALIFICATION_STATUSES,
  SAB_STATUSES,
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

export function createSabMcpServer(
  repositoryFactory: SabSheetsRepositoryFactory,
  actorEmail: string,
) {
  const server = new McpServer({
    name: "viva-sab-workflow",
    version: "1.0.0",
  });

  server.registerTool("get_sab_schema", {
    description:
      "Return the canonical Workflow Sheet tab name, required headers, and allowed statuses. Use this before creating a new city run's Workflow Sheet.",
    inputSchema: {},
  }, async () => {
    return jsonToolResult({
      default_sheet_name: "SAB Workflow",
      required_headers: SAB_HEADERS,
      statuses: SAB_STATUSES,
      qualification_statuses: SAB_QUALIFICATION_STATUSES,
    });
  });

  server.registerTool("get_sab_batch", {
    description:
      "Read the companies assigned to one batch in the exact SAB Workflow Sheet supplied by the city run. Use this at the start of a chat and after a handoff.",
    inputSchema: getSabBatchInputSchema,
  }, async ({ workflow_sheet, sheet_name, batch_id, include_completed }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.getBatch(batch_id, include_completed));
  });

  server.registerTool("get_sab_company", {
    description:
      "Read the current working record for one company from the exact SAB Workflow Sheet using its stable Google Place ID.",
    inputSchema: getSabCompanyInputSchema,
  }, async ({ workflow_sheet, sheet_name, place_id }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.getCompany(place_id));
  });

  server.registerTool("save_sab_company", {
    description:
      "Save approved research fields to the exact SAB Workflow Sheet for one company immediately after completing it. Website and review audits must contain 3–6 concise, relevant findings; review findings must preserve company trajectory. Set qualification_status to qualified, disqualified, or deferred before status complete, and put a disqualification or deferral reason in research_notes.",
    inputSchema: saveSabCompanyInputSchema,
  }, async ({ workflow_sheet, sheet_name, place_id, updates }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.saveCompany(place_id, updates, actorEmail));
  });

  server.registerTool("mark_sab_blocked", {
    description:
      "Mark a company blocked with a concrete reason. Location precision is not a blocker: use the existing city/state, a reasonable ZIP, and 'Service Area Business' when the address is blank.",
    inputSchema: markSabBlockedInputSchema,
  }, async ({ workflow_sheet, sheet_name, place_id, reason }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.markBlocked(place_id, reason, actorEmail));
  });

  server.registerTool("get_sab_progress", {
    description:
      "Return status counts for one SAB batch or every batch in the exact Workflow Sheet. Use this for handoffs and final reconciliation.",
    inputSchema: getSabProgressInputSchema,
  }, async ({ workflow_sheet, sheet_name, batch_id }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.getProgress(batch_id));
  });

  return server;
}
