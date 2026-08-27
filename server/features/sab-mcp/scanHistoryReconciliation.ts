import { createHash } from "node:crypto";
import {
  getSabRankedCells,
  type LocalFalconFetch,
  type SabRankedCellsResult,
} from "./localFalconRankedCells";
import type { SabScanHistoryRepairInput } from "./schema";

const CENTER_TOLERANCE = 0.000_001;

export type VerifiedSabScanHistoryRepair = SabScanHistoryRepairInput & {
  actual: {
    scan_center: string;
    grid_size: number;
    radius: number;
    measurement: string;
    keyword: string;
    found_in: number;
    arp: number | null;
    solv: number | null;
    scan_date: string | null;
    report_url: string;
  };
  reconciliation_id: string;
};

function parseCenter(value: string) {
  const [latitude, longitude] = value
    .split(",")
    .map((part) => Number(part.trim()));
  return { latitude, longitude };
}

function mismatch(label: string, expected: unknown, actual: unknown) {
  throw new Error(
    `Scan-history repair verification failed: ${label} expected ${JSON.stringify(expected)} but Local Falcon returned ${JSON.stringify(actual)}.`,
  );
}

function verifyReport(
  repair: SabScanHistoryRepairInput,
  report: SabRankedCellsResult,
): VerifiedSabScanHistoryRepair {
  if (report.report_key !== repair.report_key) {
    mismatch("report_key", repair.report_key, report.report_key);
  }
  if (report.report_subject_place_id !== repair.expected_place_id) {
    mismatch(
      "report subject Place ID",
      repair.expected_place_id,
      report.report_subject_place_id,
    );
  }
  if (
    report.found_place_id_count !== 1 ||
    report.missing_place_id_count !== 0
  ) {
    mismatch(
      "subject Place ID",
      repair.expected_place_id,
      report.missing_place_ids,
    );
  }
  const business = report.businesses[0];
  if (!business || business.place_id !== repair.expected_place_id) {
    mismatch(
      "subject Place ID",
      repair.expected_place_id,
      business?.place_id ?? null,
    );
  }
  if (report.grid.size !== repair.expected.grid_size) {
    mismatch("grid size", repair.expected.grid_size, report.grid.size);
  }
  if (report.grid.radius !== repair.expected.radius) {
    mismatch("radius", repair.expected.radius, report.grid.radius);
  }
  if (report.grid.measurement.toLowerCase() !== repair.expected.measurement) {
    mismatch(
      "measurement",
      repair.expected.measurement,
      report.grid.measurement,
    );
  }
  if (report.keyword !== repair.expected.keyword) {
    mismatch("keyword", repair.expected.keyword, report.keyword);
  }
  if (report.platform !== repair.expected.platform) {
    mismatch("platform", repair.expected.platform, report.platform);
  }

  const expectedCenter = parseCenter(repair.expected.scan_center);
  if (
    Math.abs(report.grid.center.latitude - expectedCenter.latitude) >
      CENTER_TOLERANCE ||
    Math.abs(report.grid.center.longitude - expectedCenter.longitude) >
      CENTER_TOLERANCE
  ) {
    mismatch("scan center", expectedCenter, report.grid.center);
  }

  const actualCenter = `${report.grid.center.latitude},${report.grid.center.longitude}`;
  const reconciliationId = createHash("sha256")
    .update(
      JSON.stringify({
        authorization_id: repair.authorization_id,
        disposition: repair.disposition,
        expected_place_id: repair.expected_place_id,
        remove_from_place_ids: [...repair.remove_from_place_ids].sort(),
        report_key: repair.report_key,
      }),
    )
    .digest("hex");

  return {
    ...repair,
    actual: {
      scan_center: actualCenter,
      grid_size: report.grid.size,
      radius: report.grid.radius,
      measurement: report.grid.measurement,
      keyword: report.keyword ?? repair.expected.keyword,
      found_in: business.ranked_cell_count,
      arp: report.arp,
      solv: report.solv,
      scan_date: report.scan_date,
      report_url: `https://www.localfalcon.com/reports/view/${repair.report_key}`,
    },
    reconciliation_id: reconciliationId,
  };
}

export async function verifySabScanHistoryRepairs(
  repairs: SabScanHistoryRepairInput[],
  options: {
    apiKey?: string;
    fetchImpl?: LocalFalconFetch;
    getRankedCells?: typeof getSabRankedCells;
  } = {},
): Promise<VerifiedSabScanHistoryRepair[]> {
  const getRankedCells = options.getRankedCells ?? getSabRankedCells;
  const verified: VerifiedSabScanHistoryRepair[] = [];
  for (const repair of repairs) {
    const report = await getRankedCells(
      repair.report_key,
      [repair.expected_place_id],
      { apiKey: options.apiKey, fetchImpl: options.fetchImpl },
    );
    verified.push(verifyReport(repair, report));
  }
  return verified;
}
