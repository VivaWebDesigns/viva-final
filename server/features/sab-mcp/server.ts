import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type SabSheetsRepositoryFactory,
  type SabWorkflowCreator,
} from "./sheets";
import { checkCrmPlaceIds } from "./crmDedup";
import { checkCrmPlaceIdsFromLocalFalconReport } from "./localFalconDedup";
import { reverseGeocodeSabCenters } from "./reverseGeocode";
import {
  checkCrmLocalFalconReportInputSchema,
  checkCrmPlaceIdsInputSchema,
  createSabWorkflowInputSchema,
  getSabBatchInputSchema,
  getSabCompanyInputSchema,
  getSabProgressInputSchema,
  markSabBlockedInputSchema,
  reverseGeocodeSabCentersInputSchema,
  SAB_HEADERS,
  SAB_QUALIFICATION_STATUSES,
  SAB_STATUSES,
  saveSabCompanyInputSchema,
  saveSabScanResultInputSchema,
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
  workflowCreator: SabWorkflowCreator,
  actorEmail: string,
) {
  const server = new McpServer({
    name: "viva-sab-workflow",
    version: "1.4.0",
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

  server.registerTool("check_crm_place_ids", {
    description:
      "Bulk-check discovered Google Place IDs against prior Local Falcon CRM prospect profiles using exact Place-ID equality. Use this immediately after building the discovery ledger and before audits. Do not substitute company-name, phone, website, address, or fuzzy matching.",
    inputSchema: checkCrmPlaceIdsInputSchema,
  }, async ({ place_ids }) => {
    return jsonToolResult(await checkCrmPlaceIds(place_ids));
  });

  server.registerTool("check_crm_local_falcon_report", {
    description:
      "Fetch a completed Local Falcon competitor report by report key, extract every discovered Google Place ID server-side, and bulk-check them against prior CRM prospect profiles using exact Place-ID equality. Use this instead of manually copying a large competitor roster between connectors. This does not run a scan. The compact response omits the full unmatched-ID list but returns counts, a deterministic Place-ID checksum, and every CRM match.",
    inputSchema: checkCrmLocalFalconReportInputSchema,
  }, async ({ report_key }) => {
    return jsonToolResult(
      await checkCrmPlaceIdsFromLocalFalconReport(report_key),
    );
  });

  server.registerTool("reverse_geocode_sab_centers", {
    description:
      "Reverse-geocode exact final SAB scan-center coordinates through the Google Maps Geocoding API. Returns city, state, ZIP, source metadata, and per-coordinate completeness without writing to the Workflow Sheet. Use this for SOP section 11; never substitute nearby-business searches or inferred ZIP centroids.",
    inputSchema: reverseGeocodeSabCentersInputSchema,
  }, async ({ centers }) => {
    return jsonToolResult(await reverseGeocodeSabCenters(centers));
  });

  server.registerTool("create_sab_workflow", {
    description:
      "Create a populated native Google Sheet for a future city run in the connector's authenticated business Drive. The tool creates the tab as SAB Workflow, validates the exact canonical headers and every roster row before writing, writes the full roster once, and returns the exact Sheet URL, tab name, row count, and progress validation.",
    inputSchema: createSabWorkflowInputSchema,
  }, async ({ title, companies }) => {
    return jsonToolResult(await workflowCreator.createWorkflow(
      title,
      companies,
      actorEmail,
    ));
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
      "Save approved research fields to the exact SAB Workflow Sheet for one company immediately after completing it. Qualified and deferred records require complete website and review audits with 3–6 concise, relevant findings. A manually disqualified record may be marked complete without unfinished audits when research_notes contains the factual disqualification reason; never fabricate audit findings. Set qualification_status to qualified, disqualified, or deferred before status complete.",
    inputSchema: saveSabCompanyInputSchema,
  }, async ({ workflow_sheet, sheet_name, place_id, updates }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.saveCompany(place_id, updates, actorEmail));
  });

  server.registerTool("save_sab_scan_result", {
    description:
      "Save one completed Local Falcon scan result by exact Place ID. Require only scan role, ARP, SoLV, report key, report URL, scan date, and scan keyword. Supply scan center, center type, scan type, and found-in only when already available. Deliverable scans update the current scan columns, while every deliverable or auxiliary scan is retained automatically in append-safe scan history.",
    inputSchema: saveSabScanResultInputSchema,
  }, async ({ workflow_sheet, sheet_name, place_id, scan_result }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.saveScanResult(
      place_id,
      scan_result,
      actorEmail,
    ));
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
