import { fetchLocalFalconReport } from "../sab-mcp/localFalconRankedCells";

/** Read existing report metrics only. Never submits a scan or estimates ATRP from ARP. */
export async function fetchReportAtrp(
  reportKey: string,
  placeId: string,
  options: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<number> {
  if (!/^[a-f0-9]{12,64}$/i.test(reportKey) || !placeId.trim()) {
    throw new Error("An exact report key and Place ID are required for ATRP retrieval.");
  }
  const apiKey = options.apiKey ?? process.env.LOCAL_FALCON_API_KEY?.trim();
  if (!apiKey) throw new Error("Local Falcon credentials are required to retrieve all-point average rankings.");
  const report = await fetchLocalFalconReport("reports", reportKey,
    "report_key,place_id,atrp", apiKey, options.fetchImpl ?? fetch);
  if (report.success !== true || report.data?.report_key !== reportKey || report.data?.place_id !== placeId) {
    throw new Error(`Cannot verify ATRP report identity for ${reportKey}.`);
  }
  const value = report.data.atrp;
  const atrp = typeof value === "number" || (typeof value === "string" && value.trim()) ? Number(value) : NaN;
  if (!Number.isFinite(atrp) || atrp < 1) {
    throw new Error(`Completed ATRP is unavailable for report ${reportKey}; no ARP fallback is permitted.`);
  }
  return atrp;
}

/** Compatible with existing batch.json files: missing ATRP is resolved on the server. */
export async function hydrateReportAtrp(
  prospects: Array<{ report_key: string; place_id: string; atrp?: number | null }>,
  fetchAtrp = fetchReportAtrp,
): Promise<void> {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(8, prospects.length) }, async () => {
    while (index < prospects.length) {
      const prospect = prospects[index++];
      prospect.atrp = await fetchAtrp(prospect.report_key, prospect.place_id);
    }
  }));
}
