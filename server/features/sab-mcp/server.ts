import { registerSabOrchestrationTools } from "./orchestration";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  type SabSheetsRepositoryFactory,
  type SabWorkflowCreator,
} from "./sheets";
import { checkCrmPlaceIds } from "./crmDedup";
import { checkCrmPlaceIdsFromLocalFalconReport } from "./localFalconDedup";
import { getSabRankedCells } from "./localFalconRankedCells";
import {
  analyzeSabMasterCenters,
  createSabWorkflowFromMasterReport,
} from "./localFalconMaster";
import { enrichSabBusinesses } from "./dataForSeoBusiness";
import { reverseGeocodeSabCenters } from "./reverseGeocode";
import { evaluateSabAddressCandidate } from "./addressCandidate";
import { verifySabScanHistoryRepairs } from "./scanHistoryReconciliation";
import { runSabScanOnce } from "./localFalconScanSubmission";
import { getSabCrmImportContract, validateSabCrmManifest } from "./crmManifest";
import {
  checkCrmLocalFalconReportInputSchema,
  analyzeSabMasterCentersInputSchema,
  checkCrmPlaceIdsInputSchema,
  createSabWorkflowInputSchema,
  createSabWorkflowFromMasterReportInputSchema,
  enrichSabBusinessesInputSchema,
  evaluateSabAddressCandidateInputSchema,
  getSabBatchInputSchema,
  getSabCrmImportContractInputSchema,
  getSabCompanyInputSchema,
  getSabProgressInputSchema,
  getSabRankedCellsInputSchema,
  markSabBlockedInputSchema,
  reverseGeocodeSabCentersInputSchema,
  reconcileSabScanHistoryInputSchema,
  runSabScanOnceInputSchema,
  SAB_HEADERS,
  SAB_CENTER_TYPES,
  SAB_RANKED_PEAK_CENTER_DESCRIPTION,
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
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function workflowWriteReceipt(value: unknown, nextAction: string) {
  return jsonToolResult({
    ...(value && typeof value === "object" && !Array.isArray(value) ? value : { result: value }),
    write_receipt: { recorded: true, next_action: nextAction, stage_end_readback_required: true },
  });
}

export const SAB_MCP_SECURITY_SCHEMES = [
  {
    type: "oauth2" as const,
    scopes: ["sab:read", "sab:write"],
  },
];

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
    version: "2.0.0",
  });

  server.registerTool(
    "get_sab_schema",
    sabTool({
      description:
        "Return the complete canonical Workflow Sheet headers, the legacy/base headers required to read an existing Sheet, the upgradeable Scale-First headers, allowed statuses, and center types.",
      inputSchema: {},
    }),
    async () => {
      return jsonToolResult({
        default_sheet_name: "SAB Workflow",
        required_headers: SAB_HEADERS,
        canonical_headers: SAB_HEADERS,
        legacy_base_required_headers: SAB_LEGACY_REQUIRED_HEADERS,
        scale_first_upgradeable_headers: SAB_SCALE_FIRST_UPGRADEABLE_HEADERS,
        statuses: SAB_STATUSES,
        qualification_statuses: SAB_QUALIFICATION_STATUSES,
        center_types: SAB_CENTER_TYPES,
        ranked_peak_center_description: SAB_RANKED_PEAK_CENTER_DESCRIPTION,
      });
    },
  );

  server.registerTool(
    "get_sab_crm_import_contract",
    sabTool({
      description:
        "Return the requested authoritative strict CRM batch.json contract for SAB Local Falcon prospects. Explicitly request scale_first_v2 for Scale-First Manifest v2; the backward-compatible default is Audit-First v1.1. The contract comes from the production CRM import path and does not import or modify data.",
      inputSchema: getSabCrmImportContractInputSchema,
    }),
    async ({ workflow }) => {
      return jsonToolResult(getSabCrmImportContract(workflow));
    },
  );

  server.registerTool(
    "validate_sab_crm_manifest",
    sabTool({
      description:
        "Validate a complete candidate SAB CRM batch.json payload against the production Local Falcon CRM parser. Returns compact validation errors and performs no import or write. Use after constructing the manifest and before requesting export approval.",
      inputSchema: validateSabCrmManifestInputSchema,
    }),
    async ({ manifest_json }) => {
      return jsonToolResult(validateSabCrmManifest(manifest_json));
    },
  );

  server.registerTool(
    "check_crm_place_ids",
    sabTool({
      description:
        "Bulk-check discovered Google Place IDs against prior Local Falcon deliverable and CRM-only prospect records using exact Place-ID equality. Use this immediately after building the discovery ledger and before enrichment or paid scans. Do not substitute company-name, phone, website, address, or fuzzy matching.",
      inputSchema: checkCrmPlaceIdsInputSchema,
    }),
    async ({ place_ids }) => {
      return jsonToolResult(await checkCrmPlaceIds(place_ids));
    },
  );

  server.registerTool(
    "check_crm_local_falcon_report",
    sabTool({
      description:
        "Fetch a completed Local Falcon competitor report by report key, extract every discovered Google Place ID server-side, and bulk-check them against prior CRM prospect profiles using exact Place-ID equality. Use this instead of manually copying a large competitor roster between connectors. This does not run a scan. The compact response omits the full unmatched-ID list but returns counts, a deterministic Place-ID checksum, and every CRM match.",
      inputSchema: checkCrmLocalFalconReportInputSchema,
    }),
    async ({ report_key }) => {
      return jsonToolResult(
        await checkCrmPlaceIdsFromLocalFalconReport(report_key),
      );
    },
  );

  server.registerTool(
    "create_sab_workflow_from_master_report",
    sabTool({
      description:
        "Create the complete durable SAB Workflow ledger directly from a completed Local Falcon master competitor report. Fetches the roster, performs exact Place-ID CRM deduplication, applies only deterministic SAB/review/rating filters, partitions execution batches, and writes the native Sheet server-side. The full roster and raw addresses are never returned to the model. This reads an existing report and runs no scan.",
      inputSchema: createSabWorkflowFromMasterReportInputSchema,
    }),
    async ({ title, report_key, batch_size }) => {
      return workflowWriteReceipt(
        await createSabWorkflowFromMasterReport(
          title,
          report_key,
          batch_size,
          workflowCreator,
          actorEmail,
        ),
        "continue_from_receipt; read_back_once_at_critical_stage_end",
      );
    },
  );

  server.registerTool(
    "get_sab_ranked_cells",
    sabTool({
      description:
        "Read a completed Local Falcon master scan and return exact numeric ranked cells only for the requested qualified-company Place IDs. The connector filters the large report server-side, maps every returned coordinate to a 1-based north-to-south row and west-to-east column, separately counts imprecise or unranked placeholders such as 20+, and reports missing Place IDs. This is read-only and never runs or replaces a scan.",
      inputSchema: getSabRankedCellsInputSchema,
    }),
    async ({ report_key, place_ids }) => {
      return jsonToolResult(await getSabRankedCells(report_key, place_ids));
    },
  );

  server.registerTool(
    "analyze_sab_master_centers",
    sabTool({
      description:
        "Compute compact SOP centering diagnostics server-side for selected Place IDs in a completed master report: 1/rank centroid, ranked-cell count and hash, row/column spread, actual boundary truncation versus bounded interior sources, deterministic clusters, peak diagnostics and normalized adjacent-edge offsets. Omits raw ranked cells and never runs a scan. Use get_sab_ranked_cells only for an exception or targeted verification.",
      inputSchema: analyzeSabMasterCentersInputSchema,
    }),
    async ({ report_key, place_ids }) => {
      return jsonToolResult(
        await analyzeSabMasterCenters(report_key, place_ids),
      );
    },
  );

  server.registerTool(
    "evaluate_sab_address_candidate",
    sabTool({
      description:
        "Privately evaluate one independently discovered address candidate against the exact ranked-cell geometry for the same Place ID in a completed Local Falcon report. Geocodes the candidate in memory and returns only coordinates, geocoder precision, ranked-cell checksum, and measured distances to the weighted centroid, nearest ranked cell, and best-rank cluster centroid. The raw address and raw cell array are never returned, logged, or persisted; this tool makes no final SOP fit decision, runs no scan, and performs no write.",
      inputSchema: evaluateSabAddressCandidateInputSchema,
    }),
    async ({ report_key, place_id, address_candidate }) => {
      return jsonToolResult(
        await evaluateSabAddressCandidate(
          report_key,
          place_id,
          address_candidate,
        ),
      );
    },
  );

  server.registerTool(
    "enrich_sab_businesses",
    sabTool({
      description:
        "Run compact DataForSEO My Business Info Live enrichment for survivor Place IDs. Translates each exact Place ID to the provider-required keyword form place_id:<ID>, includes location and language, verifies exact returned identity, deduplicates requests, classifies a zero-cost no-task response as request_not_submitted, and returns only SOP-required fields plus request/cost receipts. Performs no Sheet or CRM writes.",
      inputSchema: enrichSabBusinessesInputSchema,
    }),
    async ({ place_ids, location_name, language_code }) => {
      return jsonToolResult(
        await enrichSabBusinesses(place_ids, location_name, language_code),
      );
    },
  );

  server.registerTool(
    "reverse_geocode_sab_centers",
    sabTool({
      description:
        "Reverse-geocode exact final SAB scan-center coordinates through the Google Maps Geocoding API. Returns city, state, ZIP, source metadata, and per-coordinate completeness without writing to the Workflow Sheet. Use this for SOP section 11; never substitute nearby-business searches or inferred ZIP centroids.",
      inputSchema: reverseGeocodeSabCentersInputSchema,
    }),
    async ({ centers }) => {
      return jsonToolResult(await reverseGeocodeSabCenters(centers));
    },
  );

  server.registerTool(
    "create_sab_workflow",
    sabTool({
      description:
        "Create a populated native Google Sheet for a future city run in the connector's authenticated business Drive. The tool creates the tab as SAB Workflow, validates the exact canonical headers and every roster row before writing, writes the full roster once, and returns the exact Sheet URL, tab name, row count, and progress validation.",
      inputSchema: createSabWorkflowInputSchema,
    }),
    async ({ title, companies }) => {
      return workflowWriteReceipt(
        await workflowCreator.createWorkflow(title, companies, actorEmail),
        "continue_from_receipt; read_back_once_at_critical_stage_end",
      );
    },
  );

  server.registerTool(
    "get_sab_batch",
    sabTool({
      description:
        "Read the companies assigned to one batch in the exact SAB Workflow Sheet supplied by the city run. Use this at the start of a chat and after a handoff.",
      inputSchema: getSabBatchInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, batch_id, include_completed }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return jsonToolResult(
        await repository.getBatch(batch_id, include_completed),
      );
    },
  );

  server.registerTool(
    "get_sab_company",
    sabTool({
      description:
        "Read the current working record for one company from the exact SAB Workflow Sheet using its stable Google Place ID.",
      inputSchema: getSabCompanyInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, place_id }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return jsonToolResult(await repository.getCompany(place_id));
    },
  );

  server.registerTool(
    "upgrade_sab_workflow_schema",
    sabTool({
      description:
        "Backward-compatibly upgrade an existing SAB Workflow Sheet for Scale-First by expanding only the selected tab when required, appending only missing current Scale-First structured state headers, then verifying row, Place-ID, header-position, and grid-capacity integrity. This is idempotent and does not change company rows or other tabs.",
      inputSchema: upgradeSabWorkflowSchemaInputSchema,
    }),
    async ({ workflow_sheet, sheet_name }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return workflowWriteReceipt(
        {
          workflow_sheet,
          sheet_name,
          ...(await repository.upgradeWorkflowSchema()),
        },
        "continue_from_receipt; read_back_once_at_critical_stage_end",
      );
    },
  );

  server.registerTool(
    "save_sab_company",
    sabTool({
      description:
        "Persist one exact Place-ID record and return an ordinary write receipt. Structured eligibility_state, decision_state, qualification_reason and outcome are authoritative; research_notes are history only. Planned centers require matching structured evidence and do not establish a report or spending authorization. Scale-First requires no website/review audits or sales priority. Qualified complete and qa_ready records must satisfy the full deliverable or CRM-only contract; deferred/disqualified closure requires a structured reason. Read back once at the critical stage end.",
      inputSchema: saveSabCompanyInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, place_id, updates }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return workflowWriteReceipt(
        await repository.saveCompany(place_id, updates, actorEmail),
        "continue_from_receipt; read_back_once_at_critical_stage_end",
      );
    },
  );

  server.registerTool(
    "save_sab_scan_result",
    sabTool({
      description:
        "Save one completed Local Falcon scan result by exact Place ID. Require only scan role, ARP, SoLV, report key, report URL, scan date, and scan keyword. Supply scan center, center type, scan type, and found-in only when already available. Deliverable scans update the current scan columns, while every deliverable or auxiliary scan is retained automatically in append-safe scan history.",
      inputSchema: saveSabScanResultInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, place_id, scan_result }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return workflowWriteReceipt(
        await repository.saveScanResult(place_id, scan_result, actorEmail),
        "analyze_completed_report; review_completed_batch_with_Matt_before_further_scans",
      );
    },
  );

  server.registerTool(
    "reconcile_sab_scan_history",
    sabTool({
      description:
        "Repair only explicitly identified noncanonical SAB scan-history associations after an ambiguous or excess submission. The connector independently verifies each report's actual subject Place ID and exact scan specification against Local Falcon before writing, preserves row and Place-ID integrity, records an append-only reconciliation audit, and is idempotent. It cannot alter canonical report columns or invent scan results.",
      inputSchema: reconcileSabScanHistoryInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, repairs }) => {
      const verified = await verifySabScanHistoryRepairs(repairs);
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return workflowWriteReceipt(
        {
          workflow_sheet,
          sheet_name,
          ...(await repository.reconcileScanHistory(verified, actorEmail)),
        },
        "read_back_repaired_stage; reconcile_run_claim_before_further_scans",
      );
    },
  );

  server.registerTool(
    "run_sab_scan_once",
    sabTool({
      description:
        "Execute exactly one run-state-authorized Local Falcon scan owned by the single Codex orchestrator through the Viva connector's guarded path. Requires an exact approved batch in run_id, enforces testing pauses and credit limits, and creates a durable idempotency reservation before any paid call, optionally saves the exact Place ID, submits exactly once with no automatic retry, verifies the complete echoed scan envelope, and immediately records the report key. A lost or mismatched response becomes an ambiguous durable stop that must be reconciled; calling the same authorization and exact scan again never launches a second scan.",
      inputSchema: runSabScanOnceInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, ...input }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      const result = await runSabScanOnce(input, repository, actorEmail);
      const status = String(result.submission_status ?? "unknown");
      return workflowWriteReceipt(
        result,
        ["ambiguous_response", "location_unverified"].includes(status)
          ? "stop; reconcile_ambiguous_submission_and_run_claim_without_resubmitting"
          : "finish_only_this_exact_authorized_batch; review_completed_batch_with_Matt",
      );
    },
  );

  server.registerTool(
    "mark_sab_blocked",
    sabTool({
      description:
        "Mark a company blocked with a concrete reason. Never guess a city, state or ZIP. Resolve deliverable location from the validated center, or clearly label auxiliary market-reference information for CRM-only outcomes. Keep address 'Service Area Business'.",
      inputSchema: markSabBlockedInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, place_id, reason }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return workflowWriteReceipt(
        await repository.markBlocked(place_id, reason, actorEmail),
        "continue_from_receipt; read_back_once_at_critical_stage_end",
      );
    },
  );

  server.registerTool(
    "get_sab_progress",
    sabTool({
      description:
        "Return status counts for one SAB batch or every batch in the exact Workflow Sheet. Use this for handoffs and final reconciliation.",
      inputSchema: getSabProgressInputSchema,
    }),
    async ({ workflow_sheet, sheet_name, batch_id }) => {
      const repository = repositoryFactory(workflow_sheet, sheet_name);
      return jsonToolResult(await repository.getProgress(batch_id));
    },
  );

  registerSabOrchestrationTools(server, repositoryFactory, actorEmail);
  return server;
}
