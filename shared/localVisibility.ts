export const LOCAL_FALCON_AUTOMATED_MAP_ZOOM = 160;
export const LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM = 140;
export const LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM = 100;
const SERVICE_AREA_BUSINESS_LABEL = "Service Area Business";

export const LOCAL_VISIBILITY_CENTERED_MAP_POSITION = {
  x: 0,
  y: 0,
} as const;

export function getLocalFalconMapPresentation(
  automaticallyRetrieved: boolean,
  radiusMiles?: string | number | null,
) {
  const parsedRadius = Number(radiusMiles);
  const usesCloseRadiusFraming = automaticallyRetrieved
    && Number.isFinite(parsedRadius)
    && parsedRadius <= 3;
  return {
    mapZoom: automaticallyRetrieved
      ? usesCloseRadiusFraming
        ? LOCAL_FALCON_CLOSE_RADIUS_MAP_ZOOM
        : LOCAL_FALCON_AUTOMATED_MAP_ZOOM
      : LOCAL_VISIBILITY_DEFAULT_MAP_ZOOM,
    mapPosition: LOCAL_VISIBILITY_CENTERED_MAP_POSITION,
  };
}

export function formatLocalVisibilityReportAddress({
  address,
  city,
  state,
  zip,
}: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string {
  const normalizedAddress = address?.trim() ?? "";
  if (normalizedAddress.toLowerCase() === SERVICE_AREA_BUSINESS_LABEL.toLowerCase()) {
    return SERVICE_AREA_BUSINESS_LABEL;
  }

  return [normalizedAddress, city?.trim(), state?.trim(), zip?.trim()]
    .filter(Boolean)
    .join(", ")
    .replace(/, ([A-Z]{2}), /, ", $1 ");
}

export function formatLocalVisibilityAveragePosition(value: string | number | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text === "20+") return text;
  const numeric = Number(text);
  return Number.isFinite(numeric) && numeric >= 20 ? "20+" : text;
}

export type LocalVisibilityReportSummary = {
  id: string;
  leadId: string;
  companyId: string;
  batchId: string;
  businessName: string;
  keyword: string;
  market: string;
  radius: string;
  gridSize: string;
  scanDate: string;
  averagePosition: string;
  reportUrl: string | null;
  hasSnapshot: boolean;
};

export type LocalFalconCompetitorBusiness = {
  rank: number;
  place_id: string;
  name: string;
  solv: number;
  found_points: number | null;
  reviews: number;
  rating: number;
  is_subject: boolean;
};

export type LocalVisibilityReportLibrary = {
  ownReports: LocalVisibilityReportSummary[];
};
