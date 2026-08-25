import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type SabSheetsRepositoryFactory,
  type SabWorkflowCreator,
} from "./sheets";
import { checkCrmPlaceIds } from "./crmDedup";
import { checkCrmPlaceIdsFromLocalFalconReport } from "./localFalconDedup";
import { getSabRankedCells } from "./localFalconRankedCells";
import { buildSabCompetitorSidecar } from "./localFalconCompetitorSidecar";
import { reverseGeocodeSabCenters } from "./reverseGeocode";
import {
  getSabCrmImportContract,
  validateSabCrmManifest,
} from "./crmManifest";
import {
  checkCrmLocalFalconReportInputSchema,
  buildSabCompetitorSidecarInputSchema,
  checkCrmPlaceIdsInputSchema,
  createSabWorkflowInputSchema,
  getSabBatchInputSchema,
  getSabCrmImportContractInputSchema,
  getSabCompanyInputSchema,
  getSabProgressInputSchema,
  getSabRankedCellsInputSchema,
  markSabBlockedInputSchema,
  reverseGeocodeSabCentersInputSchema,
  SAB_HEADERS,
  SAB_LEGACY_REQUIRED_HEADERS,
  SAB_QUALIFICATION_STATUSES,
  SAB_SCALE_FIRST_UPGRADEABLE_HEADERS,
  SAB_STATUSES,
  saveSabCompanyInputSchema,
  saveSabScanResultInputSchema,
  upgradeSabWorkflowSchemaInputSchema,
  validateSabCrmManifestInputSchema,
} from "./schema";

function jsonToolResult(value: unknown) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(value, null, 2),
    }],
  };
}

export const SAB_MCP_SECURITY_SCHEMES = [{
  type: "oauth2" as const,
  scopes: ["sab:read", "sab:write"],
}];

function sabTool<T extends object>(definition: T) {
  return {
    ...definition,
    securitySchemes: SAB_MCP_SECURITY_SCHEMES,
    // The MCP TypeScript SDK does not yet serialize the top-level field, so
    // mirror it in _meta for OpenAI clients that consume the Apps SDK form.
    _meta: {
      securitySchemes: SAB_MCP_SECURITY_SCHEMES,
    },
  };
}

export function createSabMcpServer(
  repositoryFactory: SabSheetsRepositoryFactory,
  workflowCreator: SabWorkflowCreator,
  actorEmail: string,
) {
  const server = new McpServer({
    name: "viva-sab-workflow",
    version: "1.8.0",
  });

  server.registerTool("get_sab_schema", sabTool({
    description:
      "Return the complete canonical Workflow Sheet headers, the legacy/base headers required to read an existing Sheet, the upgradeable Scale-First headers, and allowed statuses.",
    inputSchema: {},
  }), async () => {
    return jsonToolResult({
      default_sheet_name: "SAB Workflow",
      required_headers: SAB_HEADERS,
      canonical_headers: SAB_HEADERS,
      legacy_base_required_headers: SAB_LEGACY_REQUIRED_HEADERS,
      scale_first_upgradeable_headers: SAB_SCALE_FIRST_UPGRADEABLE_HEADERS,
      statuses: SAB_STATUSES,
      qualification_statuses: SAB_QUALIFICATION_STATUSES,
    });
  });

  server.registerTool("get_sab_crm_import_contract", sabTool({
    description:
      "Return the requested authoritative strict CRM batch.json contract for SAB Local Falcon prospects. Explicitly request scale_first_v2 for Scale-First Manifest v2; the backward-compatible default is Audit-First v1.1. The contract comes from the production CRM import path and does not import or modify data.",
    inputSchema: getSabCrmImportContractInputSchema,
  }), async ({ workflow }) => {
    return jsonToolResult(getSabCrmImportContract(workflow));
  });

  server.registerTool("validate_sab_crm_manifest", sabTool({
    description:
      "Validate a complete candidate SAB CRM batch.json payload against the production Local Falcon CRM parser. Returns compact validation errors and performs no import or write. Use after constructing the manifest and before requesting export approval.",
    inputSchema: validateSabCrmManifestInputSchema,
  }), async ({ manifest_json }) => {
    return jsonToolResult(validateSabCrmManifest(manifest_json));
  });

  server.registerTool("check_crm_place_ids", sabTool({
    description:
      "Bulk-check discovered Google Place IDs against prior Local Falcon CRM prospect profiles using exact Place-ID equality. Use this immediately after building the discovery ledger and before audits. Do not substitute company-name, phone, website, address, or fuzzy matching.",
    inputSchema: checkCrmPlaceIdsInputSchema,
  }), async ({ place_ids }) => {
    return jsonToolResult(await checkCrmPlaceIds(place_ids));
  });

  server.registerTool("check_crm_local_falcon_report", sabTool({
    description:
      "Fetch a completed Local Falcon competitor report by report key, extract every discovered Google Place ID server-side, and bulk-check them against prior CRM prospect profiles using exact Place-ID equality. Use this instead of manually copying a large competitor roster between connectors. This does not run a scan. The compact response omits the full unmatched-ID list but returns counts, a deterministic Place-ID checksum, and every CRM match.",
    inputSchema: checkCrmLocalFalconReportInputSchema,
  }), async ({ report_key }) => {
    return jsonToolResult(
      await checkCrmPlaceIdsFromLocalFalconReport(report_key),
    );
  });

  server.registerTool("get_sab_ranked_cells", sabTool({
    description:
      "Read a completed Local Falcon master scan and return exact numeric ranked cells only for the requested qualified-company Place IDs. The connector filters the large report server-side, maps every returned coordinate to a 1-based north-to-south row and west-to-east column, separately counts imprecise or unranked placeholders such as 20+, and reports missing Place IDs. This is read-only and never runs or replaces a scan.",
    inputSchema: getSabRankedCellsInputSchema,
  }), async ({ report_key, place_ids }) => {
    return jsonToolResult(await getSabRankedCells(report_key, place_ids));
  });

  server.registerTool("build_sab_competitor_sidecar", sabTool({
    description:
      "Build a compact competitors.json v2 from the official completed Local Falcon reports referenced by an already validated Scale-First v2 batch.json. Reconciles exact report and subject identity, scan specification, keyword, and date server-side; returns only the subject and immediately adjacent ordinal competitors. This is read-only, runs no scans, and performs no Sheet, CRM, or account writes.",
    inputSchema: buildSabCompetitorSidecarInputSchema,
  }), async ({ manifest_json }) => {
    return jsonToolResult(await buildSabCompetitorSidecar(manifest_json));
  });

  server.registerTool("reverse_geocode_sab_centers", sabTool({
    description:
      "Reverse-geocode exact final SAB scan-center coordinates through the Google Maps Geocoding API. Returns city, state, ZIP, source metadata, and per-coordinate completeness without writing to the Workflow Sheet. Use this for SOP section 11; never substitute nearby-business searches or inferred ZIP centroids.",
    inputSchema: reverseGeocodeSabCentersInputSchema,
  }), async ({ centers }) => {
    return jsonToolResult(await reverseGeocodeSabCenters(centers));
  });

  server.registerTool("create_sab_workflow", sabTool({
    description:
      "Create a populated native Google Sheet for a future city run in the connector's authenticated business Drive. The tool creates the tab as SAB Workflow, validates the exact canonical headers and every roster row before writing, writes the full roster once, and returns the exact Sheet URL, tab name, row count, and progress validation.",
    inputSchema: createSabWorkflowInputSchema,
  }), async ({ title, companies }) => {
    return jsonToolResult(await workflowCreator.createWorkflow(
      title,
      companies,
      actorEmail,
    ));
  });

  server.registerTool("get_sab_batch", sabTool({
    description:
      "Read the companies assigned to one batch in the exact SAB Workflow Sheet supplied by the city run. Use this at the start of a chat and after a handoff.",
    inputSchema: getSabBatchInputSchema,
  }), async ({ workflow_sheet, sheet_name, batch_id, include_completed }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.getBatch(batch_id, include_completed));
  });

  server.registerTool("get_sab_company", sabTool({
    description:
      "Read the current working record for one company from the exact SAB Workflow Sheet using its stable Google Place ID.",
    inputSchema: getSabCompanyInputSchema,
  }), async ({ workflow_sheet, sheet_name, place_id }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.getCompany(place_id));
  });

  server.registerTool("upgrade_sab_workflow_schema", sabTool({
    description:
      "Backward-compatibly upgrade an existing SAB Workflow Sheet for Scale-First by expanding only the selected tab when required, appending only missing workflow and contact_tag headers, then verifying row, Place-ID, header-position, and grid-capacity integrity. This is idempotent and does not change company rows or other tabs.",
    inputSchema: upgradeSabWorkflowSchemaInputSchema,
  }), async ({ workflow_sheet, sheet_name }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult({
      workflow_sheet,
      sheet_name,
      ...await repository.upgradeWorkflowSchema(),
    });
  });

  server.registerTool("save_sab_company", sabTool({
    description:
      "Save approved research fields to the exact SAB Workflow Sheet for one company immediately after completing it. Qualified and deferred records require complete website and review audits with 3–6 concise, relevant findings. A manually disqualified record may be marked complete without unfinished audits when research_notes contains the factual disqualification reason; never fabricate audit findings. Set qualification_status to qualified, disqualified, or deferred before status complete.",
    inputSchema: saveSabCompanyInputSchema,
  }), async ({ workflow_sheet, sheet_name, place_id, updates }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.saveCompany(place_id, updates, actorEmail));
  });

  server.registerTool("save_sab_scan_result", sabTool({
    description:
      "Save one completed Local Falcon scan result by exact Place ID. Require only scan role, ARP, SoLV, report key, report URL, scan date, and scan keyword. Supply scan center, center type, scan type, and found-in only when already available. Deliverable scans update the current scan columns, while every deliverable or auxiliary scan is retained automatically in append-safe scan history.",
    inputSchema: saveSabScanResultInputSchema,
  }), async ({ workflow_sheet, sheet_name, place_id, scan_result }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.saveScanResult(
      place_id,
      scan_result,
      actorEmail,
    ));
  });

  server.registerTool("mark_sab_blocked", sabTool({
    description:
      "Mark a company blocked with a concrete reason. Location precision is not a blocker: use the existing city/state, a reasonable ZIP, and 'Service Area Business' when the address is blank.",
    inputSchema: markSabBlockedInputSchema,
  }), async ({ workflow_sheet, sheet_name, place_id, reason }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.markBlocked(place_id, reason, actorEmail));
  });

  server.registerTool("get_sab_progress", sabTool({
    description:
      "Return status counts for one SAB batch or every batch in the exact Workflow Sheet. Use this for handoffs and final reconciliation.",
    inputSchema: getSabProgressInputSchema,
  }), async ({ workflow_sheet, sheet_name, batch_id }) => {
    const repository = repositoryFactory(workflow_sheet, sheet_name);
    return jsonToolResult(await repository.getProgress(batch_id));
  });

  return server;
}
