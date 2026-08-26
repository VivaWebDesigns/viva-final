import { createHash } from "node:crypto";
import { SAB_ADDRESS_LABEL } from "@shared/sabCrm";
import { checkCrmPlaceIds, type CrmPlaceIdCheckResult } from "./crmDedup";
import {
  fetchLocalFalconReport,
  getSabRankedCells,
  localFalconApiKey,
  type LocalFalconFetch,
  type SabRankedCell,
} from "./localFalconRankedCells";
import type { SabWorkflowCreator } from "./sheets";
import type { SabWorkflowRowInput } from "./schema";

const MASTER_LEDGER_FIELDMASK = [
  "report_key",
  "keyword",
  "businesses.*.place_id",
  "businesses.*.name",
  "businesses.*.address",
  "businesses.*.rating",
  "businesses.*.reviews",
  "businesses.*.review_count",
  "businesses.*.category",
  "businesses.*.categories",
  "businesses.*.phone",
  "businesses.*.website",
].join(",");

type LocalFalconMasterBusiness = Record<string, unknown>;
type CheckPlaceIds = (placeIds: string[]) => Promise<CrmPlaceIdCheckResult>;

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function ratingValue(value: unknown) {
  if (value && typeof value === "object") {
    return cleanNumber((value as Record<string, unknown>).value);
  }
  return cleanNumber(value);
}

function categoryNames(business: LocalFalconMasterBusiness) {
  const categories = Array.isArray(business.categories)
    ? business.categories.flatMap((value) => {
        if (typeof value === "string" && value.trim()) return [value.trim()];
        if (!value || typeof value !== "object") return [];
        const row = value as Record<string, unknown>;
        return [cleanString(row.name ?? row.title ?? row.category)].filter(
          (name): name is string => Boolean(name),
        );
      })
    : [];
  const primary =
    cleanString(business.category ?? business.primary_category) ??
    categories[0] ??
    null;
  return {
    primary,
    categories: [...new Set(primary ? [primary, ...categories] : categories)],
  };
}

function reportBusinesses(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Local Falcon did not return the requested master report.");
  }
  const envelope = payload as {
    success?: unknown;
    message?: unknown;
    data?: { report_key?: unknown; keyword?: unknown; businesses?: unknown };
  };
  if (envelope.success !== true || !envelope.data) {
    throw new Error(
      cleanString(envelope.message) ??
        "Local Falcon did not return the requested master report.",
    );
  }
  if (!Array.isArray(envelope.data.businesses)) {
    throw new Error(
      "Local Falcon master report did not include a businesses array.",
    );
  }
  return {
    reportKey: cleanString(envelope.data.report_key),
    keyword: cleanString(envelope.data.keyword),
    businesses: envelope.data.businesses.filter(
      (row): row is LocalFalconMasterBusiness =>
        Boolean(row) && typeof row === "object",
    ),
  };
}

function batchId(index: number, batchSize: number) {
  return `B${String(Math.floor(index / batchSize) + 1).padStart(2, "0")}`;
}

function masterNote(
  reportKey: string,
  primaryCategory: string | null,
  categories: string[],
  decision: string,
) {
  return [
    `MASTER REPORT: ${reportKey}`,
    `PRIMARY CATEGORY: ${primaryCategory ?? "unresolved"}`,
    `CATEGORIES: ${categories.length ? categories.join(" | ") : "unresolved"}`,
    decision,
  ].join("; ");
}

function filteredRow(
  business: LocalFalconMasterBusiness,
  placeId: string,
  index: number,
  batchSize: number,
  reportKey: string,
  crmDuplicate: boolean,
): SabWorkflowRowInput {
  const name = cleanString(business.name ?? business.title) ?? placeId;
  const rating = ratingValue(business.rating);
  const reviews = cleanNumber(business.reviews ?? business.review_count);
  const address = business.address;
  const confirmedSab = address === false;
  const publicAddressReturned =
    address === true ||
    (typeof address === "string" && Boolean(address.trim())) ||
    (Boolean(address) && typeof address === "object");
  const { primary, categories } = categoryNames(business);
  const disqualification = crmDuplicate
    ? "SEC6 FILTER: DISQUALIFIED — exact Place ID already exists in CRM"
    : publicAddressReturned
      ? "SEC6 FILTER: DISQUALIFIED — not a confirmed SAB; public address discarded"
      : reviews !== null && reviews < 1
        ? "SEC6 FILTER: DISQUALIFIED — zero Google reviews"
        : rating !== null && rating < 4.5
          ? "SEC6 FILTER: DISQUALIFIED — rating below 4.5"
          : null;
  const unresolved =
    !disqualification &&
    (address === undefined || reviews === null || rating === null)
      ? "SEC6 FILTER: UNRESOLVED — missing or nonnumeric SAB, review-count, or rating evidence"
      : null;
  const decision =
    disqualification ?? unresolved ?? "SEC6 BASELINE FILTERS: PASSED";

  return {
    batch_id: batchId(index, batchSize),
    batch_position: index + 1,
    status: disqualification ? "complete" : "assigned",
    company: name,
    place_id: placeId,
    address: confirmedSab ? SAB_ADDRESS_LABEL : null,
    phone: cleanString(business.phone),
    website: cleanString(business.website),
    has_website: Boolean(cleanString(business.website)),
    rating,
    review_count: reviews === null ? null : Math.max(0, Math.trunc(reviews)),
    qualification_status: disqualification ? "disqualified" : null,
    blocker: unresolved,
    research_notes: masterNote(reportKey, primary, categories, decision),
  };
}

export async function createSabWorkflowFromMasterReport(
  title: string,
  reportKey: string,
  batchSize: number,
  workflowCreator: SabWorkflowCreator,
  actorEmail: string,
  options: {
    apiKey?: string;
    fetchImpl?: LocalFalconFetch;
    checkPlaceIds?: CheckPlaceIds;
  } = {},
) {
  const apiKey = options.apiKey?.trim() || localFalconApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const cleanReportKey = reportKey.trim();
  const payload = await fetchLocalFalconReport(
    "competitor-reports",
    cleanReportKey,
    MASTER_LEDGER_FIELDMASK,
    apiKey,
    fetchImpl,
  );
  const report = reportBusinesses(payload);
  const uniqueBusinesses = new Map<string, LocalFalconMasterBusiness>();
  let missingPlaceIdCount = 0;
  for (const business of report.businesses) {
    const placeId = cleanString(business.place_id);
    if (!placeId) {
      missingPlaceIdCount += 1;
      continue;
    }
    if (!uniqueBusinesses.has(placeId)) uniqueBusinesses.set(placeId, business);
  }
  const placeIds = [...uniqueBusinesses.keys()];
  if (!placeIds.length) {
    throw new Error(
      "Local Falcon master report did not include any Google Place IDs.",
    );
  }
  const crm = await (options.checkPlaceIds ?? checkCrmPlaceIds)(placeIds);
  const crmMatches = new Set(crm.matched_place_ids);
  const rows = placeIds.map((placeId, index) =>
    filteredRow(
      uniqueBusinesses.get(placeId)!,
      placeId,
      index,
      batchSize,
      report.reportKey ?? cleanReportKey,
      crmMatches.has(placeId),
    ),
  );
  const workflow = await workflowCreator.createWorkflow(
    title,
    rows,
    actorEmail,
  );
  const dispositionCounts = rows.reduce<Record<string, number>>((acc, row) => {
    const key =
      row.qualification_status ?? (row.blocker ? "unresolved" : "survivor");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const placeIdHash = createHash("sha256")
    .update(placeIds.join("\n"))
    .digest("hex");

  return {
    ...workflow,
    report_key: report.reportKey ?? cleanReportKey,
    keyword: report.keyword,
    source_business_count: report.businesses.length,
    businesses_missing_place_id_count: missingPlaceIdCount,
    unique_place_id_count: placeIds.length,
    duplicate_place_id_count:
      report.businesses.length - missingPlaceIdCount - placeIds.length,
    place_id_sha256: placeIdHash,
    crm_matched_place_id_count: crm.matched_place_id_count,
    crm_unmatched_place_id_count: crm.unmatched_place_id_count,
    disposition_counts: dispositionCounts,
    roster_returned_inline: false,
    raw_addresses_persisted: false,
    scan_executed: false,
  };
}

function rankedCellHash(cells: SabRankedCell[]) {
  return createHash("sha256")
    .update(
      cells
        .map((cell) =>
          [
            cell.row,
            cell.column,
            cell.rank,
            cell.latitude,
            cell.longitude,
          ].join(","),
        )
        .sort()
        .join("\n"),
    )
    .digest("hex");
}

function clusters(cells: SabRankedCell[]) {
  const remaining = new Map(
    cells.map((cell) => [`${cell.row}:${cell.column}`, cell]),
  );
  const sizes: number[] = [];
  while (remaining.size) {
    const [firstKey] = remaining.keys();
    remaining.delete(firstKey);
    const queue = [firstKey];
    let size = 0;
    while (queue.length) {
      const key = queue.shift()!;
      size += 1;
      const [row, column] = key.split(":").map(Number);
      for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
          if (rowDelta === 0 && columnDelta === 0) continue;
          const neighbor = `${row + rowDelta}:${column + columnDelta}`;
          if (remaining.delete(neighbor)) queue.push(neighbor);
        }
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

export function summarizeSabCenter(cells: SabRankedCell[], gridSize: number) {
  if (!cells.length) return null;
  const totalWeight = cells.reduce((sum, cell) => sum + 1 / cell.rank, 0);
  const latitude =
    cells.reduce((sum, cell) => sum + cell.latitude / cell.rank, 0) /
    totalWeight;
  const longitude =
    cells.reduce((sum, cell) => sum + cell.longitude / cell.rank, 0) /
    totalWeight;
  const rows = [...new Set(cells.map(({ row }) => row))].sort((a, b) => a - b);
  const columns = [...new Set(cells.map(({ column }) => column))].sort(
    (a, b) => a - b,
  );
  const componentSizes = clusters(cells);
  const edgeFlagged = cells.some(
    ({ row, column }) =>
      row <= 2 || column <= 2 || row >= gridSize - 1 || column >= gridSize - 1,
  );
  const spreadInBothAxes = rows.length > 1 && columns.length > 1;
  const coherentCluster = componentSizes.length === 1;
  return {
    ranked_cell_count: cells.length,
    best_rank: Math.min(...cells.map(({ rank }) => rank)),
    centroid: { latitude, longitude, weighting: "1/rank" as const },
    row_span: {
      minimum: rows[0],
      maximum: rows.at(-1)!,
      unique_count: rows.length,
    },
    column_span: {
      minimum: columns[0],
      maximum: columns.at(-1)!,
      unique_count: columns.length,
    },
    edge_flagged: edgeFlagged,
    edge_rule: "outermost_two_rings" as const,
    cluster_count: componentSizes.length,
    cluster_sizes: componentSizes,
    spread_in_both_axes: spreadInBothAxes,
    one_coherent_cluster: coherentCluster,
    baseline_centroid_trustworthy:
      cells.length >= 5 && !edgeFlagged && spreadInBothAxes && coherentCluster,
    ranked_cells_sha256: rankedCellHash(cells),
    ranked_cells_returned: false,
  };
}

export async function analyzeSabMasterCenters(
  reportKey: string,
  placeIds: string[],
  options: {
    apiKey?: string;
    fetchImpl?: LocalFalconFetch;
  } = {},
) {
  const ranked = await getSabRankedCells(reportKey, placeIds, options);
  return {
    report_key: ranked.report_key,
    source: ranked.source,
    scan_executed: false,
    keyword: ranked.keyword,
    grid: ranked.grid,
    requested_place_id_count: ranked.requested_place_id_count,
    found_place_id_count: ranked.found_place_id_count,
    missing_place_id_count: ranked.missing_place_id_count,
    missing_place_ids: ranked.missing_place_ids,
    businesses: ranked.businesses.map((business) => ({
      place_id: business.place_id,
      name: business.name,
      imprecise_or_unranked_cell_count:
        business.imprecise_or_unranked_cell_count,
      analysis: summarizeSabCenter(business.ranked_cells, ranked.grid.size),
    })),
  };
}
