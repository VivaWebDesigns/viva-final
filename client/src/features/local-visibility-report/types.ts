export type LocalVisibilityReportData = {
  businessName: string;
  address: string;
  rating: string;
  reviewCount: string;
  searchPhrase: string;
  market: string;
  averagePosition: string;
  gridSize: string;
  radius: string;
  heatmapImageUrl: string;
};

export const LOCAL_VISIBILITY_REPORT_WIDTH = 1080;
export const LOCAL_VISIBILITY_REPORT_HEIGHT = 1920;

export type ExtractableVisibilityField = Exclude<keyof LocalVisibilityReportData, "heatmapImageUrl">;

export type VisibilityScreenshotAnalysis = {
  reportImageIndex: number;
  heatmapImageIndex: number;
  heatmapImageDataUrl: string | null;
  fields: Record<ExtractableVisibilityField, string | null>;
  lowConfidenceFields: ExtractableVisibilityField[];
};

export const DEFAULT_LOCAL_VISIBILITY_REPORT: LocalVisibilityReportData = {
  businessName: "",
  address: "",
  rating: "",
  reviewCount: "",
  searchPhrase: "",
  market: "",
  averagePosition: "",
  gridSize: "7 × 7",
  radius: "2.5",
  heatmapImageUrl: "",
};

export function normalizeGridSize(value: string): string {
  const match = value.trim().match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  return match ? `${match[1]} × ${match[2]}` : value.trim();
}

export function formatScanSettings(data: Pick<LocalVisibilityReportData, "gridSize" | "radius">): string {
  const gridSize = normalizeGridSize(data.gridSize) || "7 × 7";
  const radius = data.radius.trim() || "2.5";
  return `${gridSize} grid · ${radius}-mile radius`;
}
