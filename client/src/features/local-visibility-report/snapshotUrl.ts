/**
 * The snapshot file URL is stable per report and browsers cache it, so the
 * snapshot version is added to show a regenerated picture immediately.
 */
export function reportSnapshotFileUrl(reportId: string, contextCompanyId: string, version?: string | null) {
  const params = new URLSearchParams({ contextCompanyId });
  if (version) params.set("v", version);
  return `/api/local-visibility/reports/${encodeURIComponent(reportId)}/snapshot-file?${params.toString()}`;
}
